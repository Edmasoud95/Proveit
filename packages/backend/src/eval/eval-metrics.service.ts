import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RunMetrics } from '@proveit/shared';

/** Aggregates eval results into metrics and run-vs-run comparisons. */
@Injectable()
export class EvalMetricsService {
  constructor(private prisma: PrismaService) {}

  async computeRunMetrics(runId: string): Promise<RunMetrics> {
    const results = await this.prisma.evalResult.findMany({ where: { runId } });
    const total = results.length;
    if (total === 0) {
      return { accuracy: null, avgLatencyMs: null, avgPromptTokens: null, avgCompletionTokens: null, avgTotalTokens: null, tokensPerSecond: null, efficiencyScore: null };
    }

    const passed = results.filter((r) => r.status === 'passed').length;
    const accuracy = passed / total;

    const avg = (values: Array<number | null>): number | null => {
      const present = values.filter((v): v is number => v != null);
      return present.length > 0 ? present.reduce((a, b) => a + b, 0) / present.length : null;
    };

    const avgLatencyMs = avg(results.map((r) => r.latencyMs));
    const avgPromptTokens = avg(results.map((r) => r.promptTokens));
    const avgCompletionTokens = avg(results.map((r) => r.completionTokens));
    const avgTotalTokens = avg(results.map((r) => r.totalTokens));

    const tokensPerSecond =
      avgTotalTokens != null && avgLatencyMs != null && avgLatencyMs > 0
        ? avgTotalTokens / (avgLatencyMs / 1000)
        : null;

    const efficiencyScore =
      avgLatencyMs != null && avgLatencyMs > 0 ? accuracy / (avgLatencyMs / 1000) : null;

    return { accuracy, avgLatencyMs, avgPromptTokens, avgCompletionTokens, avgTotalTokens, tokensPerSecond, efficiencyScore };
  }

  async compareRuns(pocId: string, runAId: string, runBId: string) {
    if (runAId === runBId) throw new BadRequestException('Cannot compare a run with itself');

    const [runA, runB] = await Promise.all([
      this.prisma.evalRun.findFirst({
        where: { id: runAId, pocConfigId: pocId },
        include: {
          results: true,
          evalSuiteVersion: { select: { versionNumber: true } },
        },
      }),
      this.prisma.evalRun.findFirst({
        where: { id: runBId, pocConfigId: pocId },
        include: {
          results: true,
          evalSuiteVersion: { select: { versionNumber: true } },
        },
      }),
    ]);

    if (!runA) throw new NotFoundException(`Run ${runAId} not found`);
    if (!runB) throw new NotFoundException(`Run ${runBId} not found`);

    // Get all cases for this POC to build the full case list
    const allCases = await this.prisma.evalCase.findMany({
      where: { pocConfigId: pocId },
      orderBy: { order: 'asc' },
    });

    const mapResults = (run: typeof runA) =>
      new Map(run.results.map((r) => [r.evalCaseId, r.status]));

    const aMap = mapResults(runA);
    const bMap = mapResults(runB);

    const isPassing = (s: string | undefined) => s === 'passed';
    const isFailing = (s: string | undefined) => !s || s !== 'passed';

    const cases = allCases.map((c) => {
      const aStatus = (aMap.get(c.id) ?? 'not_executed') as string;
      const bStatus = (bMap.get(c.id) ?? 'not_executed') as string;

      let change: 'improved' | 'regressed' | 'both_passed' | 'both_failed';
      if (isPassing(aStatus) && isPassing(bStatus)) change = 'both_passed';
      else if (isFailing(aStatus) && isFailing(bStatus)) change = 'both_failed';
      else if (isPassing(aStatus) && isFailing(bStatus)) change = 'regressed';
      else change = 'improved';

      return { caseId: c.id, caseName: c.name, runAStatus: aStatus, runBStatus: bStatus, change };
    });

    const toSummary = (run: typeof runA) => ({
      id: run.id,
      pocConfigId: run.pocConfigId,
      status: run.status,
      totalCases: run.totalCases,
      passedCases: run.passedCases,
      failedCases: run.failedCases,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
      runNumber: run.runNumber,
      evalSuiteVersionId: run.evalSuiteVersionId ?? null,
      evalSuiteVersionNumber: run.evalSuiteVersion?.versionNumber ?? null,
      configVersionId: run.configVersionId ?? null,
      snapshotConfigVersionNumber: run.snapshotConfigVersionNumber ?? null,
      snapshotSystemPrompt: run.snapshotSystemPrompt ?? null,
      snapshotModel: run.snapshotModel,
      snapshotEndpointUrl: run.snapshotEndpointUrl,
      snapshotJudgeModel: run.snapshotJudgeModel,
      snapshotJudgeProviderName: run.snapshotJudgeProviderName,
    });

    const [runAMetrics, runBMetrics] = await Promise.all([
      this.computeRunMetrics(runA.id),
      this.computeRunMetrics(runB.id),
    ]);

    return { runA: toSummary(runA), runB: toSummary(runB), runAMetrics, runBMetrics, cases };
  }

  parsePipelineTrace(traceJson: string): unknown[] | null {
    try {
      const raw = JSON.parse(traceJson) as Array<Record<string, unknown>>;

      // Build a map from tool_call_id → tool name for resolving tool response names
      const toolNameMap = new Map<string, string>();
      for (const msg of raw) {
        if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
          for (const tc of msg.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }>) {
            toolNameMap.set(tc.id, tc.function.name);
          }
        }
      }

      return raw.map((msg) => {
        if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
          return {
            role: 'assistant',
            content: msg.content ?? null,
            toolCalls: (msg.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }>).map((tc) => ({
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
            })),
          };
        }
        if (msg.role === 'tool') {
          const toolCallId = msg.tool_call_id as string;
          return {
            role: 'tool',
            toolCallId,
            toolName: toolNameMap.get(toolCallId) ?? '',
            content: (msg.content as string) ?? '',
          };
        }
        return { role: msg.role, content: msg.content ?? '' };
      });
    } catch {
      return null;
    }
  }
}
