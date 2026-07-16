import { Injectable, NotFoundException } from '@nestjs/common';
import { dump } from 'js-yaml';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import type { EvalCaseInput } from '@proveit/shared';

type ResolvedProvider = { model: string; endpointUrl: string };

/**
 * Exports a POC's eval suite as a runnable promptfooconfig.yaml so users can
 * graduate to Promptfoo for CI regression testing. API keys are never
 * exported; tool stubs are not ported (promptfoo cannot execute them).
 */
@Injectable()
export class PromptfooExportService {
  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
  ) {}

  async exportConfig(pocId: string): Promise<string> {
    const poc = await this.prisma.pocConfig.findUnique({
      where: { id: pocId },
      include: { evalCases: { orderBy: { order: 'asc' } } },
    });
    if (!poc) throw new NotFoundException('POC not found');

    const agent = await this.resolveOrNull(pocId, 'agent');
    const judge = await this.resolveOrNull(pocId, 'judge');

    const config: Record<string, unknown> = {
      description: `${poc.name} — exported from Proveit`,
      prompts: [this.buildPromptTemplate(poc.systemPrompt)],
      providers: [
        agent
          ? { id: `openai:chat:${agent.model}`, config: { apiBaseUrl: agent.endpointUrl } }
          : 'openai:chat:gpt-4o',
      ],
      tests: poc.evalCases.map((c) => {
        const input = JSON.parse(c.input) as EvalCaseInput;
        return {
          description: c.name,
          vars: { messages: input.messages },
          assert: [{ type: 'llm-rubric', value: c.judgeCriteria }],
        };
      }),
    };
    if (judge) {
      // llm-rubric does NOT inherit the main provider's apiBaseUrl — the
      // grader must carry its own provider config.
      config.defaultTest = {
        options: {
          provider: {
            id: `openai:chat:${judge.model}`,
            config: { apiBaseUrl: judge.endpointUrl },
          },
        },
      };
    }

    return this.header(poc.name, { hasAgent: !!agent, hasJudge: !!judge }) + dump(config, { lineWidth: 120 });
  }

  private async resolveOrNull(pocId: string, task: 'agent' | 'judge'): Promise<ResolvedProvider | null> {
    try {
      const { model, endpointUrl } = await this.llmService.resolveForTask(pocId, task);
      return { model, endpointUrl };
    } catch {
      return null;
    }
  }

  /**
   * Single chat-format prompt: the system prompt is inlined as a JSON string
   * literal; the per-test `messages` var is appended via a nunjucks loop so
   * multi-turn eval inputs work without per-case prompt duplication.
   */
  private buildPromptTemplate(systemPrompt: string): string {
    return (
      `[{"role": "system", "content": ${JSON.stringify(systemPrompt)}}` +
      `{% for m in messages %}, {"role": "{{ m.role }}", "content": {{ m.content | dump }}}{% endfor %}]`
    );
  }

  private header(pocName: string, opts: { hasAgent: boolean; hasJudge: boolean }): string {
    const safeName = pocName.replace(/\s+/g, ' ').trim();
    const lines = [
      `# promptfooconfig.yaml — exported from Proveit (POC: ${safeName})`,
      '# Run with: npx promptfoo eval',
      '#',
      '# API keys are NOT exported. If your endpoint requires one, set the',
      '# OPENAI_API_KEY environment variable before running promptfoo.',
      '# Tool definitions and mock stubs are not ported — promptfoo does not execute',
      "# Proveit's tool stubs, so these tests grade the final assistant response only.",
    ];
    if (!opts.hasAgent) {
      lines.push('#', '# No LLM provider was configured in Proveit — edit the placeholder provider below.');
    }
    if (!opts.hasJudge) {
      lines.push('#', "# No judge provider configured — llm-rubric uses promptfoo's default grader (OpenAI).");
    }
    return lines.join('\n') + '\n';
  }
}
