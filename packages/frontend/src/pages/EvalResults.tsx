import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { EvalRun, EvalRunDetail, CompareRunsResponse } from '@proveit/shared';
import { api } from '../services/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useToast } from '../components/ui/Toast';
import { RunConfig } from '../components/eval/RunConfig';
import { RunProgress } from '../components/eval/RunProgress';
import { EvalsEfficiencyPanel } from '../components/eval/EvalsEfficiencyPanel';
import { LiveResultsSection } from '../components/eval/LiveResultsSection';
import { RunComparison } from '../components/eval/RunComparison';
import { RunHistoryList } from '../components/eval/RunHistoryList';
import { useEvalRunStream } from '../hooks/useEvalRunStream';

export function EvalResults() {
  const { id } = useParams<{ id: string }>();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [compareSelection, setCompareSelection] = useState<Set<string>>(new Set());
  const [compareResult, setCompareResult] = useState<CompareRunsResponse | null>(null);
  const [comparing, setComparing] = useState(false);
  const [activeTab, setActiveTab] = useState<'runs' | 'efficiency'>('runs');
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

  const { running, liveResults, liveStats, recentlyCompleted, startRun } = useEvalRunStream(
    id,
    runs,
    refetchRuns,
  );

  async function handleStartRun() {
    setCompareResult(null);
    setCompareSelection(new Set());
    await startRun();
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
          <Button onClick={handleStartRun} loading={running} disabled={running}>
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

      <LiveResultsSection results={liveResults} running={running} recentlyCompleted={recentlyCompleted} />

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
      {compareResult && <RunComparison result={compareResult} />}

      <RunHistoryList
        runs={pastRuns}
        runDetail={runDetail}
        selectedRunId={selectedRunId}
        onSelectRun={setSelectedRunId}
        compareSelection={compareSelection}
        onToggleCompare={toggleCompareSelection}
        comparing={comparing}
      />
      </>
      )}
    </div>
  );
}
