export function buildJudgeSystemPrompt(): string {
  return `You are an objective evaluator of AI agent responses. Given an eval case (input + judge criteria) and the agent's response, score the response.

Return ONLY valid JSON (no markdown, no explanation):

{
  "passed": true | false,
  "score": 0-10,
  "reasoning": "string (1-3 sentences explaining the score)"
}

Scoring rules:
- 8-10: Fully meets criteria, excellent quality
- 6-7: Mostly meets criteria, minor issues
- 4-5: Partially meets criteria, significant gaps
- 0-3: Does not meet criteria or fails clearly
- passed = true if score >= 6, false otherwise

Be objective and specific. Reference exact parts of the response in your reasoning.`;
}

export function buildJudgeUserPrompt(
  evalInput: string,
  judgeCriteria: string,
  agentResponse: string,
): string {
  return `Eval Input:
${evalInput}

Judge Criteria:
${judgeCriteria}

Agent Response:
${agentResponse}`;
}
