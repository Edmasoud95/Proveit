import { useState } from 'react';
import type { CompareRunsResponse, EvalRun } from '@proveit/shared';
import { diffWords } from 'diff';
import { RunMetricsPanel } from './RunMetricsPanel';
import { runLabel } from './RunHistoryList';

function StatusDot({ status }: { status: string }) {
  if (status === 'passed') return <span className="text-green-400">✓</span>;
  if (status === 'not_executed') return <span className="text-muted">—</span>;
  return <span className="text-red-400">✗</span>;
}

function ChangeBadge({ change }: { change: string }) {
  if (change === 'improved') return <span className="text-green-400 text-xs font-medium">better</span>;
  if (change === 'regressed') return <span className="text-red-400 text-xs font-medium">worse</span>;
  if (change === 'both_passed') return <span className="text-muted text-xs">—</span>;
  return <span className="text-muted text-xs">both failed</span>;
}

function DiffRow({ label, a, b, highlight }: { label: string; a: string; b: string; highlight: boolean }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-gray-500 w-24 shrink-0 pt-0.5">{label}</span>
      <div className="flex-1 flex items-start gap-2">
        <span className={`flex-1 font-mono ${highlight ? 'text-amber-300' : 'text-gray-300'}`}>{a}</span>
        <span className="text-gray-600 pt-0.5">→</span>
        <span className={`flex-1 font-mono ${highlight ? 'text-amber-300' : 'text-gray-300'}`}>{b}</span>
      </div>
    </div>
  );
}

function PromptDiff({ textA, textB, labelA, labelB }: { textA: string; textB: string; labelA: string; labelB: string }) {
  const parts = diffWords(textA, textB);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-gray-400">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500/40 border border-red-500/60" />
          {labelA}
        </span>
        <span className="flex items-center gap-1.5 text-gray-400">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500/40 border border-green-500/60" />
          {labelB}
        </span>
      </div>
      <pre className="text-xs font-mono leading-relaxed bg-black/30 rounded p-3 whitespace-pre-wrap overflow-auto max-h-72">
        {parts.map((part, i) => {
          if (part.removed) {
            return (
              <mark key={i} className="bg-red-500/25 text-red-200 rounded-sm not-italic">
                {part.value}
              </mark>
            );
          }
          if (part.added) {
            return (
              <mark key={i} className="bg-green-500/25 text-green-200 rounded-sm not-italic">
                {part.value}
              </mark>
            );
          }
          return <span key={i} className="text-gray-300">{part.value}</span>;
        })}
      </pre>
    </div>
  );
}

function PromptBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-400">{label}</span>
      <pre className="text-xs text-gray-300 bg-black/30 rounded p-2.5 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-48">
        {text}
      </pre>
    </div>
  );
}

function RunDiffHeader({ runA, runB }: { runA: EvalRun; runB: EvalRun }) {
  const [showPrompts, setShowPrompts] = useState(false);

  const modelChanged = runA.snapshotModel !== runB.snapshotModel;
  const cfgChanged =
    runA.snapshotConfigVersionNumber != null &&
    runB.snapshotConfigVersionNumber != null &&
    runA.snapshotConfigVersionNumber !== runB.snapshotConfigVersionNumber;
  const endpointChanged = runA.snapshotEndpointUrl !== runB.snapshotEndpointUrl;
  const promptA = runA.snapshotSystemPrompt ?? '';
  const promptB = runB.snapshotSystemPrompt ?? '';
  const promptChanged = promptA !== promptB;

  const hasDiff = modelChanged || cfgChanged || endpointChanged;

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">What changed</span>
        {(promptA || promptB) && (
          <button
            onClick={() => setShowPrompts((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showPrompts ? 'Hide prompt' : 'Show prompt'}
          </button>
        )}
      </div>
      {!hasDiff && (
        <p className="text-xs text-gray-500">Same model, endpoint, and config version — only eval case results differ.</p>
      )}
      {modelChanged && (
        <DiffRow label="Model" a={runA.snapshotModel} b={runB.snapshotModel} highlight={true} />
      )}
      {cfgChanged && (
        <DiffRow
          label="Prompt version"
          a={`cfg v${runA.snapshotConfigVersionNumber}`}
          b={`cfg v${runB.snapshotConfigVersionNumber}`}
          highlight={true}
        />
      )}
      {endpointChanged && (
        <DiffRow label="Endpoint" a={runA.snapshotEndpointUrl} b={runB.snapshotEndpointUrl} highlight={false} />
      )}
      {!modelChanged && (
        <DiffRow label="Model" a={runA.snapshotModel} b={runB.snapshotModel} highlight={false} />
      )}
      {showPrompts && (promptA || promptB) && (
        <div className="mt-1">
          {promptChanged ? (
            <PromptDiff
              textA={promptA || '(none)'}
              textB={promptB || '(none)'}
              labelA={`Run #${runA.runNumber}`}
              labelB={`Run #${runB.runNumber}`}
            />
          ) : (
            <PromptBlock label="Prompt (same for both runs)" text={promptA || '(none)'} />
          )}
        </div>
      )}
    </div>
  );
}

export function RunComparison({ result }: { result: CompareRunsResponse }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
        {runLabel(result.runA)} vs {runLabel(result.runB)}
      </h2>

      {/* What changed between the two runs */}
      <RunDiffHeader runA={result.runA} runB={result.runB} />

      {/* Per-run metrics */}
      <div className="grid grid-cols-2 gap-3">
        <RunMetricsPanel metrics={result.runAMetrics} label={runLabel(result.runA)} />
        <RunMetricsPanel metrics={result.runBMetrics} label={runLabel(result.runB)} />
      </div>

      {/* Case-by-case table */}
      <div className="bg-surface-raised border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-2">Case</th>
              <th className="text-center px-4 py-2">{runLabel(result.runA)}</th>
              <th className="text-center px-4 py-2">{runLabel(result.runB)}</th>
              <th className="text-center px-4 py-2">Change</th>
            </tr>
          </thead>
          <tbody>
            {result.cases.map((c) => (
              <tr key={c.caseId} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-gray-300">{c.caseName}</td>
                <td className="px-4 py-2 text-center">
                  <StatusDot status={c.runAStatus} />
                </td>
                <td className="px-4 py-2 text-center">
                  <StatusDot status={c.runBStatus} />
                </td>
                <td className="px-4 py-2 text-center">
                  <ChangeBadge change={c.change} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
