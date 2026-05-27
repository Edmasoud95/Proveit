import { Injectable, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { ReplaySubject } from 'rxjs';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { JudgeService } from './judge.service';
import {
  buildGenerateEvalsSystemPrompt,
  buildGenerateEvalsUserPrompt,
} from './prompts/generate-evals.prompt';
import {
  buildGenerateStubsSystemPrompt,
  buildGenerateStubsUserPrompt,
} from './prompts/generate-stubs.prompt';
import {
  buildGenerateToolDataSystemPrompt,
  buildGenerateToolDataUserPrompt,
} from './prompts/generate-tool-data.prompt';

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  mockResponse?: string;
}

export interface EvalSseEvent {
  type: 'case-start' | 'case-complete' | 'run-complete' | 'error' | 'step-update';
  data: Record<string, unknown>;
}

@Injectable()
export class EvalService implements OnModuleInit {
  private runSubjects = new Map<string, ReplaySubject<EvalSseEvent>>();

  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
    private judgeService: JudgeService,
  ) {}

  async onModuleInit() {
    await this.prisma.evalRun.updateMany({
      where: { status: { in: ['running', 'pending'] } },
      data: { status: 'failed', completedAt: new Date() },
    });
  }

  // ─── Eval Case CRUD ────────────────────────────────────────────────────────

  async addCases(pocId: string, cases: Array<{ name: string; input: unknown; judgeCriteria: string }>) {
    const existing = await this.prisma.evalCase.count({ where: { pocConfigId: pocId } });
    const created = await Promise.all(
      cases.map((c, i) =>
        this.prisma.evalCase.create({
          data: {
            pocConfigId: pocId,
            name: c.name,
            input: JSON.stringify(c.input),
            judgeCriteria: c.judgeCriteria,
            order: existing + i,
          },
        }),
      ),
    );
    await this.createEvalSuiteVersion(pocId);
    return { cases: created.map((c) => ({ ...c, input: JSON.parse(c.input) })) };
  }

  async updateCase(pocId: string, caseId: string, data: Partial<{ name: string; input: unknown; judgeCriteria: string; order: number }>) {
    const evalCase = await this.prisma.evalCase.findFirst({ where: { id: caseId, pocConfigId: pocId } });
    if (!evalCase) throw new NotFoundException('Eval case not found');
    const updated = await this.prisma.evalCase.update({
      where: { id: caseId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.input !== undefined && { input: JSON.stringify(data.input) }),
        ...(data.judgeCriteria !== undefined && { judgeCriteria: data.judgeCriteria }),
        ...(data.order !== undefined && { order: data.order }),
      },
    });
    await this.createEvalSuiteVersion(pocId);
    return { ...updated, input: JSON.parse(updated.input) };
  }

  async deleteCase(pocId: string, caseId: string) {
    const evalCase = await this.prisma.evalCase.findFirst({ where: { id: caseId, pocConfigId: pocId } });
    if (!evalCase) throw new NotFoundException('Eval case not found');
    await this.prisma.evalCase.delete({ where: { id: caseId } });
    await this.createEvalSuiteVersion(pocId);
  }

  // ─── Eval Suite Versioning ─────────────────────────────────────────────────

  private async createEvalSuiteVersion(pocId: string): Promise<void> {
    const [cases, latest] = await Promise.all([
      this.prisma.evalCase.findMany({
        where: { pocConfigId: pocId },
        orderBy: { order: 'asc' },
      }),
      this.prisma.evalSuiteVersion.findFirst({
        where: { pocConfigId: pocId },
        orderBy: { versionNumber: 'desc' },
      }),
    ]);

    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    const casesSnapshot = JSON.stringify(
      cases.map((c) => ({
        id: c.id,
        name: c.name,
        input: c.input,
        judgeCriteria: c.judgeCriteria,
        order: c.order,
      })),
    );

    await this.prisma.evalSuiteVersion.create({
      data: { pocConfigId: pocId, versionNumber, casesSnapshot },
    });
  }

  async listVersions(pocId: string) {
    const versions = await this.prisma.evalSuiteVersion.findMany({
      where: { pocConfigId: pocId },
      orderBy: { versionNumber: 'desc' },
      include: { _count: { select: { runs: true } } },
    });
    return versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      casesSnapshot: JSON.parse(v.casesSnapshot) as unknown[],
      createdAt: v.createdAt.toISOString(),
      runCount: v._count.runs,
    }));
  }

  // ─── Run Execution ─────────────────────────────────────────────────────────

  async startRun(pocId: string): Promise<{ runId: string; totalCases: number; status: string }> {
    const [cases, poc, latestVersion] = await Promise.all([
      this.prisma.evalCase.findMany({ where: { pocConfigId: pocId } }),
      this.prisma.pocConfig.findUnique({ where: { id: pocId } }),
      this.prisma.evalSuiteVersion.findFirst({
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

  subscribeToRun(runId: string): ReplaySubject<EvalSseEvent> {
    if (!this.runSubjects.has(runId)) {
      this.runSubjects.set(runId, new ReplaySubject<EvalSseEvent>(200));
    }
    return this.runSubjects.get(runId)!;
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

    let agentClient: import('openai').default;
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

    let judgeClient: import('openai').default;
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
        const { response: agentResponse, history } = await this.callAgent(
          agentClient,
          agentModel,
          poc.systemPrompt,
          input.messages,
          pocTools,
        );
        const latencyMs = Date.now() - start;

        const pipelineTrace = this.serializePipelineTrace(history);

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
    subject.complete();
    this.runSubjects.delete(runId);
  }

  private serializePipelineTrace(history: OpenAI.Chat.ChatCompletionMessageParam[]): string | null {
    // Exclude the system prompt (first message) from the trace
    const traceMessages = history.slice(1);
    if (traceMessages.length === 0) return null;
    return JSON.stringify(traceMessages);
  }

  private async callAgent(
    client: OpenAI,
    model: string,
    systemPrompt: string,
    messages: unknown[],
    tools: ToolDefinition[],
  ): Promise<{ response: string; history: OpenAI.Chat.ChatCompletionMessageParam[] }> {
    const MAX_ITERATIONS = 10;

    const stubbedTools = tools.filter((t) => t.mockResponse);
    const apiTools = stubbedTools.length > 0
      ? stubbedTools.map((t) => ({
          type: 'function' as const,
          function: { name: t.name, description: t.description, parameters: t.parameters },
        }))
      : undefined;

    const history: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...(messages as Array<{ role: 'user' | 'assistant'; content: string }>),
    ];

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await client.chat.completions.create({
        model,
        messages: history,
        ...(apiTools ? { tools: apiTools } : {}),
      });

      const choice = response.choices[0];

      if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
        history.push({ role: 'assistant', content: choice.message.content ?? '' });
        return { response: choice.message.content ?? '', history };
      }

      history.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        const tool = tools.find((t) => t.name === toolCall.function.name);
        let content: string;

        if (!tool) {
          const available = tools.map((t) => t.name).join(', ');
          content = JSON.stringify({
            error: `Tool '${toolCall.function.name}' is not defined in this POC. Available tools: ${available}`,
          });
        } else if (!tool.mockResponse) {
          content = JSON.stringify({
            error: `No stub configured for tool '${tool.name}'. Set a mock response in the Tools tab.`,
          });
        } else {
          content = tool.mockResponse;
        }

        history.push({ role: 'tool', tool_call_id: toolCall.id, content });
      }
    }

    throw new Error('Tool call loop exceeded maximum iterations');
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
    return runs.map((r) => ({
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
    }));
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
        pipelineTrace: r.pipelineTrace ? this.parsePipelineTrace(r.pipelineTrace) : null,
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

    if (runA.evalSuiteVersionId !== runB.evalSuiteVersionId) {
      const vA = runA.evalSuiteVersion?.versionNumber ?? '?';
      const vB = runB.evalSuiteVersion?.versionNumber ?? '?';
      throw new BadRequestException({
        error: 'CROSS_VERSION_COMPARISON',
        message: `Runs use different eval suite versions (v${vA} vs v${vB}). Comparisons are only valid within the same version.`,
      });
    }

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
      snapshotModel: run.snapshotModel,
      snapshotEndpointUrl: run.snapshotEndpointUrl,
    });

    return { runA: toSummary(runA), runB: toSummary(runB), cases };
  }

  private parsePipelineTrace(traceJson: string): unknown[] | null {
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

  // ─── Generation ────────────────────────────────────────────────────────────

  async generateCases(pocId: string, count: number = 5, toolFocused: boolean = false) {
    const poc = await this.prisma.pocConfig.findUnique({ where: { id: pocId } });
    if (!poc) throw new NotFoundException('POC not found');

    const { client, model } = await this.llmService.resolveForTask(pocId, 'eval-gen').catch(() => {
      throw new BadRequestException('No default LLM provider configured. Add a provider on the LLM Settings page.');
    });

    const tools: ToolDefinition[] = JSON.parse(poc.tools);

    const systemPrompt = toolFocused
      ? buildGenerateToolDataSystemPrompt()
      : buildGenerateEvalsSystemPrompt();
    const userPrompt = toolFocused
      ? buildGenerateToolDataUserPrompt(poc.systemPrompt, tools, count)
      : buildGenerateEvalsUserPrompt(poc.systemPrompt, poc.tools, count);

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
    });

    const raw = response.choices[0].message.content ?? '[]';
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/([\s\S]*)/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();

    let parsed: Array<{ name: string; input: unknown; judgeCriteria: string }>;
    try {
      const obj = JSON.parse(jsonStr);
      parsed = Array.isArray(obj) ? obj : (obj.cases ?? []);
    } catch {
      throw new BadRequestException('Failed to parse generated eval cases');
    }

    return this.addCases(pocId, parsed.slice(0, count));
  }

  async generateStubs(pocId: string, overwrite: boolean) {
    const poc = await this.prisma.pocConfig.findUnique({ where: { id: pocId } });
    if (!poc) throw new NotFoundException('POC not found');

    const tools: ToolDefinition[] = JSON.parse(poc.tools);
    if (tools.length === 0) throw new BadRequestException('No tools defined on this POC');

    const toolsToGenerate = overwrite ? tools : tools.filter((t) => !t.mockResponse);
    const skipped = tools.filter((t) => !overwrite && t.mockResponse).map((t) => t.name);

    if (toolsToGenerate.length === 0) {
      return { generated: [], skipped, failed: [] };
    }

    const { client, model } = await this.llmService.resolveForTask(pocId, 'stub-gen').catch(() => {
      throw new BadRequestException('No default LLM provider configured. Add a provider on the LLM Settings page.');
    });

    const userPrompt = buildGenerateStubsUserPrompt(toolsToGenerate);
    console.log('[generateStubs] model:', model);
    console.log('[generateStubs] tools to generate:', toolsToGenerate.map((t) => t.name));
    console.log('[generateStubs] user prompt:\n', userPrompt);

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: buildGenerateStubsSystemPrompt() },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    });

    const raw = response.choices[0].message.content ?? '{}';
    console.log('[generateStubs] raw LLM response:\n', raw);

    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/([\s\S]*)/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
    console.log('[generateStubs] extracted JSON string:\n', jsonStr);

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(jsonStr);
      console.log('[generateStubs] parsed keys:', Object.keys(parsed));
    } catch (err) {
      console.error('[generateStubs] JSON parse failed:', err);
    }

    const generated: string[] = [];
    const failed: string[] = [];

    const updatedTools = tools.map((t) => {
      if (!toolsToGenerate.find((g) => g.name === t.name)) return t;
      const value = parsed[t.name];
      if (value !== undefined) {
        generated.push(t.name);
        return { ...t, mockResponse: JSON.stringify(value) };
      }
      failed.push(t.name);
      return t;
    });

    await this.prisma.pocConfig.update({
      where: { id: pocId },
      data: { tools: JSON.stringify(updatedTools) },
    });

    return { generated, skipped, failed };
  }
}
