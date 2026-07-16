import { createHash, randomUUID } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common';
import { ReplaySubject, Observable } from 'rxjs';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { SseRegistry } from '../common/sse-registry';
import { assertValidEndpointUrl } from '../llm/url-validation';
import { ScaffoldService } from '../scaffold/scaffold.service';
import { UpdatePocDto } from './dto/update-poc.dto';
import type { ScaffoldStep, ScaffoldStreamEvent } from '@proveit/shared';

@Injectable()
export class PocService {
  // Unbounded replay: a scaffold job is short-lived and a late subscriber
  // (page refresh) must see every step event from the start.
  private jobs = new SseRegistry<MessageEvent>();
  private completedJobs = new Map<string, string>(); // jobId → pocId

  constructor(
    private prisma: PrismaService,
    private scaffold: ScaffoldService,
  ) {}

  startScaffoldJob(params: { description: string; endpointUrl: string; apiKey?: string; model?: string }): string {
    assertValidEndpointUrl(params.endpointUrl);
    const jobId = randomUUID();
    this.jobs.get(jobId);
    void this.runScaffoldJob(jobId, params);
    return jobId;
  }

  getJobStream(jobId: string): Observable<MessageEvent> {
    if (!this.jobs.has(jobId)) throw new NotFoundException('Scaffold job not found');
    return this.jobs.get(jobId).asObservable();
  }

  getCompletedPocId(jobId: string): string | null {
    return this.completedJobs.get(jobId) ?? null;
  }

  private emit(subject: ReplaySubject<MessageEvent>, payload: ScaffoldStreamEvent): void {
    subject.next({ data: JSON.stringify(payload) });
  }

  private toPlainLanguage(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('ENOTFOUND')) {
      return 'Could not reach the LLM endpoint — check your connection and retry.';
    }
    if (msg.includes('ETIMEDOUT') || msg.includes('timed out') || msg.includes('timeout')) {
      return 'The request timed out — the LLM may be overloaded. Please retry.';
    }
    if (msg.includes('unexpected response format')) return msg;
    return `Generation failed: ${msg}`;
  }

  private async runScaffoldJob(
    jobId: string,
    params: { description: string; endpointUrl: string; apiKey?: string; model?: string },
  ): Promise<void> {
    const subject = this.jobs.get(jobId);
    const { description, endpointUrl, apiKey, model } = params;
    const targetModel = model ?? 'gpt-4o';
    const client = new OpenAI({ baseURL: endpointUrl, apiKey: apiKey ?? 'not-required' });

    let currentStep: ScaffoldStep = 'system-prompt';
    try {
      this.emit(subject, { type: 'step-start', step: 'system-prompt', index: 0, total: 4 });
      const { name, systemPrompt } = await this.scaffold.generateSystemPrompt(description, client, targetModel);
      this.emit(subject, { type: 'step-complete', step: 'system-prompt', content: { type: 'system-prompt', name, systemPrompt } });

      currentStep = 'tools';
      this.emit(subject, { type: 'step-start', step: 'tools', index: 1, total: 4 });
      const tools = await this.scaffold.generateTools(description, systemPrompt, client, targetModel);
      this.emit(subject, { type: 'step-complete', step: 'tools', content: { type: 'tools', tools } });

      currentStep = 'eval-cases';
      this.emit(subject, { type: 'step-start', step: 'eval-cases', index: 2, total: 4 });
      const evalCases = await this.scaffold.generateEvalCases(description, systemPrompt, tools, client, targetModel);
      this.emit(subject, { type: 'step-complete', step: 'eval-cases', content: { type: 'eval-cases', evalCases } });

      currentStep = 'saving';
      this.emit(subject, { type: 'step-start', step: 'saving', index: 3, total: 4 });
      await new Promise<void>(r => setTimeout(r, 600));
      const poc = await this.prisma.pocConfig.create({
        data: {
          name: name ?? description.slice(0, 50),
          description,
          systemPrompt,
          tools: JSON.stringify(tools),
          evalCases: {
            create: evalCases.map((c, i) => ({
              name: c.name,
              input: JSON.stringify(c.input),
              judgeCriteria: c.judgeCriteria,
              order: i,
            })),
          },
        },
        include: { evalCases: true },
      });
      await this.createConfigVersion(poc.id, poc.systemPrompt, poc.tools, 'Initial version');
      this.emit(subject, { type: 'done', pocId: poc.id });
      this.completedJobs.set(jobId, poc.id);
    } catch (err) {
      this.emit(subject, { type: 'error', step: currentStep, message: this.toPlainLanguage(err) });
    } finally {
      subject.complete();
      const TTL = 30 * 60 * 1000;
      setTimeout(() => {
        this.jobs.delete(jobId);
        this.completedJobs.delete(jobId);
      }, TTL);
    }
  }

  async findAll() {
    return this.prisma.pocConfig.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { evalCases: true, evalRuns: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const poc = await this.prisma.pocConfig.findUnique({
      where: { id },
      include: {
        evalCases: { orderBy: { order: 'asc' } },
        llmConnections: true,
      },
    });
    if (!poc) throw new NotFoundException('POC not found');

    return {
      ...poc,
      tools: JSON.parse(poc.tools),
      metadata: JSON.parse(poc.metadata),
      evalCases: poc.evalCases.map((c) => ({
        ...c,
        input: JSON.parse(c.input),
      })),
    };
  }

  async update(id: string, dto: UpdatePocDto) {
    await this.findOne(id);
    const updated = await this.prisma.pocConfig.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.systemPrompt !== undefined && { systemPrompt: dto.systemPrompt }),
        ...(dto.tools !== undefined && { tools: JSON.stringify(dto.tools) }),
      },
      include: { evalCases: true, llmConnections: true },
    });

    if (dto.systemPrompt !== undefined || dto.tools !== undefined) {
      await this.createConfigVersion(id, updated.systemPrompt, updated.tools);
    }

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.pocConfig.delete({ where: { id } });
  }

  async export(id: string) {
    const poc = await this.findOne(id);
    return {
      version: '1',
      exportedAt: new Date().toISOString(),
      poc,
    };
  }

  // ─── Config Versioning ────────────────────────────────────────────────────

  async createConfigVersion(pocId: string, systemPrompt: string, tools: string, label?: string): Promise<void> {
    const contentHash = createHash('sha256').update(systemPrompt + tools).digest('hex');

    const latest = await this.prisma.pocConfigVersion.findFirst({
      where: { pocConfigId: pocId },
      orderBy: { versionNumber: 'desc' },
    });

    if (latest?.contentHash === contentHash) return;

    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    const changeLabel = label ?? this.deriveChangeLabel(latest, systemPrompt, tools);

    const version = await this.prisma.pocConfigVersion.create({
      data: { pocConfigId: pocId, versionNumber, systemPrompt, tools, changeLabel, contentHash },
    });

    await this.prisma.pocConfig.update({
      where: { id: pocId },
      data: { currentConfigVersionId: version.id },
    });
  }

  private deriveChangeLabel(
    previous: { systemPrompt: string; tools: string } | null,
    newPrompt: string,
    newTools: string,
  ): string {
    if (!previous) return 'Initial version';
    const promptChanged = previous.systemPrompt !== newPrompt;
    const toolsChanged = previous.tools !== newTools;
    if (promptChanged && toolsChanged) return 'System prompt and tools changed';
    if (promptChanged) return 'System prompt changed';
    if (toolsChanged) return 'Tools changed';
    return 'Updated';
  }

  async listConfigVersions(pocId: string) {
    return this.prisma.pocConfigVersion.findMany({
      where: { pocConfigId: pocId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true, changeLabel: true, createdAt: true },
    });
  }

  async getConfigVersion(pocId: string, versionId: string) {
    const v = await this.prisma.pocConfigVersion.findFirst({ where: { id: versionId, pocConfigId: pocId } });
    if (!v) throw new NotFoundException('Config version not found');
    return v;
  }

  async restoreConfigVersion(pocId: string, versionId: string) {
    const v = await this.getConfigVersion(pocId, versionId);
    const tools = JSON.parse(v.tools) as object[];
    await this.update(pocId, { systemPrompt: v.systemPrompt, tools: tools as never });
    // Override the auto-generated label with a restore label
    const latest = await this.prisma.pocConfigVersion.findFirst({
      where: { pocConfigId: pocId },
      orderBy: { versionNumber: 'desc' },
    });
    if (latest) {
      await this.prisma.pocConfigVersion.update({
        where: { id: latest.id },
        data: { changeLabel: `Restored from v${v.versionNumber}` },
      });
    }
    return this.findOne(pocId);
  }
}
