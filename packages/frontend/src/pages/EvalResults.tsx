import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { EvalRun, EvalCaseCompleteEvent, EvalRunCompleteEvent } from '@proveit/shared';
import { api } from '../services/api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EvalResultCard } from '../components/eval/EvalResultCard';
import { RunProgress } from '../components/eval/RunProgress';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/Toast';

interface LiveResult {
  caseId: string;
  caseName?: string;
  status: 'running' | 'passed' | 'failed' | 'errored';
  score?: number;
  reasoning?: string;
  latencyMs?: number;
}

export function EvalResults() {
  const { id } = useParams<{ id: string }>();
  const [running, setRunning] = useState(false);
  const [liveResults, setLiveResults] = useState<LiveResult[]>([]);
  const [liveStats, setLiveStats] = useState({ passed: 0, failed: 0, total: 0 });
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
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
    queryFn: () => api.get(`/pocs/${id}/evals/runs/${selectedRunId}`),
    enabled: !!selectedRunId,
  });

  function connectToRun(runId: string, totalCases: number) {
    esRef.current?.close();
    const es = new EventSource(`/api/pocs/${id}/evals/run/${runId}/stream`);
    esRef.current = es;

    es.addEventListener('case-start', (e) => {
      const data = JSON.parse(e.data) as { caseId: string; name: string };
      setLiveResults((prev) => [
        ...prev.filter((r) => r.caseId !== data.caseId),
        { caseId: data.caseId, caseName: data.name, status: 'running' },
      ]);
      setLiveStats((s) => ({ ...s, total: Math.max(s.total, totalCases) }));
    });

    es.addEventListener('case-complete', (e) => {
      const data = JSON.parse(e.data) as EvalCaseCompleteEvent;
      setLiveResults((prev) =>
        prev.map((r) =>
          r.caseId === data.caseId
            ? { ...r, status: data.status as LiveResult['status'], score: data.score, reasoning: data.reasoning, latencyMs: data.latencyMs }
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

  // Auto-reconnect to any in-progress run after a page refresh
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

    const { runId, totalCases } = await api.post<{ runId: string; totalCases: number; status: string }>(
      `/pocs/${id}/evals/run`,
      {},
    );

    setLiveStats((s) => ({ ...s, total: totalCases }));
    connectToRun(runId, totalCases);
  }

  const completedLive = liveResults.filter((r) => r.status !== 'running').length;

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
              caseName={r.caseName ?? r.caseId}
              status={r.status}
              score={r.score}
              reasoning={r.reasoning}
              latencyMs={r.latencyMs}
              isNew={recentlyCompleted.has(r.caseId)}
            />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Past runs</h2>
        {!runs?.filter((r) => r.status !== 'running' && r.status !== 'pending').length ? (
          <EmptyState title="No runs yet" description="Click 'Run evals' to start." />
        ) : (
          <div className="flex flex-col gap-2">
            {runs.filter((run) => run.status !== 'running' && run.status !== 'pending').map((run) => (
              <button
                key={run.id}
                onClick={() => setSelectedRunId(selectedRunId === run.id ? null : run.id)}
                className="text-left bg-surface-raised border border-border rounded-xl p-4
                  hover:border-border/80 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative inline-flex items-center">
                      {(run.status === 'running' || run.status === 'pending') && (
                        <span className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-green-400 animate-ping opacity-75" />
                      )}
                      <Badge variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'error' : 'default'}>
                        {run.status}
                      </Badge>
                    </span>
                    <span className="text-sm text-gray-300">
                      {run.passedCases}/{run.totalCases} passed
                    </span>
                  </div>
                  <span className="text-xs text-muted">
                    {new Date(run.startedAt).toLocaleString()}
                  </span>
                </div>
                {selectedRunId === run.id && !!runDetail && (
                  <div className="mt-4 flex flex-col gap-2">
                    {((runDetail as { results: LiveResult[] }).results ?? []).map((r) => (
                      <EvalResultCard
                        key={r.caseId}
                        caseId={r.caseId}
                        caseName={(r as { caseName?: string }).caseName ?? r.caseId}
                        status={r.status}
                        score={r.score}
                        reasoning={r.reasoning}
                        latencyMs={r.latencyMs}
                      />
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
