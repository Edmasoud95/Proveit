export function buildGenerateEvalsSystemPrompt(): string {
  return `You are an expert at writing eval cases for AI agents. Given an agent's system prompt and tools, generate diverse test cases.

Return ONLY valid JSON array (no markdown):

[
  {
    "name": "string (descriptive test name)",
    "input": {
      "messages": [{"role": "user", "content": "realistic user message"}]
    },
    "judgeCriteria": "string (specific, measurable criteria for pass/fail)"
  }
]

Generate cases that cover:
1. Happy path (clear, normal requests)
2. Edge cases (boundary conditions, unusual inputs)
3. Error handling (invalid requests, missing info)
4. Complex scenarios (multi-step, ambiguous)
5. Tool usage (cases that require specific tools)

Each judgeCriteria must be specific and objectively verifiable.`;
}

export function buildGenerateEvalsUserPrompt(
  systemPrompt: string,
  tools: string,
  count: number,
): string {
  return `System Prompt:
${systemPrompt}

Tools:
${tools}

Generate ${count} diverse eval cases.`;
}
