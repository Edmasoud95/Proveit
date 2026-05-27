import type { PipelineStep, FailureStep } from '@proveit/shared';

interface PipelineTraceProps {
  steps: PipelineStep[];
  failureStep?: FailureStep | null;
}

const FAILURE_LABELS: Record<FailureStep, string> = {
  wrong_tool: 'wrong tool',
  wrong_arguments: 'wrong arguments',
  wrong_final_response: 'wrong final response',
};

export function PipelineTrace({ steps, failureStep }: PipelineTraceProps) {
  // Find the last assistant message's tool calls (for failure annotation)
  const failureToolCallId: string | null =
    failureStep === 'wrong_arguments' || failureStep === 'wrong_tool'
      ? (() => {
          for (let i = steps.length - 1; i >= 0; i--) {
            const s = steps[i];
            if (s.role === 'assistant' && s.toolCalls?.length) {
              return s.toolCalls[s.toolCalls.length - 1].id;
            }
          }
          return null;
        })()
      : null;

  let toolIndex = 0;

  return (
    <div className="flex flex-col gap-2 text-xs font-mono">
      {steps.map((step, i) => {
        if (step.role === 'user') {
          return (
            <div key={i} className="flex gap-2">
              <span className="shrink-0 text-muted w-16 pt-0.5">user</span>
              <span className="text-gray-300 break-all">{step.content}</span>
            </div>
          );
        }

        if (step.role === 'assistant') {
          if (step.toolCalls?.length) {
            return (
              <div key={i} className="flex flex-col gap-1">
                {step.toolCalls.map((tc) => {
                  toolIndex += 1;
                  const isFailStep = tc.id === failureToolCallId;
                  let args: unknown;
                  try { args = JSON.parse(tc.arguments); } catch { args = tc.arguments; }
                  return (
                    <div
                      key={tc.id}
                      className={`rounded-md px-3 py-2 ${isFailStep ? 'bg-red-900/20 border border-red-700/40' : 'bg-surface-overlay border border-border'}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-blue-400">Step {toolIndex} &nbsp;{tc.name}</span>
                        {isFailStep && failureStep && (
                          <span className="text-red-400 text-[10px] uppercase tracking-wide">
                            ← failure: {FAILURE_LABELS[failureStep]}
                          </span>
                        )}
                      </div>
                      <div className="text-muted text-[10px] mb-0.5">Arguments</div>
                      <pre className="text-gray-300 text-[11px] whitespace-pre-wrap break-all">
                        {JSON.stringify(args, null, 2)}
                      </pre>
                    </div>
                  );
                })}
                {step.content && (
                  <div className="flex gap-2 pl-1">
                    <span className="shrink-0 text-muted w-16 pt-0.5">text</span>
                    <span className="text-gray-400 italic">{step.content}</span>
                  </div>
                )}
              </div>
            );
          }
          return (
            <div key={i} className="flex gap-2">
              <span className="shrink-0 text-muted w-16 pt-0.5">final</span>
              <span
                className={`break-all ${failureStep === 'wrong_final_response' ? 'text-red-300' : 'text-gray-300'}`}
              >
                {step.content ?? '(empty)'}
                {failureStep === 'wrong_final_response' && (
                  <span className="ml-2 text-red-400 text-[10px] uppercase tracking-wide">← failure</span>
                )}
              </span>
            </div>
          );
        }

        if (step.role === 'tool') {
          let content: unknown;
          try { content = JSON.parse(step.content); } catch { content = step.content; }
          return (
            <div key={i} className="pl-4 border-l-2 border-border flex flex-col gap-0.5">
              <span className="text-muted text-[10px]">{step.toolName} response</span>
              <pre className="text-gray-400 text-[11px] whitespace-pre-wrap break-all">
                {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
              </pre>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
