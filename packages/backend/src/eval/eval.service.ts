import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Subject } from 'rxjs';
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
  type: 'case-start' | 'case-complete' | 'run-complete' | 'error';
  data: Record<string, unknown>;
}

@Injectable()
export class EvalService {
  private runSubjects = new Map<string, Subject<EvalSseEvent>>();

  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
    private judgeService: JudgeService,
  ) {}

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
    return { cases: created.map((c) => ({ ...c, input: JSON.parse(c.input) })) };
  }

  async generateCases(pocId: string, count: number = 5, toolFocused: boolean = false) {
    const poc = await this.prisma.pocConfig.findUnique({
      where: { id: pocId },
      include: { llmConnection: true },
    });
    if (!poc) throw new NotFoundException('POC not found');
    if (!poc.llmConnection) throw new BadRequestException('Connect an LLM first');
    if (!poc.llmConnection.model?.trim()) {
      throw new BadRequestException('No model selected — set a model in LLM Settings first');
    }

    const client = this.llmService.getClient(
      poc.llmConnection.endpointUrl,
      poc.llmConnection.apiKey ?? undefined,
    );

    const tools: ToolDefinition[] = JSON.parse(poc.tools);

    const systemPrompt = toolFocused
      ? buildGenerateToolDataSystemPrompt()
      : buildGenerateEvalsSystemPrompt();
    const userPrompt = toolFocused
      ? buildGenerateToolDataUserPrompt(poc.systemPrompt, tools, count)
      : buildGenerateEvalsUserPrompt(poc.systemPrompt, poc.tools, count);

    const response = await client.chat.completions.create({
      model: poc.llmConnection.model,
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

  async startRun(pocId: string): Promise<{ runId: string; totalCases: number; status: string }> {
    const cases = await this.prisma.evalCase.findMany({ where: { pocConfigId: pocId } });
    if (cases.length === 0) throw new BadRequestException('No eval cases to run');

    const run = await this.prisma.evalRun.create({
      data: { pocConfigId: pocId, status: 'pending', totalCases: cases.length },
    });

    // Execute async, don't await
    this.executeRun(pocId, run.id).catch(console.error);

    return { runId: run.id, totalCases: cases.length, status: 'pending' };
  }

  subscribeToRun(runId: string): Subject<EvalSseEvent> {
    if (!this.runSubjects.has(runId)) {
      this.runSubjects.set(runId, new Subject<EvalSseEvent>());
    }
    return this.runSubjects.get(runId)!;
  }

  private async executeRun(pocId: string, runId: string) {
    const subject = this.subscribeToRun(runId);

    const [poc, cases] = await Promise.all([
      this.prisma.pocConfig.findUnique({
        where: { id: pocId },
        include: { llmConnection: true },
      }),
      this.prisma.evalCase.findMany({ where: { pocConfigId: pocId }, orderBy: { order: 'asc' } }),
    ]);

    if (!poc?.llmConnection) {
      await this.prisma.evalRun.update({
        where: { id: runId },
        data: { status: 'failed', completedAt: new Date() },
      });
      subject.error(new Error('No LLM connection configured'));
      return;
    }

    await this.prisma.evalRun.update({ where: { id: runId }, data: { status: 'running' } });

    const client = this.llmService.getClient(
      poc.llmConnection.endpointUrl,
      poc.llmConnection.apiKey ?? undefined,
    );
    const model = poc.llmConnection.model;

    let passed = 0;
    let failed = 0;

    for (const evalCase of cases) {
      subject.next({ type: 'case-start', data: { caseId: evalCase.id, name: evalCase.name } });

      try {
        const input = JSON.parse(evalCase.input) as { messages: unknown[] };
        const start = Date.now();

        const pocTools: ToolDefinition[] = JSON.parse(poc.tools);
        const agentResponse = await this.callAgent(client, model, poc.systemPrompt, input.messages, pocTools);
        const latencyMs = Date.now() - start;

        const verdict = await this.judgeService.judge(
          client,
          model,
          evalCase.input,
          evalCase.judgeCriteria,
          agentResponse,
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
          },
        });

        subject.next({
          type: 'case-complete',
          data: {
            caseId: evalCase.id,
            status,
            score: verdict.score,
            reasoning: verdict.reasoning,
            latencyMs,
          },
        });
      } catch (err: unknown) {
        failed++;
        const error = err instanceof Error ? err.message : 'Unknown error';
        await this.prisma.evalResult.create({
          data: { evalCaseId: evalCase.id, runId, status: 'errored' },
        });
        subject.next({ type: 'error', data: { caseId: evalCase.id, error } });
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

  private async callAgent(
    client: OpenAI,
    model: string,
    systemPrompt: string,
    messages: unknown[],
    tools: ToolDefinition[],
  ): Promise<string> {
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
        return choice.message.content ?? '';
      }

      // Push assistant message first — required before tool results
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

  async generateStubs(pocId: string, overwrite: boolean) {
    const poc = await this.prisma.pocConfig.findUnique({
      where: { id: pocId },
      include: { llmConnection: true },
    });
    if (!poc) throw new NotFoundException('POC not found');
    if (!poc.llmConnection) throw new BadRequestException('No LLM connection configured');

    const tools: ToolDefinition[] = JSON.parse(poc.tools);
    if (tools.length === 0) throw new BadRequestException('No tools defined on this POC');

    const toolsToGenerate = overwrite ? tools : tools.filter((t) => !t.mockResponse);
    const skipped = tools.filter((t) => !overwrite && t.mockResponse).map((t) => t.name);

    if (toolsToGenerate.length === 0) {
      return { generated: [], skipped, failed: [] };
    }

    if (!poc.llmConnection.model?.trim()) {
      throw new BadRequestException('No model selected — set a model in LLM Settings first');
    }

    const client = this.llmService.getClient(
      poc.llmConnection.endpointUrl,
      poc.llmConnection.apiKey ?? undefined,
    );

    const response = await client.chat.completions.create({
      model: poc.llmConnection.model,
      messages: [
        { role: 'system', content: buildGenerateStubsSystemPrompt() },
        { role: 'user', content: buildGenerateStubsUserPrompt(toolsToGenerate) },
      ],
      temperature: 0.7,
    });

    const raw = response.choices[0].message.content ?? '{}';
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/([\s\S]*)/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();

    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(jsonStr); } catch { /* all tools go to failed */ }

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

  async listRuns(pocId: string) {
    return this.prisma.evalRun.findMany({
      where: { pocConfigId: pocId },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getRun(pocId: string, runId: string) {
    const run = await this.prisma.evalRun.findFirst({
      where: { id: runId, pocConfigId: pocId },
      include: {
        results: {
          include: { evalCase: { select: { name: true } } },
        },
      },
    });
    if (!run) throw new NotFoundException('Eval run not found');
    return {
      ...run,
      results: run.results.map((r) => ({
        caseId: r.evalCaseId,
        caseName: r.evalCase.name,
        status: r.status,
        score: r.score,
        reasoning: r.reasoning,
        rawResponse: r.rawResponse,
        latencyMs: r.latencyMs,
      })),
    };
  }
}
