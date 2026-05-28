import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type { ToolDefinition, EvalCaseInput } from '@proveit/shared';

interface SystemPromptResult {
  name: string;
  systemPrompt: string;
}

@Injectable()
export class ScaffoldService {
  private readonly logger = new Logger(ScaffoldService.name);

  private extractJson(raw: string): string {
    // 1. Fenced code block
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return fenced[1].trim();

    // 2. Outermost { ... } — handles LLMs that add text before/after
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end > start) return raw.slice(start, end + 1);

    return raw.trim();
  }

  private parseJson<T>(raw: string, step: string): T {
    const cleaned = this.extractJson(raw);
    try {
      return JSON.parse(cleaned) as T;
    } catch (e) {
      this.logger.error(`[${step}] JSON parse failed. Raw response:\n${raw}\n\nExtracted:\n${cleaned}\n\nError: ${String(e)}`);
      throw new Error(`The LLM returned an unexpected response format during "${step}". Please retry.`);
    }
  }

  async generateSystemPrompt(
    description: string,
    client: OpenAI,
    model: string,
  ): Promise<SystemPromptResult> {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert AI agent workflow designer. Given a workflow description, generate a concise name and a detailed system prompt for the agent.

Return ONLY valid JSON (no markdown, no explanation):
{
  "name": "string (2-5 word name for this POC)",
  "systemPrompt": "string (the complete system prompt for the agent — detailed, specific, actionable)"
}`,
        },
        { role: 'user', content: `Workflow description: ${description}` },
      ],
      temperature: 0.7,
    });
    const raw = response.choices[0].message.content ?? '{}';
    return this.parseJson<SystemPromptResult>(raw, 'system-prompt');
  }

  async generateTools(
    description: string,
    systemPrompt: string,
    client: OpenAI,
    model: string,
  ): Promise<ToolDefinition[]> {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert AI agent workflow designer. Given a workflow description and agent system prompt, design 3–7 tools the agent needs.

Return ONLY valid JSON (no markdown, no explanation):
{
  "tools": [
    {
      "name": "string (snake_case tool name)",
      "description": "string (what this tool does and when to use it)",
      "parameters": {
        "type": "object",
        "properties": {
          "param_name": { "type": "string|number|boolean|array|object", "description": "what this parameter is" }
        },
        "required": ["list", "of", "required", "params"]
      },
      "mockResponse": "string (example response this tool would return)"
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Workflow description: ${description}\n\nSystem prompt: ${systemPrompt}`,
        },
      ],
      temperature: 0.7,
    });
    const raw = response.choices[0].message.content ?? '{}';
    const parsed = this.parseJson<{ tools: ToolDefinition[] }>(raw, 'tools');
    return parsed.tools ?? [];
  }

  async generateEvalCases(
    description: string,
    systemPrompt: string,
    tools: ToolDefinition[],
    client: OpenAI,
    model: string,
  ): Promise<Array<{ name: string; input: EvalCaseInput; judgeCriteria: string }>> {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are an expert AI agent evaluator. Given a workflow description, system prompt, and tools, create exactly 5 diverse evaluation test cases.

Return ONLY valid JSON (no markdown, no explanation):
{
  "evalCases": [
    {
      "name": "string (descriptive test case name)",
      "input": {
        "messages": [{ "role": "user", "content": "string (realistic user message)" }]
      },
      "judgeCriteria": "string (specific, measurable criteria for an LLM judge to score pass/fail)"
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Workflow description: ${description}\n\nSystem prompt: ${systemPrompt}\n\nTools: ${JSON.stringify(tools)}`,
        },
      ],
      temperature: 0.7,
    });
    const raw = response.choices[0].message.content ?? '{}';
    const parsed = this.parseJson<{ evalCases: Array<{ name: string; input: EvalCaseInput; judgeCriteria: string }> }>(raw, 'eval-cases');
    return parsed.evalCases ?? [];
  }
}
