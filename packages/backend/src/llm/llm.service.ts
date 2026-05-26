import { Injectable, NotFoundException } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LlmService {
  constructor(private prisma: PrismaService) {}

  getClient(endpointUrl: string, apiKey?: string): OpenAI {
    return new OpenAI({
      baseURL: endpointUrl,
      apiKey: apiKey ?? 'not-required',
    });
  }

  async upsert(pocId: string, endpointUrl: string, model: string, apiKey?: string) {
    return this.prisma.llmConnection.upsert({
      where: { pocConfigId: pocId },
      create: { pocConfigId: pocId, endpointUrl, model, apiKey },
      update: { endpointUrl, model, apiKey, isActive: false },
    });
  }

  async test(pocId: string) {
    const conn = await this.prisma.llmConnection.findUnique({ where: { pocConfigId: pocId } });
    if (!conn) throw new NotFoundException('No LLM connection configured');

    const client = this.getClient(conn.endpointUrl, conn.apiKey ?? undefined);
    const start = Date.now();

    try {
      const response = await client.models.list();
      const models = response.data.map((m) => m.id);
      const latencyMs = Date.now() - start;

      await this.prisma.llmConnection.update({
        where: { pocConfigId: pocId },
        data: { isActive: true, lastCheckedAt: new Date() },
      });

      return { status: 'connected' as const, models, latencyMs };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Connection failed';
      await this.prisma.llmConnection.update({
        where: { pocConfigId: pocId },
        data: { isActive: false, lastCheckedAt: new Date() },
      });
      return { status: 'failed' as const, error };
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

  async getModels(pocId: string) {
    const conn = await this.prisma.llmConnection.findUnique({ where: { pocConfigId: pocId } });
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

  async getConnection(pocId: string) {
    const conn = await this.prisma.llmConnection.findUnique({ where: { pocConfigId: pocId } });
    if (!conn) return null;
    // Never expose API key
    const { apiKey: _key, ...safe } = conn;
    return safe;
  }
}
