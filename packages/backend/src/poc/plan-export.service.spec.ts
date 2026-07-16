import { describe, expect, it } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import type { PocService } from './poc.service';
import { PlanExportService } from './plan-export.service';

const basePoc = {
  id: 'poc-1',
  name: 'Support Triage Agent',
  description: 'Routes support tickets to the right team.',
  systemPrompt: 'You are a support triage agent.\nBe terse.',
  updatedAt: new Date('2026-07-16T12:00:00Z'),
  tools: [
    {
      name: 'lookup_customer',
      description: 'Fetch a customer record by email.',
      parameters: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] },
      mockResponse: '{"id": "cus_1", "plan": "pro"}',
    },
    {
      name: 'escalate',
      description: 'Escalate to a human.',
      parameters: { type: 'object', properties: { reason: { type: 'string' } } },
    },
  ],
  evalCases: [
    {
      name: 'routes billing question',
      input: { messages: [{ role: 'user', content: 'I was double charged' }] },
      judgeCriteria: 'Response routes the ticket to billing.',
    },
    {
      name: 'multi-turn cancellation',
      input: {
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello!' },
          { role: 'user', content: 'Cancel my plan' },
        ],
      },
      judgeCriteria: 'Response starts the cancellation flow.',
    },
  ],
};

function makeService(poc: unknown = basePoc): PlanExportService {
  const pocService = {
    findOne: async (id: string) => {
      if (poc === null) throw new NotFoundException('POC not found');
      void id;
      return poc;
    },
  } as unknown as PocService;
  return new PlanExportService(pocService);
}

describe('PlanExportService.exportPlan', () => {
  it('propagates NotFoundException for a missing POC', async () => {
    await expect(makeService(null).exportPlan('nope')).rejects.toThrow(NotFoundException);
  });

  it('renders header with name, description and provenance', async () => {
    const md = await makeService().exportPlan('poc-1');
    expect(md.startsWith('# Build plan: Support Triage Agent')).toBe(true);
    expect(md).toContain('Routes support tickets to the right team.');
    expect(md).toContain('Validated in Proveit on 2026-07-16 against 2 eval cases');
    expect(md).toContain('definition of done');
  });

  it('includes the system prompt verbatim in a fence', async () => {
    const md = await makeService().exportPlan('poc-1');
    expect(md).toContain('You are a support triage agent.\nBe terse.');
    expect(md).toContain('Use this system prompt as-is');
  });

  it('renders one tool section per tool with its JSON schema', async () => {
    const md = await makeService().exportPlan('poc-1');
    expect(md).toContain('### `lookup_customer`');
    expect(md).toContain('### `escalate`');
    expect(md).toContain('"required": [\n    "email"\n  ]');
  });

  it('shows mock response shape when present and omits the block otherwise', async () => {
    const md = await makeService().exportPlan('poc-1');
    const lookupSection = md.slice(md.indexOf('### `lookup_customer`'), md.indexOf('### `escalate`'));
    const escalateSection = md.slice(md.indexOf('### `escalate`'), md.indexOf('## Acceptance criteria'));
    expect(lookupSection).toContain('{"id": "cus_1", "plan": "pro"}');
    expect(lookupSection).toContain('Validated response shape');
    expect(escalateSection).not.toContain('Validated response shape');
  });

  it('says the agent is conversation-only when there are no tools', async () => {
    const md = await makeService({ ...basePoc, tools: [] }).exportPlan('poc-1');
    expect(md).toContain('conversation-only');
    expect(md).not.toContain('### `');
  });

  it('renders one acceptance block per eval case with conversation and criteria', async () => {
    const md = await makeService().exportPlan('poc-1');
    expect(md).toContain('### routes billing question');
    expect(md).toContain('user: I was double charged');
    expect(md).toContain('**Must satisfy:** Response routes the ticket to billing.');
    expect(md).toContain('assistant: Hello!');
    expect(md).toContain('behavioral requirements, not string matches');
  });

  it('points verification at the promptfoo export', async () => {
    const md = await makeService().exportPlan('poc-1');
    expect(md).toContain('/evals/export/promptfoo');
    expect(md).toContain('npx promptfoo eval');
  });

  it('extends fences when content contains triple backticks', async () => {
    const md = await makeService({
      ...basePoc,
      systemPrompt: 'Use this snippet:\n```js\nconsole.log(1)\n```',
    }).exportPlan('poc-1');
    expect(md).toContain('````\nUse this snippet:');
    expect(md).toContain('```\n````');
  });
});
