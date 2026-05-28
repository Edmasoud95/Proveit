import { useRef, useEffect } from 'react';
import type { ScaffoldStep, ToolDefinition } from '@proveit/shared';

export type StepState = 'waiting' | 'in-progress' | 'complete' | 'error';

export interface StepStatus {
  id: ScaffoldStep;
  label: string;
  state: StepState;
}

interface Props {
  steps: StepStatus[];
  previewName: string | null;
  previewSystemPrompt: string | null;
  previewTools: ToolDefinition[] | null;
  previewEvalCases: Array<{ name: string; judgeCriteria: string }> | null;
  errorMessage: string | null;
  onRetry?: () => void;
}

function StepDot({ state, label }: { state: StepState; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
      <div className="relative flex items-center justify-center">
        {state === 'complete' && (
          <span className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
        {state === 'in-progress' && (
          <span className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        )}
        {state === 'error' && (
          <span className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}
        {state === 'waiting' && (
          <span className="w-8 h-8 rounded-full border border-white/15" />
        )}
      </div>
      <span
        className={`text-[11px] text-center leading-tight transition-colors duration-300 hidden sm:block ${
          state === 'complete' ? 'text-green-400' :
          state === 'in-progress' ? 'text-white font-medium' :
          state === 'error' ? 'text-red-400' :
          'text-gray-600'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function PreviewPanel({ title, children, isNew }: { title: string; children: React.ReactNode; isNew?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !isNew) return;
    el.classList.add('preview-new');
    const t = setTimeout(() => el.classList.remove('preview-new'), 2100);
    return () => clearTimeout(t);
  }, [isNew]);

  return (
    <div
      ref={ref}
      className="rounded-xl border border-white/10 bg-black/20 p-4"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500 mb-2">{title}</p>
      {children}
    </div>
  );
}

export function ScaffoldProgress({
  steps,
  previewName,
  previewSystemPrompt,
  previewTools,
  previewEvalCases,
  errorMessage,
  onRetry,
}: Props) {
  const prevPrompt = useRef<string | null>(null);
  const prevTools = useRef<ToolDefinition[] | null>(null);
  const prevEval = useRef<Array<{ name: string; judgeCriteria: string }> | null>(null);

  const promptIsNew = previewSystemPrompt !== null && prevPrompt.current === null;
  const toolsIsNew = previewTools !== null && prevTools.current === null;
  const evalIsNew = previewEvalCases !== null && prevEval.current === null;

  prevPrompt.current = previewSystemPrompt;
  prevTools.current = previewTools;
  prevEval.current = previewEvalCases;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Horizontal step strip */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4">
        <div className="flex items-start">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              <StepDot state={step.state} label={step.label} />
              {idx < steps.length - 1 && (
                <div
                  className="h-px mx-1 flex-1 transition-colors duration-700"
                  style={{
                    background: step.state === 'complete'
                      ? 'linear-gradient(90deg, rgba(34,197,94,0.5) 0%, rgba(34,197,94,0.2) 100%)'
                      : 'rgba(255,255,255,0.07)',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error box */}
      {errorMessage && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.08] px-4 py-3">
          <p className="text-sm text-amber-300">{errorMessage}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-sm font-medium hover:bg-amber-500/30 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Preview panels */}
      {(previewSystemPrompt || previewTools?.length || previewEvalCases?.length) && (
        <div className="flex flex-col gap-3">
          {previewSystemPrompt && (
            <PreviewPanel title="System Prompt" isNew={promptIsNew}>
              {previewName && (
                <p className="text-sm font-semibold text-white mb-2">{previewName}</p>
              )}
              <p className="text-[13px] text-gray-400 leading-relaxed line-clamp-3">
                {previewSystemPrompt}
              </p>
            </PreviewPanel>
          )}

          {previewTools && previewTools.length > 0 && (
            <PreviewPanel title={`Tools · ${previewTools.length}`} isNew={toolsIsNew}>
              <div className="flex flex-wrap gap-1.5">
                {previewTools.map((tool) => (
                  <span
                    key={tool.name}
                    className="text-[11px] font-mono text-accent/80 bg-accent/10 border border-accent/20 rounded-md px-2 py-0.5"
                  >
                    {tool.name}
                  </span>
                ))}
              </div>
            </PreviewPanel>
          )}

          {previewEvalCases && previewEvalCases.length > 0 && (
            <PreviewPanel title={`Eval Cases · ${previewEvalCases.length}`} isNew={evalIsNew}>
              <ol className="flex flex-col gap-1">
                {previewEvalCases.slice(0, 4).map((ec, i) => (
                  <li key={i} className="flex items-baseline gap-2">
                    <span className="text-[10px] text-gray-600 tabular-nums w-4 flex-shrink-0">{i + 1}.</span>
                    <span className="text-[13px] text-gray-400 truncate">{ec.name}</span>
                  </li>
                ))}
                {previewEvalCases.length > 4 && (
                  <li className="text-[11px] text-gray-600 ml-6">+{previewEvalCases.length - 4} more</li>
                )}
              </ol>
            </PreviewPanel>
          )}
        </div>
      )}
    </div>
  );
}
