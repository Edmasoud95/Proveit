import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { ToastProvider } from '../components/ui/Toast';
import { useEvalRunStream } from './useEvalRunStream';
import { api } from '../services/api';

// ─── EventSource stub ────────────────────────────────────────────────────────

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, Array<(e: MessageEvent) => void>>();
  closed = false;

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(type, [...existing, handler]);
  }

  emit(type: string, data: unknown) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  close() {
    this.closed = true;
  }
}

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.spyOn(api, 'post').mockResolvedValue({ runId: 'run-1', totalCases: 2, status: 'pending' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useEvalRunStream', () => {
  it('startRun opens a stream and accumulates live results', async () => {
    const refetch = vi.fn();
    const { result } = renderHook(() => useEvalRunStream('poc-1', [], refetch), { wrapper });

    await act(() => result.current.startRun());
    expect(result.current.running).toBe(true);

    const es = FakeEventSource.instances[0];
    expect(es.url).toBe('/api/pocs/poc-1/evals/run/run-1/stream');

    act(() => es.emit('case-start', { caseId: 'c1', name: 'first case' }));
    expect(result.current.liveResults).toHaveLength(1);
    expect(result.current.liveResults[0]).toMatchObject({ caseId: 'c1', status: 'running' });

    act(() =>
      es.emit('case-complete', {
        caseId: 'c1',
        caseName: 'first case',
        status: 'passed',
        score: 9,
        reasoning: 'good',
        rawResponse: 'hi',
        latencyMs: 100,
        pipelineTrace: null,
        failureStep: null,
        errorDetail: null,
        agentModel: 'm',
        agentProviderName: 'p',
        agentEndpointUrl: 'http://x',
        judgeModel: 'j',
        judgeProviderName: 'jp',
      }),
    );
    expect(result.current.liveResults[0]).toMatchObject({ status: 'passed', score: 9 });
    expect(result.current.liveStats).toMatchObject({ passed: 1, failed: 0 });

    act(() => es.emit('run-complete', { runId: 'run-1', passed: 1, failed: 1, total: 2 }));
    expect(result.current.running).toBe(false);
    expect(result.current.liveStats).toEqual({ passed: 1, failed: 1, total: 2 });
    expect(es.closed).toBe(true);
    expect(refetch).toHaveBeenCalled();
  });

  it('reconnects to an already-running run on mount', async () => {
    const activeRun = {
      id: 'run-9',
      status: 'running',
      passedCases: 1,
      failedCases: 0,
      totalCases: 3,
    } as never;
    const { result } = renderHook(() => useEvalRunStream('poc-1', [activeRun], vi.fn()), {
      wrapper,
    });

    await waitFor(() => expect(result.current.running).toBe(true));
    expect(FakeEventSource.instances[0].url).toBe('/api/pocs/poc-1/evals/run/run-9/stream');
    expect(result.current.liveStats).toEqual({ passed: 1, failed: 0, total: 3 });
  });

  it('stops and refetches when the stream errors', async () => {
    const refetch = vi.fn();
    const { result } = renderHook(() => useEvalRunStream('poc-1', [], refetch), { wrapper });
    await act(() => result.current.startRun());

    act(() => FakeEventSource.instances[0].emit('error', {}));
    expect(result.current.running).toBe(false);
    expect(refetch).toHaveBeenCalled();
  });
});
