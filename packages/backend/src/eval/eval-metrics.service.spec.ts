import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { EvalMetricsService } from './eval-metrics.service';

type ResultRow = {
  status: string;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

function serviceWithResults(results: ResultRow[]): EvalMetricsService {
  const prisma = {
    evalResult: { findMany: async () => results },
  } as unknown as PrismaService;
  return new EvalMetricsService(prisma);
}

const row = (over: Partial<ResultRow> = {}): ResultRow => ({
  status: 'passed',
  latencyMs: 1000,
  promptTokens: 100,
  completionTokens: 50,
  totalTokens: 150,
  ...over,
});

describe('EvalMetricsService.computeRunMetrics', () => {
  it('returns all-null metrics for a run with no results', async () => {
    const metrics = await serviceWithResults([]).computeRunMetrics('r1');
    expect(metrics).toEqual({
      accuracy: null,
      avgLatencyMs: null,
      avgPromptTokens: null,
      avgCompletionTokens: null,
      avgTotalTokens: null,
      tokensPerSecond: null,
      efficiencyScore: null,
    });
  });

  it('computes accuracy and averages', async () => {
    const metrics = await serviceWithResults([
      row(),
      row({ status: 'failed', latencyMs: 3000, totalTokens: 250 }),
    ]).computeRunMetrics('r1');
    expect(metrics.accuracy).toBe(0.5);
    expect(metrics.avgLatencyMs).toBe(2000);
    expect(metrics.avgTotalTokens).toBe(200);
    expect(metrics.tokensPerSecond).toBe(100); // 200 tokens / 2s
    expect(metrics.efficiencyScore).toBe(0.25); // 0.5 accuracy / 2s
  });

  it('ignores null latency/token values (errored cases) in the averages', async () => {
    const metrics = await serviceWithResults([
      row(),
      row({ status: 'errored', latencyMs: null, promptTokens: null, completionTokens: null, totalTokens: null }),
    ]).computeRunMetrics('r1');
    expect(metrics.accuracy).toBe(0.5); // errored still counts against accuracy
    expect(metrics.avgLatencyMs).toBe(1000); // but not in the latency average
    expect(metrics.avgTotalTokens).toBe(150);
  });
});

describe('EvalMetricsService.parsePipelineTrace', () => {
  const service = serviceWithResults([]);

  it('resolves tool names onto tool-response messages', () => {
    const trace = JSON.stringify([
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'c1', function: { name: 'get_weather', arguments: '{}' } }],
      },
      { role: 'tool', tool_call_id: 'c1', content: '{"temp":21}' },
      { role: 'assistant', content: 'done' },
    ]);
    const parsed = service.parsePipelineTrace(trace) as Array<Record<string, unknown>>;
    expect(parsed).toHaveLength(4);
    expect(parsed[1]).toMatchObject({
      role: 'assistant',
      toolCalls: [{ id: 'c1', name: 'get_weather', arguments: '{}' }],
    });
    expect(parsed[2]).toMatchObject({ role: 'tool', toolName: 'get_weather' });
  });

  it('returns null for malformed JSON', () => {
    expect(service.parsePipelineTrace('{nope')).toBeNull();
  });
});
