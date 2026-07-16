import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ReplaySubject } from 'rxjs';
import type OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { JudgeService } from './judge.service';
import { AgentRunnerService } from './agent-runner.service';
import { EvalMetricsService } from './eval-metrics.service';
import { SseRegistry } from '../common/sse-registry';
import type { EvalSseEvent, ToolDefinition } from '@proveit/shared';

/** Orchestrates eval runs: lifecycle, execution loop, SSE streaming, history. */
@Injectable()
export class EvalRunService implements OnModuleInit {
  // Buffer of 200 lets a client that connects mid-run replay everything so far.
  private readonly runStreams = new SseRegistry<EvalSseEvent>(200);

  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
    private judgeService: JudgeService,
    private agentRunner: AgentRunnerService,
    private metrics: EvalMetricsService,
  ) {}

  async onModuleInit() {
    // Runs interrupted by a server restart can never complete — mark them failed.
    await this.prisma.evalRun.updateMany({
      where: { status: { in: ['running', 'pending'] } },
      data: { status: 'failed', completedAt: new Date() },
    });
  }

  async startRun(pocId: string): Promise<{ runId: string; totalCases: number; status: string }> {
    const [cases, poc, latestVersion, latestConfigVersion] = await Promise.all([
      this.prisma.evalCase.findMany({ where: { pocConfigId: pocId } }),
      this.prisma.pocConfig.findUnique({ where: { id: pocId } }),
      this.prisma.evalSuiteVersion.findFirst({
        where: { pocConfigId: pocId },
        orderBy: { versionNumber: 'desc' },
      }),
      this.prisma.pocConfigVersion.findFirst({
        where: { pocConfigId: pocId },
        orderBy: { versionNumber: 'desc' },
      }),
    ]);

    if (cases.length === 0) throw new BadRequestException('No eval cases to run');

    const maxRunNumber = await this.prisma.evalRun.aggregate({
      where: { pocConfigId: pocId },
      _max: { runNumber: true },
    });

    let snapshotModel = '';
    let snapshotEndpointUrl = '';
    let snapshotJudgeModel = '';
    let snapshotJudgeProviderName = '';
    try {
      const agentProvider = await this.llmService.resolveForTask(pocId, 'agent');
      snapshotModel = agentProvider.model;
      snapshotEndpointUrl = agentProvider.endpointUrl;
    } catch { /* run will fail in executeRun with a clear error */ }
    try {
      const judgeProvider = await this.llmService.resolveForTask(pocId, 'judge');
      snapshotJudgeModel = judgeProvider.model;
      snapshotJudgeProviderName = judgeProvider.providerName;
    } catch { /* non-fatal */ }

    const run = await this.prisma.evalRun.create({
      data: {
        pocConfigId: pocId,
        status: 'pending',
        totalCases: cases.length,
        runNumber: (maxRunNumber._max.runNumber ?? 0) + 1,
        evalSuiteVersionId: latestVersion?.id ?? null,
        configVersionId: latestConfigVersion?.id ?? null,
        snapshotConfigVersionNumber: latestConfigVersion?.versionNumber ?? null,
        snapshotSystemPrompt: poc?.systemPrompt ?? '',
        snapshotModel,
        snapshotEndpointUrl,
        snapshotJudgeModel,
        snapshotJudgeProviderName,
      },
    });

    this.executeRun(pocId, run.id).catch(console.error);

    return { runId: run.id, totalCases: cases.length, status: 'pending' };
  }

  async assertRunInPoc(pocId: string, runId: string): Promise<void> {
    const run = await this.prisma.evalRun.findFirst({
      where: { id: runId, pocConfigId: pocId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException('Run not found for this POC');
  }

  subscribeToRun(runId: string): ReplaySubject<EvalSseEvent> {
    return this.runStreams.get(runId);
  }

  private async executeRun(pocId: string, runId: string) {
    const subject = this.subscribeToRun(runId);

    const [poc, cases] = await Promise.all([
      this.prisma.pocConfig.findUnique({ where: { id: pocId } }),
      this.prisma.evalCase.findMany({ where: { pocConfigId: pocId }, orderBy: { order: 'asc' } }),
    ]);

    if (!poc) {
      subject.error(new Error('POC not found'));
      return;
    }

    let agentClient: OpenAI;
    let agentModel: string;
    let agentProviderName: string;
    let agentEndpointUrl: string;
    try {
      const agentProvider = await this.llmService.resolveForTask(pocId, 'agent');
      agentClient = agentProvider.client;
      agentModel = agentProvider.model;
      agentProviderName = agentProvider.providerName;
      agentEndpointUrl = agentProvider.endpointUrl;
    } catch (err) {
      await this.prisma.evalRun.update({
        where: { id: runId },
        data: { status: 'failed', completedAt: new Date() },
      });
      subject.error(err instanceof Error ? err : new Error('No LLM provider configured'));
      return;
    }

    let judgeClient: OpenAI;
    let judgeModel: string;
    let judgeProviderName: string;
    try {
      const judgeProvider = await this.llmService.resolveForTask(pocId, 'judge');
      judgeClient = judgeProvider.client;
      judgeModel = judgeProvider.model;
      judgeProviderName = judgeProvider.providerName;
    } catch (err) {
      await this.prisma.evalRun.update({
        where: { id: runId },
        data: { status: 'failed', completedAt: new Date() },
      });
      subject.error(err instanceof Error ? err : new Error('No judge LLM provider configured'));
      return;
    }

    await this.prisma.evalRun.update({ where: { id: runId }, data: { status: 'running' } });

    let passed = 0;
    let failed = 0;

    for (const evalCase of cases) {
      subject.next({ type: 'case-start', data: { caseId: evalCase.id, name: evalCase.name } });

      try {
        const input = JSON.parse(evalCase.input) as { messages: unknown[] };
        const start = Date.now();

        subject.next({
          type: 'step-update',
          data: { caseId: evalCase.id, step: 'agent', model: agentModel, providerName: agentProviderName, endpointUrl: agentEndpointUrl },
        });

        const pocTools: ToolDefinition[] = JSON.parse(poc.tools);
        const { response: agentResponse, history, promptTokens, completionTokens, totalTokens } =
          await this.agentRunner.callAgent(agentClient, agentModel, poc.systemPrompt, input.messages, pocTools);
        const latencyMs = Date.now() - start;

        const pipelineTrace = this.agentRunner.serializePipelineTrace(history);

        subject.next({
          type: 'step-update',
          data: { caseId: evalCase.id, step: 'judge', model: judgeModel, providerName: judgeProviderName },
        });

        const verdict = await this.judgeService.judge(
          judgeClient,
          judgeModel,
          evalCase.input,
          evalCase.judgeCriteria,
          agentResponse,
          pipelineTrace,
        );

        const status = verdict.passed ? 'passed' : 'failed';
        verdict.passed ? passed++ : failed++;

        await this.prisma.evalResult.create({
          data: {
            evalCaseId: evalCase.id,
            runId,
            status,
            score: verdict.score,
            reasoning: verdict.reasoning,
            rawResponse: agentResponse,
            latencyMs,
            pipelineTrace,
            failureStep: verdict.failureStep ?? null,
            promptTokens,
            completionTokens,
            totalTokens,
          },
        });

        subject.next({
          type: 'case-complete',
          data: {
            caseId: evalCase.id,
            caseName: evalCase.name,
            status,
            score: verdict.score,
            reasoning: verdict.reasoning,
            rawResponse: agentResponse,
            latencyMs,
            pipelineTrace: pipelineTrace ? JSON.parse(pipelineTrace) : null,
            failureStep: verdict.failureStep ?? null,
            errorDetail: null,
            agentModel,
            agentProviderName,
            agentEndpointUrl,
            judgeModel,
            judgeProviderName,
          },
        });
      } catch (err: unknown) {
        failed++;
        const errorDetail = err instanceof Error ? err.message : 'Unknown error';
        await this.prisma.evalResult.create({
          data: {
            evalCaseId: evalCase.id,
            runId,
            status: 'errored',
            errorDetail,
          },
        });
        subject.next({
          type: 'case-complete',
          data: {
            caseId: evalCase.id,
            caseName: evalCase.name,
            status: 'errored',
            score: null,
            reasoning: null,
            rawResponse: null,
            latencyMs: null,
            pipelineTrace: null,
            failureStep: null,
            errorDetail,
            agentModel,
            agentProviderName,
            agentEndpointUrl,
            judgeModel: null,
            judgeProviderName: null,
          },
        });
      }
    }

    await this.prisma.evalRun.update({
      where: { id: runId },
      data: { status: 'completed', passedCases: passed, failedCases: failed, completedAt: new Date() },
    });

    subject.next({
      type: 'run-complete',
      data: { runId, passed, failed, total: cases.length },
    });
    this.runStreams.complete(runId);
  }

  // ─── Run History ───────────────────────────────────────────────────────────

  async listRuns(pocId: string) {
    const runs = await this.prisma.evalRun.findMany({
      where: { pocConfigId: pocId },
      orderBy: { startedAt: 'desc' },
      include: {
        evalSuiteVersion: { select: { versionNumber: true } },
      },
    });
    const runsWithMetrics = await Promise.all(
      runs.map(async (r) => {
        const metrics = r.status === 'completed' ? await this.metrics.computeRunMetrics(r.id) : null;
        return {
          id: r.id,
          pocConfigId: r.pocConfigId,
          status: r.status,
          totalCases: r.totalCases,
          passedCases: r.passedCases,
          failedCases: r.failedCases,
          startedAt: r.startedAt.toISOString(),
          completedAt: r.completedAt?.toISOString() ?? null,
          runNumber: r.runNumber,
          evalSuiteVersionId: r.evalSuiteVersionId ?? null,
          evalSuiteVersionNumber: r.evalSuiteVersion?.versionNumber ?? null,
          snapshotModel: r.snapshotModel,
          snapshotEndpointUrl: r.snapshotEndpointUrl,
          metrics,
        };
      }),
    );
    return runsWithMetrics;
  }

  async getRun(pocId: string, runId: string) {
    const run = await this.prisma.evalRun.findFirst({
      where: { id: runId, pocConfigId: pocId },
      include: {
        results: {
          include: { evalCase: { select: { name: true } } },
        },
        evalSuiteVersion: { select: { versionNumber: true } },
      },
    });
    if (!run) throw new NotFoundException('Eval run not found');
    return {
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
      snapshotSystemPrompt: run.snapshotSystemPrompt,
      snapshotModel: run.snapshotModel,
      snapshotEndpointUrl: run.snapshotEndpointUrl,
      snapshotJudgeModel: run.snapshotJudgeModel,
      snapshotJudgeProviderName: run.snapshotJudgeProviderName,
      results: run.results.map((r) => ({
        caseId: r.evalCaseId,
        caseName: r.evalCase.name,
        status: r.status,
        score: r.score ?? null,
        reasoning: r.reasoning ?? null,
        rawResponse: r.rawResponse ?? null,
        latencyMs: r.latencyMs ?? null,
        pipelineTrace: r.pipelineTrace ? this.metrics.parsePipelineTrace(r.pipelineTrace) : null,
        errorDetail: r.errorDetail ?? null,
        failureStep: (r.failureStep as 'wrong_tool' | 'wrong_arguments' | 'wrong_final_response' | null) ?? null,
      })),
    };
  }

  async deleteRun(pocId: string, runId: string): Promise<void> {
    const run = await this.prisma.evalRun.findFirst({ where: { id: runId, pocConfigId: pocId } });
    if (!run) throw new NotFoundException('Eval run not found');
    await this.prisma.evalRun.delete({ where: { id: runId } });
  }
}
