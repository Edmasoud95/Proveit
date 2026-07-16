import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { ToolDefinition } from '@proveit/shared';

export interface AgentCallResult {
  response: string;
  history: OpenAI.Chat.ChatCompletionMessageParam[];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Runs the tool-calling agent loop against an OpenAI-compatible endpoint. */
@Injectable()
export class AgentRunnerService {
  async callAgent(
    client: OpenAI,
    model: string,
    systemPrompt: string,
    messages: unknown[],
    tools: ToolDefinition[],
  ): Promise<AgentCallResult> {
    const MAX_ITERATIONS = 10;

    const stubbedTools = tools.filter((t) => t.mockResponse);
    const apiTools =
      stubbedTools.length > 0
        ? stubbedTools.map((t) => ({
            type: 'function' as const,
            function: { name: t.name, description: t.description, parameters: t.parameters },
          }))
        : undefined;

    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(messages as Array<{ role: 'user' | 'assistant'; content: string }>),
    ];

    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.chat.completions.create({
        model,
        messages: history,
        ...(apiTools ? { tools: apiTools } : {}),
      });

      promptTokens += response.usage?.prompt_tokens ?? 0;
      completionTokens += response.usage?.completion_tokens ?? 0;
      totalTokens += response.usage?.total_tokens ?? 0;

      const choice = response.choices[0];

      if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
        history.push({ role: 'assistant', content: choice.message.content ?? '' });
        return { response: choice.message.content ?? '', history, promptTokens, completionTokens, totalTokens };
      }

      // Preserve reasoning_content so thinking-mode APIs receive it back on the next turn
      const rawMsg = choice.message as unknown as Record<string, unknown>;
      const msgWithReasoning = {
        ...choice.message,
        ...(rawMsg['reasoning_content'] ? { reasoning_content: rawMsg['reasoning_content'] } : {}),
      };
      history.push(msgWithReasoning as (typeof history)[number]);

      for (const toolCall of choice.message.tool_calls) {
        const tool = tools.find((t) => t.name === toolCall.function.name);
        let content: string;

        if (!tool) {
          const available = tools.map((t) => t.name).join(', ');
          content = JSON.stringify({
            error: `Tool '${toolCall.function.name}' is not defined in this POC. Available tools: ${available}`,
          });
        } else if (!tool.mockResponse) {
          content = JSON.stringify({
            error: `No stub configured for tool '${tool.name}'. Set a mock response in the Tools tab.`,
          });
        } else {
          content = tool.mockResponse;
        }

        history.push({ role: 'tool', tool_call_id: toolCall.id, content });
      }
    }

    throw new Error('Tool call loop exceeded maximum iterations');
  }

  serializePipelineTrace(history: OpenAI.Chat.ChatCompletionMessageParam[]): string | null {
    // Exclude the system prompt (first message) from the trace
    const traceMessages = history.slice(1);
    if (traceMessages.length === 0) return null;
    return JSON.stringify(traceMessages);
  }
}
