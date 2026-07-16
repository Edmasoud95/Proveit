import { useState, useEffect, useRef } from 'react';
import type {
  EvalRun,
  EvalCaseStartEvent,
  EvalCaseCompleteEvent,
  EvalRunCompleteEvent,
  EvalStepUpdateEvent,
  EvalSseEvent,
  PipelineStep,
  FailureStep,
} from '@proveit/shared';
import { api } from '../services/api';
import { useToast } from '../components/ui/Toast';

export interface LiveResult {
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

export interface LiveStats {
  passed: number;
  failed: number;
  total: number;
}

function addJsonListener<T>(
  es: EventSource,
  type: EvalSseEvent['type'],
  handler: (data: T) => void,
) {
  es.addEventListener(type, (e) => handler(JSON.parse((e as MessageEvent).data) as T));
}

/**
 * Owns the SSE consumption for an eval run: starting runs, reconnecting to an
 * in-flight run on mount, and accumulating live per-case results.
 */
export function useEvalRunStream(
  pocId: string | undefined,
  runs: EvalRun[] | undefined,
  refetchRuns: () => void,
) {
  const [running, setRunning] = useState(false);
  const [liveResults, setLiveResults] = useState<LiveResult[]>([]);
  const [liveStats, setLiveStats] = useState<LiveStats>({ passed: 0, failed: 0, total: 0 });
  const [recentlyCompleted, setRecentlyCompleted] = useState<Set<string>>(new Set());
  const esRef = useRef<EventSource | null>(null);
  const reconnectedRef = useRef(false);
  const { toast } = useToast();

  function connectToRun(runId: string, totalCases: number) {
    esRef.current?.close();
    const es = new EventSource(`/api/pocs/${pocId}/evals/run/${runId}/stream`);
    esRef.current = es;

    addJsonListener<EvalCaseStartEvent>(es, 'case-start', (data) => {
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

    addJsonListener<EvalStepUpdateEvent>(es, 'step-update', (data) => {
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

    addJsonListener<EvalCaseCompleteEvent>(es, 'case-complete', (data) => {
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

    addJsonListener<EvalRunCompleteEvent>(es, 'run-complete', (data) => {
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

    const { runId, totalCases } = await api.post<{ runId: string; totalCases: number; status: string }>(
      `/pocs/${pocId}/evals/run`,
      {},
    );

    setLiveStats((s) => ({ ...s, total: totalCases }));
    connectToRun(runId, totalCases);
  }

  return { running, liveResults, liveStats, recentlyCompleted, startRun };
}
