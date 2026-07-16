import { describe, expect, it } from 'vitest';
import { load } from 'js-yaml';
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { LlmService } from '../llm/llm.service';
import { PromptfooExportService } from './promptfoo-export.service';

type LoadedConfig = {
  description: string;
  prompts: string[];
  providers: unknown[];
  tests: Array<{ description: string; vars: { messages: unknown[] }; assert: unknown[] }>;
  defaultTest?: unknown;
};

type ResolvedProvider = {
  model: string;
  endpointUrl: string;
  providerName: string;
  connectionId: string;
};

const basePoc = {
  id: 'poc-1',
  name: 'Support Triage Agent',
  description: 'Routes tickets',
  systemPrompt: 'You are a support triage agent.\nBe terse.',
  evalCases: [
    {
      id: 'c1',
      name: 'routes billing question',
      input: JSON.stringify({ messages: [{ role: 'user', content: 'I was double charged' }] }),
      judgeCriteria: 'Response routes the ticket to billing.',
      order: 0,
    },
    {
      id: 'c2',
      name: 'multi-turn follow-up',
      input: JSON.stringify({
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello, how can I help?' },
          { role: 'user', content: 'Cancel my plan' },
        ],
      }),
      judgeCriteria: 'Response starts the cancellation flow.',
      order: 1,
    },
  ],
};

function makeService(opts: {
  poc?: typeof basePoc | null;
  agent?: (ResolvedProvider & Record<string, unknown>) | null;
  judge?: (ResolvedProvider & Record<string, unknown>) | null;
}) {
  const prisma = {
    pocConfig: { findUnique: async () => opts.poc ?? null },
  } as unknown as PrismaService;
  const llm = {
    resolveForTask: async (_pocId: string, task: string) => {
      const resolved = task === 'agent' ? opts.agent : opts.judge;
      if (!resolved) throw new NotFoundException('No default LLM provider configured');
      return resolved;
    },
  } as unknown as LlmService;
  return new PromptfooExportService(prisma, llm);
}

const agent: ResolvedProvider & Record<string, unknown> = {
  model: 'qwen2.5-7b',
  endpointUrl: 'http://localhost:1234/v1',
  providerName: 'LM Studio',
  connectionId: 'conn-1',
  // Simulates a future regression where resolveForTask leaks the key:
  apiKey: 'sk-secret-key-123',
};

const judge: ResolvedProvider = {
  model: 'gpt-4o-mini',
  endpointUrl: 'http://localhost:1234/v1',
  providerName: 'LM Studio',
  connectionId: 'conn-1',
};

describe('PromptfooExportService.exportConfig', () => {
  it('throws NotFoundException for a missing POC', async () => {
    const service = makeService({ poc: null, agent, judge });
    await expect(service.exportConfig('nope')).rejects.toThrow(NotFoundException);
  });

  it('emits parseable YAML with one test per eval case', async () => {
    const service = makeService({ poc: basePoc, agent, judge });
    const text = await service.exportConfig('poc-1');
    const config = load(text) as LoadedConfig;

    expect(config.tests).toHaveLength(2);
    expect(config.tests[0]).toEqual({
      description: 'routes billing question',
      vars: { messages: [{ role: 'user', content: 'I was double charged' }] },
      assert: [{ type: 'llm-rubric', value: 'Response routes the ticket to billing.' }],
    });
    expect(config.tests[1].vars.messages).toHaveLength(3);
  });

  it('maps the agent provider and embeds the system prompt in the prompt template', async () => {
    const service = makeService({ poc: basePoc, agent, judge });
    const config = load(await service.exportConfig('poc-1')) as LoadedConfig;

    expect(config.providers).toEqual([
      { id: 'openai:chat:qwen2.5-7b', config: { apiBaseUrl: 'http://localhost:1234/v1' } },
    ]);
    expect(config.prompts).toHaveLength(1);
    // System prompt is JSON-encoded inside the chat template; messages come from vars.
    expect(config.prompts[0]).toContain(JSON.stringify(basePoc.systemPrompt));
    expect(config.prompts[0]).toContain('{% for m in messages %}');
  });

  it('routes llm-rubric grading to the judge provider via defaultTest', async () => {
    const service = makeService({ poc: basePoc, agent, judge });
    const config = load(await service.exportConfig('poc-1')) as LoadedConfig;

    expect(config.defaultTest).toEqual({
      options: {
        provider: {
          id: 'openai:chat:gpt-4o-mini',
          config: { apiBaseUrl: 'http://localhost:1234/v1' },
        },
      },
    });
  });

  it('never includes API key material in the output', async () => {
    const service = makeService({ poc: basePoc, agent, judge });
    const text = await service.exportConfig('poc-1');
    expect(text).not.toContain('sk-secret-key-123');
    expect(text).not.toContain('apiKey');
  });

  it('falls back to a placeholder provider and default grader when nothing is configured', async () => {
    const service = makeService({ poc: basePoc, agent: null, judge: null });
    const text = await service.exportConfig('poc-1');
    const config = load(text) as LoadedConfig;

    expect(config.providers).toEqual(['openai:chat:gpt-4o']);
    expect(config.defaultTest).toBeUndefined();
    expect(text).toContain('No LLM provider was configured');
  });

  it('starts with a header comment explaining keys and stub limitations', async () => {
    const text = await makeService({ poc: basePoc, agent, judge }).exportConfig('poc-1');
    expect(text.startsWith('# promptfooconfig.yaml — exported from Proveit')).toBe(true);
    expect(text).toContain('npx promptfoo eval');
    expect(text).toContain('OPENAI_API_KEY');
    expect(text).toContain('stubs are not ported');
  });
});
