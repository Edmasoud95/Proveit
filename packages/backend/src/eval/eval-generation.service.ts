import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { EvalCaseService } from './eval-case.service';
import {
  buildGenerateEvalsSystemPrompt,
  buildGenerateEvalsUserPrompt,
} from './prompts/generate-evals.prompt';
import {
  buildGenerateStubsSystemPrompt,
  buildGenerateStubsUserPrompt,
} from './prompts/generate-stubs.prompt';
import {
  buildGenerateToolDataSystemPrompt,
  buildGenerateToolDataUserPrompt,
} from './prompts/generate-tool-data.prompt';
import type { ToolDefinition } from '@proveit/shared';

/** LLM-backed generation of eval cases and tool stub responses. */
@Injectable()
export class EvalGenerationService {
  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
    private evalCases: EvalCaseService,
  ) {}

  async generateCases(pocId: string, count: number = 5, toolFocused: boolean = false) {
    const poc = await this.prisma.pocConfig.findUnique({ where: { id: pocId } });
    if (!poc) throw new NotFoundException('POC not found');

    const { client, model } = await this.llmService.resolveForTask(pocId, 'eval-gen').catch(() => {
      throw new BadRequestException('No default LLM provider configured. Add a provider on the LLM Settings page.');
    });

    const tools: ToolDefinition[] = JSON.parse(poc.tools);

    const systemPrompt = toolFocused
      ? buildGenerateToolDataSystemPrompt()
      : buildGenerateEvalsSystemPrompt();
    const userPrompt = toolFocused
      ? buildGenerateToolDataUserPrompt(poc.systemPrompt, tools, count)
      : buildGenerateEvalsUserPrompt(poc.systemPrompt, poc.tools, count);

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
    });

    const raw = response.choices[0].message.content ?? '[]';
    const jsonStr = extractJson(raw);

    let parsed: Array<{ name: string; input: unknown; judgeCriteria: string }>;
    try {
      const obj = JSON.parse(jsonStr);
      parsed = Array.isArray(obj) ? obj : (obj.cases ?? []);
    } catch {
      throw new BadRequestException('Failed to parse generated eval cases');
    }

    return this.evalCases.addCases(pocId, parsed.slice(0, count));
  }

  async generateStubs(pocId: string, overwrite: boolean, toolNames?: string[]) {
    const poc = await this.prisma.pocConfig.findUnique({ where: { id: pocId } });
    if (!poc) throw new NotFoundException('POC not found');

    const tools: ToolDefinition[] = JSON.parse(poc.tools);
    if (tools.length === 0) throw new BadRequestException('No tools defined on this POC');

    const eligible = toolNames?.length ? tools.filter((t) => toolNames.includes(t.name)) : tools;
    const toolsToGenerate = overwrite ? eligible : eligible.filter((t) => !t.mockResponse);
    const skipped = tools.filter((t) => !toolsToGenerate.find((g) => g.name === t.name)).map((t) => t.name);

    if (toolsToGenerate.length === 0) {
      return { generated: [], skipped, failed: [] };
    }

    const { client, model } = await this.llmService.resolveForTask(pocId, 'stub-gen').catch(() => {
      throw new BadRequestException('No default LLM provider configured. Add a provider on the LLM Settings page.');
    });

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: buildGenerateStubsSystemPrompt() },
        { role: 'user', content: buildGenerateStubsUserPrompt(toolsToGenerate) },
      ],
      temperature: 0.7,
    });

    const raw = response.choices[0].message.content ?? '{}';
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch {
      // fall through — every requested tool lands in `failed`
    }

    const generated: string[] = [];
    const failed: string[] = [];

    const updatedTools = tools.map((t) => {
      if (!toolsToGenerate.find((g) => g.name === t.name)) return t;
      const value = parsed[t.name];
      if (value !== undefined) {
        generated.push(t.name);
        return { ...t, mockResponse: JSON.stringify(value) };
      }
      failed.push(t.name);
      return t;
    });

    await this.prisma.pocConfig.update({
      where: { id: pocId },
      data: { tools: JSON.stringify(updatedTools) },
    });

    return { generated, skipped, failed };
  }
}

/** Extract a JSON payload from an LLM response, stripping a ```json fence if present. */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : raw).trim();
}
