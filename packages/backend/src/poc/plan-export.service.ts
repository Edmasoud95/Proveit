import { Injectable } from '@nestjs/common';
import { PocService } from './poc.service';
import type { EvalCaseInput, ToolDefinition } from '@proveit/shared';

type PlanEvalCase = { name: string; input: EvalCaseInput; judgeCriteria: string };

/**
 * Renders a POC as a plan.md handoff document for a coding agent: the
 * validated system prompt, tool contracts (with mock response shapes), and
 * eval cases as acceptance criteria. Deterministic template — no LLM calls.
 */
@Injectable()
export class PlanExportService {
  constructor(private readonly pocService: PocService) {}

  async exportPlan(pocId: string): Promise<string> {
    const poc = await this.pocService.findOne(pocId);
    const tools = poc.tools as ToolDefinition[];
    const cases = poc.evalCases as PlanEvalCase[];
    const date = poc.updatedAt.toISOString().slice(0, 10);

    const sections = [
      this.headerSection(poc.name, poc.description, date, cases.length),
      this.behaviorSection(poc.systemPrompt),
      this.toolsSection(tools),
      this.acceptanceSection(cases),
      this.verificationSection(poc.id),
    ];
    return sections.join('\n\n') + '\n';
  }

  private headerSection(name: string, description: string, date: string, caseCount: number): string {
    return [
      `# Build plan: ${name}`,
      '',
      description,
      '',
      `> Validated in Proveit on ${date} against ${caseCount} eval cases.`,
      '',
      '**For the coding agent:** implement the agent core described below using the',
      'conventions of the repository you are working in. Stack, project structure and',
      'deployment are your call — they were not part of the validation. The',
      '**Acceptance criteria** section is the definition of done.',
    ].join('\n');
  }

  private behaviorSection(systemPrompt: string): string {
    return [
      '## Agent behavior',
      '',
      'Use this system prompt as-is; the behavior below was validated against this exact text.',
      '',
      fence(systemPrompt),
    ].join('\n');
  }

  private toolsSection(tools: ToolDefinition[]): string {
    if (tools.length === 0) {
      return ['## Tools', '', 'This agent is conversation-only — no tools to implement.'].join('\n');
    }
    const blocks = tools.map((tool) => {
      const lines = [
        `### \`${tool.name}\``,
        '',
        tool.description,
        '',
        'Parameters (JSON Schema):',
        '',
        fence(JSON.stringify(tool.parameters, null, 2), 'json'),
      ];
      if (tool.mockResponse) {
        lines.push(
          '',
          'Validated response shape — the POC was validated against this mock; a real',
          'implementation should return data of this shape:',
          '',
          fence(tool.mockResponse, 'json'),
        );
      }
      return lines.join('\n');
    });
    return ['## Tools to implement', '', blocks.join('\n\n')].join('\n');
  }

  private acceptanceSection(cases: PlanEvalCase[]): string {
    const blocks = cases.map((c) => {
      const conversation = c.input.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
      return [
        `### ${c.name}`,
        '',
        'Input conversation:',
        '',
        fence(conversation),
        '',
        `**Must satisfy:** ${c.judgeCriteria}`,
      ].join('\n');
    });
    return [
      '## Acceptance criteria',
      '',
      'These cases were LLM-judged in Proveit — treat them as behavioral requirements, not string matches.',
      '',
      blocks.join('\n\n'),
    ].join('\n');
  }

  private verificationSection(pocId: string): string {
    return [
      '## Verification',
      '',
      'Once real tool implementations are wired in, re-run the validated suite:',
      'export `promptfooconfig.yaml` from Proveit',
      `(\`GET /api/pocs/${pocId}/evals/export/promptfoo\`) and run \`npx promptfoo eval\`.`,
    ].join('\n');
  }
}

/** Fenced code block whose fence is longer than any backtick run in the content. */
function fence(content: string, lang = ''): string {
  const longestRun = Math.max(2, ...[...content.matchAll(/`+/g)].map((m) => m[0].length));
  const marker = '`'.repeat(Math.max(3, longestRun + 1));
  return `${marker}${lang}\n${content}\n${marker}`;
}
