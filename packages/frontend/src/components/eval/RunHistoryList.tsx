import type { EvalRun, EvalRunDetail } from '@proveit/shared';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { EvalResultCard } from './EvalResultCard';

export function runLabel(run: EvalRun): string {
  return run.runNumber > 0 ? `Run #${run.runNumber}` : 'Legacy run';
}

function passRate(run: EvalRun): number {
  if (run.totalCases === 0) return 0;
  return Math.round((run.passedCases / run.totalCases) * 100);
}

interface VersionGroup {
  versionId: string | null;
  versionNumber: number | null;
  runs: EvalRun[];
}

function groupRunsByVersion(runs: EvalRun[]): VersionGroup[] {
  const map = new Map<string, VersionGroup>();
  const legacyKey = '__legacy__';

  for (const run of runs) {
    const key = run.evalSuiteVersionId ?? legacyKey;
    if (!map.has(key)) {
      map.set(key, {
        versionId: run.evalSuiteVersionId ?? null,
        versionNumber: run.evalSuiteVersionNumber ?? null,
        runs: [],
      });
    }
    map.get(key)!.runs.push(run);
  }

  // Sort groups: versioned first (descending versionNumber), then legacy
  const groups = Array.from(map.values());
  groups.sort((a, b) => {
    if (a.versionId === null) return 1;
    if (b.versionId === null) return -1;
    return (b.versionNumber ?? 0) - (a.versionNumber ?? 0);
  });

  return groups;
}

function RunDetail({ runDetail }: { runDetail: EvalRunDetail }) {
  return (
    <div className="px-4 pb-4 flex flex-col gap-2 border-t border-border pt-3">
      {(runDetail.snapshotSystemPrompt || runDetail.snapshotModel) && (
        <div className="mb-2 flex flex-col gap-2">
          {runDetail.snapshotSystemPrompt && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wide mb-1">System prompt at run time</p>
              <pre className="text-xs text-gray-400 bg-surface-overlay rounded-lg p-3 overflow-auto max-h-24 whitespace-pre-wrap">
                {runDetail.snapshotSystemPrompt}
              </pre>
            </div>
          )}
          {(runDetail.snapshotModel || runDetail.snapshotJudgeModel) && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wide mb-1">Models at run time</p>
              <div className="flex flex-col gap-1 text-xs">
                {runDetail.snapshotModel && (
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 w-10 shrink-0">Agent</span>
                    <span className="font-mono text-gray-300">{runDetail.snapshotModel}</span>
                    {runDetail.snapshotEndpointUrl && (
                      <span className="text-muted font-mono">{runDetail.snapshotEndpointUrl}</span>
                    )}
                  </div>
                )}
                {runDetail.snapshotJudgeModel && (
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 w-10 shrink-0">Judge</span>
                    {runDetail.snapshotJudgeProviderName && (
                      <span className="text-muted">{runDetail.snapshotJudgeProviderName} ·</span>
                    )}
                    <span className="font-mono text-gray-300">{runDetail.snapshotJudgeModel}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {runDetail.results.map((r) => (
        <EvalResultCard
          key={r.caseId}
          caseId={r.caseId}
          caseName={r.caseName}
          status={r.status}
          score={r.score}
          reasoning={r.reasoning}
          rawResponse={r.rawResponse}
          latencyMs={r.latencyMs}
          pipelineTrace={r.pipelineTrace}
          failureStep={r.failureStep}
          errorDetail={r.errorDetail}
          agentModel={runDetail.snapshotModel || null}
          agentEndpointUrl={runDetail.snapshotEndpointUrl || null}
          judgeModel={runDetail.snapshotJudgeModel || null}
          judgeProviderName={runDetail.snapshotJudgeProviderName || null}
        />
      ))}
    </div>
  );
}

interface RunHistoryListProps {
  runs: EvalRun[];
  runDetail: EvalRunDetail | undefined;
  selectedRunId: string | null;
  onSelectRun: (runId: string | null) => void;
  compareSelection: Set<string>;
  onToggleCompare: (runId: string) => void;
  comparing: boolean;
}

export function RunHistoryList({
  runs,
  runDetail,
  selectedRunId,
  onSelectRun,
  compareSelection,
  onToggleCompare,
  comparing,
}: RunHistoryListProps) {
  const versionGroups = groupRunsByVersion(runs);

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Past runs</h2>
      {runs.length === 0 ? (
        <EmptyState title="No runs yet" description="Click 'Run evals' to start." />
      ) : (
        versionGroups.map((group) => (
          <div key={group.versionId ?? 'legacy'} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-blue-400/80 bg-blue-900/20 border border-blue-700/30 rounded px-1.5 py-0.5">
                {group.versionNumber != null ? `v${group.versionNumber}` : 'Legacy'}
              </span>
              <span className="text-xs text-muted">{group.runs.length} run{group.runs.length !== 1 ? 's' : ''}</span>
            </div>
            {group.runs.map((run) => {
              const isSelected = compareSelection.has(run.id);

              return (
                <div
                  key={run.id}
                  className={`bg-surface-raised border rounded-xl transition-colors ${
                    isSelected ? 'border-blue-600' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleCompare(run.id)}
                      className="accent-blue-500 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      className="flex-1 flex items-center justify-between text-left"
                      onClick={() => {
                        if (!comparing) onSelectRun(selectedRunId === run.id ? null : run.id);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'error' : 'default'}>
                          {run.status}
                        </Badge>
                        <span className="text-sm text-gray-300 font-medium">{runLabel(run)}</span>
                        <span className="text-sm text-muted">{run.passedCases}/{run.totalCases} passed</span>
                        <span className="text-xs text-muted">({passRate(run)}%)</span>
                        {run.metrics?.efficiencyScore != null && (
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-amber-900/20 border border-amber-700/30 text-amber-300">
                            eff: {run.metrics.efficiencyScore.toFixed(2)}
                          </span>
                        )}
                        {run.snapshotConfigVersionNumber != null && (
                          <span className="text-xs font-mono text-amber-400/80 bg-amber-900/20 border border-amber-700/30 rounded px-1.5 py-0.5">
                            cfg v{run.snapshotConfigVersionNumber}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {run.snapshotModel && (
                          <span className="text-xs text-muted hidden sm:block">{run.snapshotModel}</span>
                        )}
                        <span className="text-xs text-muted">
                          {new Date(run.startedAt).toLocaleString()}
                        </span>
                        <span className="text-muted text-xs">{selectedRunId === run.id ? '▾' : '▸'}</span>
                      </div>
                    </button>
                  </div>

                  {selectedRunId === run.id && !!runDetail && <RunDetail runDetail={runDetail} />}
                </div>
              );
            })}
          </div>
        ))
      )}
    </section>
  );
}
