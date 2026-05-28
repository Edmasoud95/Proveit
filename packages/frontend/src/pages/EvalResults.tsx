import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type {
  EvalRun,
  EvalRunDetail,
  EvalCaseCompleteEvent,
  EvalRunCompleteEvent,
  EvalStepUpdateEvent,
  PipelineStep,
  FailureStep,
  CompareRunsResponse,
} from '@proveit/shared';
import { api } from '../services/api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EvalResultCard } from '../components/eval/EvalResultCard';
import { RunConfig } from '../components/eval/RunConfig';
import { RunProgress } from '../components/eval/RunProgress';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';
import { RunMetricsPanel } from '../components/eval/RunMetricsPanel';
import { EvalsEfficiencyPanel } from '../components/eval/EvalsEfficiencyPanel';
import { diffWords } from 'diff';

interface LiveResult {
  caseId: string;
  caseName: string;
  status: 'running' | 'passed' | 'failed' | 'errored';
  score: number | null;
  reasoning: string | null;
  rawResponse: string | null;
  latencyMs: number | null;
  pipelineTrace: PipelineStep[] | null;
  failureStep: FailureStep | null;
  errorDetail: string | null;
  agentModel: string | null;
  agentProviderName: string | null;
  agentEndpointUrl: string | null;
  judgeModel: string | null;
  judgeProviderName: string | null;
  currentStep: { step: 'agent' | 'judge'; model: string; providerName: string } | null;
}

function passRate(run: EvalRun): number {
  if (run.totalCases === 0) return 0;
  return Math.round((run.passedCases / run.totalCases) * 100);
}

function versionLabel(run: EvalRun): string {
  if (run.evalSuiteVersionNumber != null) return `v${run.evalSuiteVersionNumber}`;
  return 'v?';
}

function runLabel(run: EvalRun): string {
  return run.runNumber > 0 ? `Run #${run.runNumber}` : 'Legacy run';
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

export function EvalResults() {
  const { id } = useParams<{ id: string }>();
  const [running, setRunning] = useState(false);
  const [liveResults, setLiveResults] = useState<LiveResult[]>([]);
  const [liveStats, setLiveStats] = useState({ passed: 0, failed: 0, total: 0 });
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [compareSelection, setCompareSelection] = useState<Set<string>>(new Set());
  const [compareResult, setCompareResult] = useState<CompareRunsResponse | null>(null);
  const [comparing, setComparing] = useState(false);
  const [activeTab, setActiveTab] = useState<'runs' | 'efficiency'>('runs');
  const esRef = useRef<EventSource | null>(null);
  const reconnectedRef = useRef(false);
  const { toast } = useToast();

  const { data: runs, refetch: refetchRuns } = useQuery({
    queryKey: ['eval-runs', id],
    queryFn: () => api.get<EvalRun[]>(`/pocs/${id}/evals/runs`),
    enabled: !!id,
  });

  const { data: runDetail } = useQuery({
    queryKey: ['eval-run-detail', selectedRunId],
    queryFn: () => api.get<EvalRunDetail>(`/pocs/${id}/evals/runs/${selectedRunId}`),
    enabled: !!selectedRunId && !comparing,
  });

  function connectToRun(runId: string, totalCases: number) {
    esRef.current?.close();
    const es = new EventSource(`/api/pocs/${id}/evals/run/${runId}/stream`);
    esRef.current = es;

    es.addEventListener('case-start', (e) => {
      const data = JSON.parse(e.data) as { caseId: string; name: string };
      setLiveResults((prev) => [
        ...prev.filter((r) => r.caseId !== data.caseId),
        {
          caseId: data.caseId,
          caseName: data.name,
          status: 'running',
          score: null,
          reasoning: null,
          rawResponse: null,
          latencyMs: null,
          pipelineTrace: null,
          failureStep: null,
          errorDetail: null,
          agentModel: null,
          agentProviderName: null,
          agentEndpointUrl: null,
          judgeModel: null,
          judgeProviderName: null,
          currentStep: null,
        },
      ]);
      setLiveStats((s) => ({ ...s, total: Math.max(s.total, totalCases) }));
    });

    es.addEventListener('step-update', (e) => {
      const data = JSON.parse(e.data) as EvalStepUpdateEvent;
      setLiveResults((prev) =>
        prev.map((r) =>
          r.caseId === data.caseId
            ? {
                ...r,
                currentStep: { step: data.step, model: data.model, providerName: data.providerName },
                ...(data.step === 'agent' && {
                  agentModel: data.model,
                  agentProviderName: data.providerName,
                  agentEndpointUrl: data.endpointUrl ?? null,
                }),
              }
            : r,
        ),
      );
    });

    es.addEventListener('case-complete', (e) => {
      const data = JSON.parse(e.data) as EvalCaseCompleteEvent;
      setLiveResults((prev) =>
        prev.map((r) =>
          r.caseId === data.caseId
            ? {
                ...r,
                status: data.status as LiveResult['status'],
                score: data.score,
                reasoning: data.reasoning,
                rawResponse: data.rawResponse,
                latencyMs: data.latencyMs,
                pipelineTrace: data.pipelineTrace,
                failureStep: data.failureStep,
                errorDetail: data.errorDetail,
                agentModel: data.agentModel ?? null,
                agentProviderName: data.agentProviderName ?? null,
                agentEndpointUrl: data.agentEndpointUrl ?? null,
                judgeModel: data.judgeModel,
                judgeProviderName: data.judgeProviderName,
                currentStep: null,
              }
            : r,
        ),
      );
      setLiveStats((s) => ({
        ...s,
        passed: s.passed + (data.status === 'passed' ? 1 : 0),
        failed: s.failed + (data.status !== 'passed' ? 1 : 0),
      }));
      setRecentlyCompleted((prev) => new Set(prev).add(data.caseId));
      setTimeout(() => {
        setRecentlyCompleted((prev) => {
          const next = new Set(prev);
          next.delete(data.caseId);
          return next;
        });
      }, 900);
    });

    es.addEventListener('run-complete', (e) => {
      const data = JSON.parse(e.data) as EvalRunCompleteEvent;
      setLiveStats({ passed: data.passed, failed: data.failed, total: data.total });
      setRunning(false);
      es.close();
      refetchRuns();
    });

    es.addEventListener('error', () => {
      setRunning(false);
      es.close();
      refetchRuns();
      toast('Eval run was interrupted — the backend may have restarted', 'error');
    });
  }

  useEffect(() => {
    if (!runs || running || reconnectedRef.current) return;
    const activeRun = runs.find((r) => r.status === 'running' || r.status === 'pending');
    if (!activeRun) return;

    reconnectedRef.current = true;
    setRunning(true);
    setLiveStats({
      passed: activeRun.passedCases,
      failed: activeRun.failedCases,
      total: activeRun.totalCases,
    });
    connectToRun(activeRun.id, activeRun.totalCases);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs]);

  useEffect(() => () => esRef.current?.close(), []);

  async function startRun() {
    setRunning(true);
    setLiveResults([]);
    setLiveStats({ passed: 0, failed: 0, total: 0 });
    setCompareResult(null);
    setCompareSelection(new Set());

    const { runId, totalCases } = await api.post<{ runId: string; totalCases: number; status: string }>(
      `/pocs/${id}/evals/run`,
      {},
    );

    setLiveStats((s) => ({ ...s, total: totalCases }));
    connectToRun(runId, totalCases);
  }

  function toggleCompareSelection(runId: string) {
    setCompareSelection((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
        return next;
      }
      if (next.size >= 2) {
        toast('Select exactly two runs to compare.', 'error');
        return prev;
      }
      next.add(runId);
      return next;
    });
    setCompareResult(null);
  }

  async function runComparison() {
    const [runAId, runBId] = [...compareSelection];
    if (!runAId || !runBId || !id) return;
    setComparing(true);
    try {
      const result = await api.get<CompareRunsResponse>(
        `/pocs/${id}/evals/compare?runA=${runAId}&runB=${runBId}`,
      );
      setCompareResult(result);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Comparison failed';
      toast(msg, 'error');
    } finally {
      setComparing(false);
    }
  }

  const completedLive = liveResults.filter((r) => r.status !== 'running').length;
  const pastRuns = runs?.filter((r) => r.status !== 'running' && r.status !== 'pending') ?? [];
  const versionGroups = groupRunsByVersion(pastRuns);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Eval Results</h1>
          <p className="text-sm text-muted mt-0.5">Run your eval cases against the connected LLM.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/poc/${id}`}
            className="text-sm text-muted hover:text-gray-300 transition-colors"
          >
            ← Edit config
          </Link>
          <Button onClick={startRun} loading={running} disabled={running}>
            {running ? 'Running…' : 'Run evals'}
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-white/10 -mt-2">
        {(['runs', 'efficiency'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab === 'runs' ? 'Runs' : 'Efficiency'}
          </button>
        ))}
      </div>

      {activeTab === 'efficiency' && (
        <EvalsEfficiencyPanel runs={pastRuns} />
      )}

      {activeTab === 'runs' && (
      <>
      {!running && <RunConfig pocId={id!} />}

      {running && (
        <Card>
          <RunProgress
            completed={completedLive}
            total={liveStats.total}
            passed={liveStats.passed}
            failed={liveStats.failed}
          />
        </Card>
      )}

      {liveResults.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-sm font-medium text-gray-400 uppercase tracking-wide">
            Current run
            {running && (
              <span className="flex items-center gap-1.5 text-xs normal-case font-normal text-green-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                Running
              </span>
            )}
          </h2>
          {liveResults.map((r) => (
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
              isNew={recentlyCompleted.has(r.caseId)}
              agentModel={r.agentModel}
              agentProviderName={r.agentProviderName}
              agentEndpointUrl={r.agentEndpointUrl}
              judgeModel={r.judgeModel}
              judgeProviderName={r.judgeProviderName}
              currentStep={r.currentStep}
            />
          ))}
        </section>
      )}

      {/* Comparison controls */}
      {compareSelection.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-900/20 border border-blue-700/40 rounded-lg px-4 py-3">
          <span className="text-sm text-blue-300">
            {compareSelection.size === 1 ? 'Select one more run to compare' : '2 runs selected'}
          </span>
          {compareSelection.size === 2 && (
            <Button
              onClick={runComparison}
              loading={comparing}
              disabled={comparing}
            >
              Compare
            </Button>
          )}
          <button
            className="text-xs text-muted hover:text-gray-300 ml-auto"
            onClick={() => { setCompareSelection(new Set()); setCompareResult(null); }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Comparison result */}
      {compareResult && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
            {runLabel(compareResult.runA)} vs {runLabel(compareResult.runB)}
          </h2>

          {/* What changed between the two runs */}
          <RunDiffHeader runA={compareResult.runA} runB={compareResult.runB} />

          {/* Per-run metrics */}
          <div className="grid grid-cols-2 gap-3">
            <RunMetricsPanel metrics={compareResult.runAMetrics} label={runLabel(compareResult.runA)} />
            <RunMetricsPanel metrics={compareResult.runBMetrics} label={runLabel(compareResult.runB)} />
          </div>

          {/* Case-by-case table */}
          <div className="bg-surface-raised border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-2">Case</th>
                  <th className="text-center px-4 py-2">{runLabel(compareResult.runA)}</th>
                  <th className="text-center px-4 py-2">{runLabel(compareResult.runB)}</th>
                  <th className="text-center px-4 py-2">Change</th>
                </tr>
              </thead>
              <tbody>
                {compareResult.cases.map((c) => (
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
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Past runs</h2>
        {pastRuns.length === 0 ? (
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
                        onChange={() => toggleCompareSelection(run.id)}
                        className="accent-blue-500 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        className="flex-1 flex items-center justify-between text-left"
                        onClick={() => {
                          if (!comparing) setSelectedRunId(selectedRunId === run.id ? null : run.id);
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

                    {selectedRunId === run.id && !!runDetail && (
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
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </section>
      </>
      )}
    </div>
  );
}

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
