import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { assertValidEndpointUrl } from './url-validation';
import type { LlmProvider, LlmRoutingConfig, TaskModelOverride, TaskType } from '@proveit/shared';

const VALID_TASK_TYPES: TaskType[] = ['agent', 'judge', 'eval-gen', 'stub-gen'];

@Injectable()
export class LlmService {
  constructor(private prisma: PrismaService) {}

  getClient(endpointUrl: string, apiKey?: string): OpenAI {
    assertValidEndpointUrl(endpointUrl);
    return new OpenAI({
      baseURL: endpointUrl,
      apiKey: apiKey ?? 'not-required',
    });
  }

  // ─── Provider CRUD ────────────────────────────────────────────────────────

  async listProviders(pocId: string): Promise<LlmProvider[]> {
    const conns = await this.prisma.llmConnection.findMany({
      where: { pocConfigId: pocId },
      orderBy: { isDefault: 'desc' },
    });
    return conns.map((c) => this.toProvider(c));
  }

  async createProvider(pocId: string, dto: CreateProviderDto): Promise<LlmProvider> {
    const existingCount = await this.prisma.llmConnection.count({ where: { pocConfigId: pocId } });
    const conn = await this.prisma.llmConnection.create({
      data: {
        pocConfigId: pocId,
        name: dto.name,
        endpointUrl: dto.endpointUrl,
        apiKey: dto.apiKey,
        model: dto.model,
        isDefault: existingCount === 0,
      },
    });
    return this.toProvider(conn);
  }

  async updateProvider(pocId: string, id: string, dto: UpdateProviderDto): Promise<LlmProvider> {
    const conn = await this.prisma.llmConnection.findFirst({ where: { id, pocConfigId: pocId } });
    if (!conn) throw new NotFoundException('Provider not found');
    const updated = await this.prisma.llmConnection.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.endpointUrl !== undefined && { endpointUrl: dto.endpointUrl, isActive: false }),
        ...(dto.apiKey !== undefined && { apiKey: dto.apiKey, isActive: false }),
        ...(dto.model !== undefined && { model: dto.model }),
      },
    });
    return this.toProvider(updated);
  }

  async deleteProvider(pocId: string, id: string): Promise<void> {
    const conn = await this.prisma.llmConnection.findFirst({ where: { id, pocConfigId: pocId } });
    if (!conn) throw new NotFoundException('Provider not found');
    if (conn.isDefault) {
      const otherCount = await this.prisma.llmConnection.count({
        where: { pocConfigId: pocId, id: { not: id } },
      });
      if (otherCount > 0) {
        throw new BadRequestException({
          error: 'CANNOT_DELETE_DEFAULT',
          message: 'Designate another provider as default before deleting this one.',
        });
      }
    }
    await this.prisma.llmConnection.delete({ where: { id } });
  }

  async testProvider(pocId: string, id: string) {
    const conn = await this.prisma.llmConnection.findFirst({ where: { id, pocConfigId: pocId } });
    if (!conn) throw new NotFoundException('Provider not found');

    const client = this.getClient(conn.endpointUrl, conn.apiKey ?? undefined);
    const start = Date.now();
    try {
      const response = await client.models.list();
      const models = response.data.map((m) => m.id);
      const latencyMs = Date.now() - start;
      await this.prisma.llmConnection.update({
        where: { id },
        data: { isActive: true, lastCheckedAt: new Date(), availableModels: JSON.stringify(models) },
      });
      return { status: 'connected' as const, models, latencyMs };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Connection failed';
      await this.prisma.llmConnection.update({
        where: { id },
        data: { isActive: false, lastCheckedAt: new Date() },
      });
      return { status: 'failed' as const, error };
    }
  }

  async setDefault(pocId: string, id: string): Promise<LlmProvider> {
    const conn = await this.prisma.llmConnection.findFirst({ where: { id, pocConfigId: pocId } });
    if (!conn) throw new NotFoundException('Provider not found');
    await this.prisma.$transaction([
      this.prisma.llmConnection.updateMany({
        where: { pocConfigId: pocId },
        data: { isDefault: false },
      }),
      this.prisma.llmConnection.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return this.toProvider({ ...conn, isDefault: true });
  }

  // ─── Routing ──────────────────────────────────────────────────────────────

  async getRouting(pocId: string): Promise<LlmRoutingConfig> {
    const [pocProviders, globalProviders, overrideRows] = await Promise.all([
      this.listProviders(pocId),
      this.listGlobalProviders(),
      this.prisma.taskModelOverride.findMany({
        where: { pocConfigId: pocId },
        include: { connection: true },
      }),
    ]);
    const overrides: TaskModelOverride[] = overrideRows.map((o) => ({
      taskType: o.taskType as TaskType,
      connectionId: o.connectionId,
      providerName: o.connection.name,
      model: o.model,
    }));
    return { providers: [...pocProviders, ...globalProviders], overrides };
  }

  async setTaskOverride(pocId: string, taskType: string, connectionId: string, model: string): Promise<TaskModelOverride> {
    if (!VALID_TASK_TYPES.includes(taskType as TaskType)) {
      throw new BadRequestException({ error: 'INVALID_TASK_TYPE', message: `taskType must be one of: ${VALID_TASK_TYPES.join(', ')}` });
    }
    const conn = await this.prisma.llmConnection.findFirst({
      where: { id: connectionId, OR: [{ pocConfigId: pocId }, { pocConfigId: null }] },
    });
    if (!conn) {
      throw new BadRequestException({ error: 'PROVIDER_NOT_FOUND', message: 'Provider not found for this POC or globally.' });
    }
    await this.prisma.taskModelOverride.upsert({
      where: { pocConfigId_taskType: { pocConfigId: pocId, taskType } },
      create: { pocConfigId: pocId, taskType, connectionId, model },
      update: { connectionId, model },
    });
    return { taskType: taskType as TaskType, connectionId, providerName: conn.name, model };
  }

  async clearTaskOverride(pocId: string, taskType: string): Promise<void> {
    await this.prisma.taskModelOverride.deleteMany({ where: { pocConfigId: pocId, taskType } });
  }

  async resolveForTask(pocId: string, taskType: TaskType): Promise<{ client: OpenAI; model: string; connectionId: string; providerName: string; endpointUrl: string }> {
    const override = await this.prisma.taskModelOverride.findUnique({
      where: { pocConfigId_taskType: { pocConfigId: pocId, taskType } },
      include: { connection: true },
    });
    const conn = override?.connection
      ?? await this.prisma.llmConnection.findFirst({ where: { pocConfigId: pocId, isDefault: true } })
      ?? await this.prisma.llmConnection.findFirst({ where: { pocConfigId: null, isDefault: true } });
    if (!conn) throw new NotFoundException('No default LLM provider configured. Add a provider on the LLM Settings page or in Global Settings.');
    const model = override ? override.model : conn.model;
    return {
      client: this.getClient(conn.endpointUrl, conn.apiKey ?? undefined),
      model,
      connectionId: conn.id,
      providerName: conn.name,
      endpointUrl: conn.endpointUrl,
    };
  }

  // ─── Routing: get active routing for a task without throwing ──────────────

  // ─── Legacy shims (backward compatibility) ────────────────────────────────

  async upsert(pocId: string, endpointUrl: string, model: string, apiKey?: string) {
    const existing = await this.prisma.llmConnection.findFirst({ where: { pocConfigId: pocId, isDefault: true } });
    if (existing) {
      return this.prisma.llmConnection.update({
        where: { id: existing.id },
        data: { endpointUrl, model, apiKey: apiKey ?? existing.apiKey, isActive: false },
      });
    }
    return this.prisma.llmConnection.create({
      data: { pocConfigId: pocId, name: 'Default', isDefault: true, endpointUrl, model, apiKey },
    });
  }

  async test(pocId: string) {
    const conn = await this.prisma.llmConnection.findFirst({ where: { pocConfigId: pocId, isDefault: true } });
    if (!conn) throw new NotFoundException('No LLM connection configured');
    return this.testProvider(pocId, conn.id);
  }

  async getConnection(pocId: string) {
    const conn = await this.prisma.llmConnection.findFirst({ where: { pocConfigId: pocId, isDefault: true } });
    if (!conn) return null;
    const { apiKey: _key, name: _name, isDefault: _def, availableModels: _am, ...safe } = conn;
    return safe;
  }

  async getModels(pocId: string) {
    const conn = await this.prisma.llmConnection.findFirst({ where: { pocConfigId: pocId, isDefault: true } });
    if (!conn) throw new NotFoundException('No LLM connection configured');
    const client = this.getClient(conn.endpointUrl, conn.apiKey ?? undefined);
    try {
      const response = await client.models.list();
      return { models: response.data.map((m) => m.id) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch models';
      throw new NotFoundException(message);
    }
  }

  async fetchModelsFromUrl(endpointUrl: string, apiKey?: string) {
    const client = this.getClient(endpointUrl, apiKey);
    try {
      const response = await client.models.list();
      return { models: response.data.map((m) => m.id) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch models';
      throw new NotFoundException(message);
    }
  }

  async fetchModels(endpointUrl?: string, apiKey?: string, globalProviderId?: string) {
    if (globalProviderId) {
      const conn = await this.prisma.llmConnection.findFirst({ where: { id: globalProviderId, pocConfigId: null } });
      if (!conn) throw new NotFoundException('Global provider not found');
      return this.fetchModelsFromUrl(conn.endpointUrl, conn.apiKey ?? undefined);
    }
    if (!endpointUrl) throw new NotFoundException('endpointUrl is required');
    return this.fetchModelsFromUrl(endpointUrl, apiKey);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  // ─── Global Provider CRUD ─────────────────────────────────────────────────

  async listGlobalProviders(): Promise<LlmProvider[]> {
    const conns = await this.prisma.llmConnection.findMany({
      where: { pocConfigId: null },
      orderBy: { isDefault: 'desc' },
    });
    return conns.map((c) => this.toProvider(c));
  }

  async createGlobalProvider(dto: CreateProviderDto): Promise<LlmProvider> {
    const existingCount = await this.prisma.llmConnection.count({ where: { pocConfigId: null } });
    const conn = await this.prisma.llmConnection.create({
      data: {
        pocConfigId: null,
        name: dto.name,
        endpointUrl: dto.endpointUrl,
        apiKey: dto.apiKey,
        model: dto.model,
        isDefault: existingCount === 0,
      },
    });
    return this.toProvider(conn);
  }

  async updateGlobalProvider(id: string, dto: UpdateProviderDto): Promise<LlmProvider> {
    const conn = await this.prisma.llmConnection.findFirst({ where: { id, pocConfigId: null } });
    if (!conn) throw new NotFoundException('Global provider not found');
    const updated = await this.prisma.llmConnection.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.endpointUrl !== undefined && { endpointUrl: dto.endpointUrl, isActive: false }),
        ...(dto.apiKey !== undefined && { apiKey: dto.apiKey, isActive: false }),
        ...(dto.model !== undefined && { model: dto.model }),
      },
    });
    return this.toProvider(updated);
  }

  async deleteGlobalProvider(id: string): Promise<void> {
    const conn = await this.prisma.llmConnection.findFirst({ where: { id, pocConfigId: null } });
    if (!conn) throw new NotFoundException('Global provider not found');
    if (conn.isDefault) {
      const otherCount = await this.prisma.llmConnection.count({
        where: { pocConfigId: null, id: { not: id } },
      });
      if (otherCount > 0) {
        throw new BadRequestException({
          error: 'CANNOT_DELETE_DEFAULT',
          message: 'Designate another provider as default before deleting this one.',
        });
      }
    }
    await this.prisma.llmConnection.delete({ where: { id } });
  }

  async testGlobalProvider(id: string) {
    const conn = await this.prisma.llmConnection.findFirst({ where: { id, pocConfigId: null } });
    if (!conn) throw new NotFoundException('Global provider not found');

    const client = this.getClient(conn.endpointUrl, conn.apiKey ?? undefined);
    const start = Date.now();
    try {
      const response = await client.models.list();
      const models = response.data.map((m) => m.id);
      const latencyMs = Date.now() - start;
      await this.prisma.llmConnection.update({
        where: { id },
        data: { isActive: true, lastCheckedAt: new Date(), availableModels: JSON.stringify(models) },
      });
      return { status: 'connected' as const, models, latencyMs };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Connection failed';
      await this.prisma.llmConnection.update({
        where: { id },
        data: { isActive: false, lastCheckedAt: new Date() },
      });
      return { status: 'failed' as const, error };
    }
  }

  async setGlobalDefault(id: string): Promise<LlmProvider> {
    const conn = await this.prisma.llmConnection.findFirst({ where: { id, pocConfigId: null } });
    if (!conn) throw new NotFoundException('Global provider not found');
    await this.prisma.$transaction([
      this.prisma.llmConnection.updateMany({
        where: { pocConfigId: null },
        data: { isDefault: false },
      }),
      this.prisma.llmConnection.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return this.toProvider({ ...conn, isDefault: true });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private toProvider(conn: { id: string; pocConfigId: string | null; name: string; isDefault: boolean; endpointUrl: string; model: string; isActive: boolean; lastCheckedAt: Date | null; availableModels: string | null }): LlmProvider {
    return {
      id: conn.id,
      pocConfigId: conn.pocConfigId ?? undefined,
      isGlobal: !conn.pocConfigId,
      name: conn.name,
      isDefault: conn.isDefault,
      endpointUrl: conn.endpointUrl,
      model: conn.model,
      isActive: conn.isActive,
      lastCheckedAt: conn.lastCheckedAt?.toISOString(),
      availableModels: conn.availableModels ? JSON.parse(conn.availableModels) : undefined,
    };
  }
}
