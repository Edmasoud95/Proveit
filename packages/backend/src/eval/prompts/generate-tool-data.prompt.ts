import type { ToolDefinition } from '@proveit/shared';

export function buildGenerateToolDataSystemPrompt(): string {
  return `You are an expert at writing eval cases for tool-calling AI agents. Given an agent's system prompt and available tools, generate diverse test cases where the user message will realistically cause the agent to call at least one of its tools.

Return ONLY a valid JSON array (no markdown):

[
  {
    "name": "string (descriptive test name)",
    "input": {
      "messages": [{"role": "user", "content": "realistic user message that triggers tool use"}]
    },
    "judgeCriteria": "string (criteria that verifies the agent called the appropriate tool and completed the task)"
  }
]

Rules:
- Every user message MUST be specific enough to trigger at least one tool call
- Messages should feel like real user requests in the domain described by the system prompt
- Vary which tools are exercised across cases
- judgeCriteria must reference the expected tool call by name`;
}

export function buildGenerateToolDataUserPrompt(
  systemPrompt: string,
  tools: ToolDefinition[],
  count: number,
): string {
  const toolList = tools
    .map((t) => `- ${t.name}: ${t.description}`)
    .join('\n');

  return `System Prompt:
${systemPrompt}

Available tools:
${toolList}

Generate ${count} eval cases designed to trigger tool calls. Each case should exercise at least one of the listed tools.`;
}
