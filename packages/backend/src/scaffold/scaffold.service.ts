import { Injectable, BadRequestException } from '@nestjs/common';
import OpenAI from 'openai';
import { buildScaffoldSystemPrompt, buildScaffoldUserPrompt } from './prompts/scaffold.prompt';
import { PrismaService } from '../prisma/prisma.service';

interface ScaffoldedTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ScaffoldedEvalCase {
  name: string;
  input: Record<string, unknown>;
  judgeCriteria: string;
}

interface ScaffoldResult {
  name: string;
  systemPrompt: string;
  tools: ScaffoldedTool[];
  evalCases: ScaffoldedEvalCase[];
}

@Injectable()
export class ScaffoldService {
  constructor(private prisma: PrismaService) {}

  async scaffold(description: string, endpointUrl: string, apiKey?: string, model?: string) {
    const client = new OpenAI({
      baseURL: endpointUrl,
      apiKey: apiKey ?? 'not-required',
    });

    const targetModel = model ?? 'gpt-4o';

    let raw: string;
    try {
      const response = await client.chat.completions.create({
        model: targetModel,
        messages: [
          { role: 'system', content: buildScaffoldSystemPrompt() },
          { role: 'user', content: buildScaffoldUserPrompt(description) },
        ],
        temperature: 0.7,
      });
      raw = response.choices[0].message.content ?? '{}';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'LLM call failed';
      throw new BadRequestException(`Scaffolding failed: ${message}`);
    }

    // Strip markdown code fences if the model wrapped JSON in ```json ... ```
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/([\s\S]*)/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();

    let result: ScaffoldResult;
    try {
      result = JSON.parse(jsonStr) as ScaffoldResult;
    } catch {
      throw new BadRequestException('Scaffolding returned invalid JSON');
    }

    const poc = await this.prisma.pocConfig.create({
      data: {
        name: result.name ?? description.slice(0, 50),
        description,
        systemPrompt: result.systemPrompt ?? '',
        tools: JSON.stringify(result.tools ?? []),
        evalCases: {
          create: (result.evalCases ?? []).map((c, i) => ({
            name: c.name,
            input: JSON.stringify(c.input),
            judgeCriteria: c.judgeCriteria,
            order: i,
          })),
        },
      },
      include: { evalCases: true, llmConnection: true },
    });

    return poc;
  }
}
