import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import type { ChatMessageInput, ChatStreamEvent } from '@proveit/shared';

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  mockResponse?: string;
}

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
  ) {}

  streamChat(pocId: string, messages: ChatMessageInput[]): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();

    this.run(pocId, messages, subject).catch((err) => {
      const event: ChatStreamEvent = { type: 'error', message: err instanceof Error ? err.message : String(err) };
      subject.next({ data: JSON.stringify(event) } as MessageEvent);
      subject.complete();
    });

    return subject.asObservable();
  }

  private emit(subject: Subject<MessageEvent>, event: ChatStreamEvent): void {
    subject.next({ data: JSON.stringify(event) } as MessageEvent);
  }

  private async run(pocId: string, messages: ChatMessageInput[], subject: Subject<MessageEvent>): Promise<void> {
    const poc = await this.prisma.pocConfig.findUnique({ where: { id: pocId } });
    if (!poc) {
      this.emit(subject, { type: 'error', message: 'POC not found' });
      subject.complete();
      return;
    }

    let client: OpenAI;
    let model: string;
    try {
      const provider = await this.llmService.resolveForTask(pocId, 'agent');
      client = provider.client;
      model = provider.model;
    } catch {
      this.emit(subject, { type: 'error', message: 'No LLM provider configured for this POC' });
      subject.complete();
      return;
    }

    const tools: ToolDefinition[] = JSON.parse(poc.tools);

    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: poc.systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content } as OpenAI.Chat.ChatCompletionMessageParam)),
    ];

    const openaiTools: OpenAI.Chat.ChatCompletionTool[] = tools.map((t) => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    let continueLoop = true;
    while (continueLoop) {
      const stream = await client.chat.completions.create({
        model,
        messages: openaiMessages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
        stream: true,
      });

      let assistantContent = '';
      let reasoningContent = '';
      const toolCallAccum: Record<string, { id: string; name: string; args: string }> = {};

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta as Record<string, unknown>;
        if (!delta) continue;

        // Accumulate and stream reasoning_content for thinking-mode models (DeepSeek R1, Qwen-thinking, etc.)
        if (typeof delta['reasoning_content'] === 'string' && delta['reasoning_content']) {
          reasoningContent += delta['reasoning_content'];
          this.emit(subject, { type: 'reasoning-delta', delta: delta['reasoning_content'] });
        }

        if (typeof delta['content'] === 'string' && delta['content']) {
          assistantContent += delta['content'];
          this.emit(subject, { type: 'text-delta', delta: delta['content'] });
        }

        const toolCalls = delta['tool_calls'] as OpenAI.Chat.ChatCompletionChunk.Choice.Delta.ToolCall[] | undefined;
        if (toolCalls) {
          for (const tc of toolCalls) {
            const idx = String(tc.index);
            if (!toolCallAccum[idx]) {
              toolCallAccum[idx] = { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' };
              this.emit(subject, { type: 'tool-call-start', toolCallId: tc.id ?? idx, toolName: tc.function?.name ?? '' });
            }
            if (tc.id) toolCallAccum[idx].id = tc.id;
            if (tc.function?.name) toolCallAccum[idx].name = tc.function.name;
            if (tc.function?.arguments) {
              toolCallAccum[idx].args += tc.function.arguments;
              this.emit(subject, { type: 'tool-call-args-delta', toolCallId: toolCallAccum[idx].id || idx, argsDelta: tc.function.arguments });
            }
          }
        }

        if (chunk.choices[0]?.finish_reason === 'stop') {
          continueLoop = false;
        }

        if (chunk.choices[0]?.finish_reason === 'tool_calls') {
          const assistantMsg = {
            role: 'assistant' as const,
            content: assistantContent || null,
            tool_calls: Object.values(toolCallAccum).map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: tc.args },
            })),
            // Pass reasoning_content back to satisfy thinking-mode APIs (DeepSeek R1, Qwen-thinking, etc.)
            ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
          };
          openaiMessages.push(assistantMsg as unknown as OpenAI.Chat.ChatCompletionMessageParam);

          for (const tc of Object.values(toolCallAccum)) {
            const toolDef = tools.find((t) => t.name === tc.name);
            const result = toolDef?.mockResponse ?? `Tool "${tc.name}" executed.`;
            this.emit(subject, { type: 'tool-call-result', toolCallId: tc.id, result });
            openaiMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
          }
        }
      }
    }

    this.emit(subject, { type: 'done' });
    subject.complete();
  }
}
