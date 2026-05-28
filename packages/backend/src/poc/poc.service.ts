import { createHash } from 'crypto';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScaffoldService } from '../scaffold/scaffold.service';
import { CreatePocDto } from './dto/create-poc.dto';
import { UpdatePocDto } from './dto/update-poc.dto';

@Injectable()
export class PocService {
  constructor(
    private prisma: PrismaService,
    private scaffold: ScaffoldService,
  ) {}

  async create(dto: CreatePocDto) {
    // Use a fallback LLM config (user must connect their own for scaffolding)
    // Look for any existing LLM connection to use for scaffolding
    // For now, require user to have a global default or pass endpoint in request
    // Simplified: scaffold with a placeholder if no LLM connected yet
    throw new BadRequestException(
      'Connect an LLM endpoint before creating a POC. Use POST /api/pocs/scaffold with endpoint details.',
    );
  }

  async scaffoldWithLlm(
    description: string,
    endpointUrl: string,
    apiKey?: string,
    model?: string,
  ) {
    const poc = await this.scaffold.scaffold(description, endpointUrl, apiKey, model);
    await this.createConfigVersion(poc.id, poc.systemPrompt, poc.tools, 'Initial version');
    return poc;
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
