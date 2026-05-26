export function buildScaffoldSystemPrompt(): string {
  return `You are an expert AI agent workflow designer. Given a plain-text description of an agent workflow, generate a complete POC configuration as a JSON object.

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):

{
  "name": "string (2-5 word name for this POC)",
  "systemPrompt": "string (the complete system prompt for the agent — detailed, specific, actionable)",
  "tools": [
    {
      "name": "string (snake_case tool name)",
      "description": "string (what this tool does and when to use it)",
      "parameters": {
        "type": "object",
        "properties": {
          "param_name": {
            "type": "string|number|boolean|array|object",
            "description": "what this parameter is"
          }
        },
        "required": ["list", "of", "required", "params"]
      }
    }
  ],
  "evalCases": [
    {
      "name": "string (descriptive test case name)",
      "input": {
        "messages": [
          {"role": "user", "content": "string (realistic user message)"}
        ]
      },
      "judgeCriteria": "string (what the judge should check — specific, measurable criteria)"
    }
  ]
}

Rules:
- System prompt: Write as if for a real production agent. Be specific about behavior, tone, constraints, and capabilities.
- Tools: Only include tools that are genuinely needed for this workflow. 3-7 tools is typical.
- Eval cases: Create 5 diverse test cases covering happy path, edge cases, and potential failures. Each judgeCriteria should be specific enough for an LLM judge to score pass/fail objectively.
- Return ONLY the JSON object, nothing else.`;
}

export function buildScaffoldUserPrompt(description: string): string {
  return `Workflow description: ${description}`;
}
