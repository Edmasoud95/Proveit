import { useEffect, useState, type ReactNode } from 'react';
import { MessagePrimitive, ErrorPrimitive, useMessage, useThread, groupPartByType } from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';

const chainGroupBy = groupPartByType({
  reasoning: ['group-chainOfThought', 'group-reasoning'],
  'tool-call': ['group-chainOfThought', 'group-tool'],
});

// ── Reasoning block ────────────────────────────────────────────────────────

function ReasoningBlock({ children }: { children: ReactNode }) {
  const { isRunning } = useThread();
  const isStreaming = isRunning;
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (!isStreaming) {
      const t = setTimeout(() => setIsOpen(false), 700);
      return () => clearTimeout(t);
    }
  }, [isStreaming]);

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 text-xs text-muted hover:text-gray-300 transition-colors group"
      >
        {isStreaming ? (
          <span className="block h-1.5 w-1.5 rounded-full bg-accent animate-pulse flex-shrink-0" />
        ) : (
          <span className="block h-1.5 w-1.5 rounded-full bg-muted/40 flex-shrink-0 group-hover:bg-muted/60 transition-colors" />
        )}
        <span className="font-medium tracking-wide">
          {isStreaming ? 'Thinking…' : 'Reasoning'}
        </span>
        <span
          className="text-muted/50 transition-transform duration-200 inline-block"
          style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
        >
          ▾
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 ml-3.5 pl-3 border-l border-border/60 text-gray-500 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Tool call card ─────────────────────────────────────────────────────────

interface ToolCallCardProps {
  toolName: string;
  args: Record<string, unknown>;
  argsText: string;
  result: unknown;
  status: { type: string };
}

function ToolCallCard({ toolName, argsText, result, status }: ToolCallCardProps) {
  const isRunning = result === undefined && status?.type !== 'complete';
  const displayArgs = argsText && argsText !== '{}' ? argsText : null;
  const displayResult =
    result != null ? (typeof result === 'string' ? result : JSON.stringify(result, null, 2)) : null;
  const hasBody = displayArgs || displayResult || isRunning;

  return (
    <div className="my-1.5 rounded-lg border border-border bg-surface-raised text-xs overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-muted/50">⚙</span>
        <span className="font-mono font-medium text-gray-300 flex-1">{toolName}</span>
        {isRunning ? (
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse flex-shrink-0" />
        ) : (
          <span className="text-green-500 text-[10px] flex-shrink-0">✓</span>
        )}
      </div>

      {hasBody && (
        <div className="border-t border-border/60 px-3 py-2.5 space-y-2.5">
          {displayArgs && (
            <div>
              <p className="text-muted/60 uppercase tracking-widest text-[9px] mb-1.5 font-semibold">
                Input
              </p>
              <pre className="text-gray-400 font-mono text-[11px] whitespace-pre-wrap overflow-auto max-h-36 leading-relaxed">
                {displayArgs}
              </pre>
            </div>
          )}
          {displayResult != null ? (
            <div>
              <p className="text-muted/60 uppercase tracking-widest text-[9px] mb-1.5 font-semibold">
                Output
              </p>
              <pre className="text-gray-400 font-mono text-[11px] whitespace-pre-wrap overflow-auto max-h-36 leading-relaxed">
                {displayResult}
              </pre>
            </div>
          ) : (
            isRunning && (
              <p className="text-muted/60 italic text-[11px]">Running…</p>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ── Error block (only rendered when message has error status) ─────────────

function MessageErrorBlock() {
  const { status } = useMessage();
  if (status?.type !== 'incomplete') return null;
  return (
    <div className="mt-2 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-400">
      <ErrorPrimitive.Root asChild>
        <ErrorPrimitive.Message />
      </ErrorPrimitive.Root>
    </div>
  );
}

// ── Assistant message ──────────────────────────────────────────────────────

export function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-start my-4">
      <div className="text-gray-200 max-w-[85%] min-w-0 text-sm">
        <MessagePrimitive.GroupedParts groupBy={chainGroupBy}>
          {({ part, children }) => {
            switch (part.type) {
              case 'group-chainOfThought':
                return (
                  <ReasoningBlock>{children}</ReasoningBlock>
                );

              case 'group-reasoning':
                return <>{children}</>;

              case 'group-tool':
                return <div className="space-y-0.5">{children}</div>;

              case 'reasoning':
                return (
                  <span>{(part as unknown as { text: string }).text}</span>
                );

              case 'text':
                return (
                  <MarkdownTextPrimitive className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" />
                );

              case 'tool-call': {
                const tc = part as unknown as {
                  toolName: string;
                  args: Record<string, unknown>;
                  argsText: string;
                  result: unknown;
                  status: { type: string };
                };
                return (
                  <ToolCallCard
                    toolName={tc.toolName}
                    args={tc.args}
                    argsText={tc.argsText}
                    result={tc.result}
                    status={tc.status}
                  />
                );
              }

              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>

        <MessageErrorBlock />
      </div>
    </MessagePrimitive.Root>
  );
}
