import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { ScaffoldService } from '../scaffold/scaffold.service';
import { PocService } from './poc.service';

const dbPoc = {
  id: 'p1',
  name: 'Test POC',
  description: 'desc',
  systemPrompt: 'You are helpful.',
  tools: '[{"name":"t1","description":"d","parameters":{}}]',
  metadata: '{"k":"v"}',
  evalCases: [{ id: 'c1', input: '{"messages":[]}', name: 'case', judgeCriteria: 'crit', order: 0 }],
  llmConnections: [],
};

function makeService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    pocConfig: {
      findUnique: vi.fn().mockResolvedValue(dbPoc),
      update: vi.fn().mockResolvedValue({ ...dbPoc }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    pocConfigVersion: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'v1', versionNumber: 1 }),
    },
    ...prismaOverrides,
  } as unknown as PrismaService;
  const scaffold = {} as ScaffoldService;
  return { service: new PocService(prisma, scaffold), prisma };
}

describe('PocService.findOne', () => {
  it('parses tools, metadata, and eval case inputs from their JSON columns', async () => {
    const { service } = makeService();
    const poc = await service.findOne('p1');
    expect(poc.tools).toEqual([{ name: 't1', description: 'd', parameters: {} }]);
    expect(poc.metadata).toEqual({ k: 'v' });
    expect(poc.evalCases[0].input).toEqual({ messages: [] });
  });

  it('throws NotFoundException for a missing POC', async () => {
    const { service } = makeService({
      pocConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});

describe('PocService.update', () => {
  it('serializes tools and creates a config version when config content changes', async () => {
    const { service, prisma } = makeService();
    const tools = [{ name: 't2' }];
    await service.update('p1', { tools });
    expect(prisma.pocConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tools: JSON.stringify(tools) } }),
    );
    expect(prisma.pocConfigVersion.create).toHaveBeenCalled();
  });

  it('does not create a config version for a rename', async () => {
    const { service, prisma } = makeService();
    await service.update('p1', { name: 'renamed' });
    expect(prisma.pocConfigVersion.create).not.toHaveBeenCalled();
  });
});

describe('PocService.createConfigVersion', () => {
  it('skips versioning when the content hash is unchanged', async () => {
    const { service, prisma } = makeService();
    await service.createConfigVersion('p1', 'prompt', '[]');
    const created = (prisma.pocConfigVersion.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .data as { contentHash: string };

    const { service: service2, prisma: prisma2 } = makeService({
      pocConfigVersion: {
        findFirst: vi.fn().mockResolvedValue({ contentHash: created.contentHash, versionNumber: 1 }),
        create: vi.fn(),
      },
    });
    await service2.createConfigVersion('p1', 'prompt', '[]');
    expect(prisma2.pocConfigVersion.create).not.toHaveBeenCalled();
  });
});

describe('PocService.startScaffoldJob', () => {
  it('rejects invalid endpoint URLs before starting a job', () => {
    const { service } = makeService();
    expect(() =>
      service.startScaffoldJob({ description: 'x', endpointUrl: 'ftp://nope' }),
    ).toThrow();
  });
});
