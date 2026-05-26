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
    return this.scaffold.scaffold(description, endpointUrl, apiKey, model);
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
        llmConnection: true,
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
    return this.prisma.pocConfig.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.systemPrompt !== undefined && { systemPrompt: dto.systemPrompt }),
        ...(dto.tools !== undefined && { tools: JSON.stringify(dto.tools) }),
      },
      include: { evalCases: true, llmConnection: true },
    });
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
}
