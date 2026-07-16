import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
  type ChatModelRunOptions,
  type ThreadAssistantMessagePart,
} from '@assistant-ui/react';
import type { ChatMessageInput, ChatStreamEvent } from '@proveit/shared';
import { RunConfig } from '../components/eval/RunConfig';
import { Thread } from '../components/chat/Thread';
import { resolveEffectiveProvider, useRouting } from '../hooks/useRouting';

function buildApiMessages(options: ChatModelRunOptions): ChatMessageInput[] {
  return options.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
        .filter((p) => p.type === 'text')
        .map((p) => (p as { type: 'text'; text: string }).text)
        .join(''),
    }));
}

function createAdapter(pocId: string): ChatModelAdapter {
  return {
    async *run(options) {
      const apiMessages = buildApiMessages(options);

      const response = await fetch(`/api/pocs/${pocId}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
        signal: options.abortSignal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      let reasoningText = '';
      let mainText = '';
      const toolCalls = new Map<string, { toolCallId: string; toolName: string; argsText: string; result?: string }>();

      function buildContent(): readonly ThreadAssistantMessagePart[] {
        const parts: ThreadAssistantMessagePart[] = [];
        if (reasoningText) {
          parts.push({ type: 'reasoning', text: reasoningText });
        }
        for (const tc of toolCalls.values()) {
          let args = {} as Record<string, unknown>;
          try {
            args = JSON.parse(tc.argsText || '{}') as Record<string, unknown>;
          } catch {
            // partial JSON while streaming — keep empty object
          }
          parts.push({
            type: 'tool-call',
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            args: args as any,
            argsText: tc.argsText,
            result: tc.result,
          });
        }
        if (mainText) {
          parts.push({ type: 'text', text: mainText });
        }
        return parts;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            let event: ChatStreamEvent;
            try {
              event = JSON.parse(jsonStr) as ChatStreamEvent;
            } catch {
              continue;
            }

            if (event.type === 'reasoning-delta') {
              reasoningText += event.delta;
              yield { content: buildContent() };
            } else if (event.type === 'text-delta') {
              mainText += event.delta;
              yield { content: buildContent() };
            } else if (event.type === 'tool-call-start') {
              toolCalls.set(event.toolCallId, {
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                argsText: '',
              });
              yield { content: buildContent() };
            } else if (event.type === 'tool-call-args-delta') {
              const tc = toolCalls.get(event.toolCallId);
              if (tc) tc.argsText += event.argsDelta;
              yield { content: buildContent() };
            } else if (event.type === 'tool-call-result') {
              const tc = toolCalls.get(event.toolCallId);
              if (tc) tc.result = event.result;
              yield { content: buildContent() };
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}

function ChatRuntime({ pocId }: { pocId: string }) {
  const adapter = useMemo(() => createAdapter(pocId), [pocId]);
  const runtime = useLocalRuntime(adapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
}

export function Chat() {
  const { id } = useParams<{ id: string }>();
  const [convId, setConvId] = useState(() => crypto.randomUUID());

  // Mirror the backend's resolution chain (override → POC default → global
  // default) so the warning only shows when chat would actually fail.
  const { data: routing, isLoading: routingLoading } = useRouting(id);
  const agentProvider = resolveEffectiveProvider(routing, 'agent');

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-10rem)]">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-lg font-bold text-white">Chat</h1>
        <button
          onClick={() => setConvId(crypto.randomUUID())}
          className="text-sm px-3 py-1.5 rounded-lg border border-border text-gray-300 hover:bg-surface-overlay transition-colors"
        >
          New conversation
        </button>
      </div>

      {!routingLoading && !agentProvider && (
        <div className="rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-gray-400 flex items-center gap-2 flex-wrap shrink-0">
          <span>No LLM provider available — add one for this POC or set a global default.</span>
          <Link to={`/poc/${id}/llm`} className="text-blue-400 hover:text-blue-300 underline">
            LLM Settings →
          </Link>
          <Link to="/settings" className="text-blue-400 hover:text-blue-300 underline">
            Global Settings →
          </Link>
        </div>
      )}

      {id && (
        <div className="shrink-0">
          <RunConfig pocId={id} />
        </div>
      )}

      <div className="flex-1 min-h-0 rounded-xl border border-border bg-surface overflow-hidden">
        {id && <ChatRuntime key={convId} pocId={id} />}
      </div>
    </div>
  );
}
