export function buildJudgeSystemPrompt(): string {
  return `You are an objective evaluator of AI agent responses. Given an eval case (input + judge criteria), the agent's final response, and optionally the pipeline trace (tool calls and responses), score the response.

Return ONLY valid JSON (no markdown, no explanation):

{
  "passed": true | false,
  "score": 0-10,
  "reasoning": "string (1-3 sentences explaining the score)",
  "failureStep": "wrong_tool" | "wrong_arguments" | "wrong_final_response" | null
}

Scoring rules:
- 8-10: Fully meets criteria, excellent quality
- 6-7: Mostly meets criteria, minor issues
- 4-5: Partially meets criteria, significant gaps
- 0-3: Does not meet criteria or fails clearly
- passed = true if score >= 6, false otherwise

failureStep rules:
- Set to null when passed is true
- "wrong_tool": agent called a tool that was incorrect or unnecessary for the task
- "wrong_arguments": agent called the right tool but passed incorrect or malformed arguments
- "wrong_final_response": tool calls were correct but the final text response was wrong or incomplete
- Set to null if you cannot clearly attribute the failure to a specific step

Be objective and specific. Reference exact parts of the response in your reasoning.`;
}

export function buildJudgeUserPrompt(
  evalInput: string,
  judgeCriteria: string,
  agentResponse: string,
  pipelineTrace: string | null,
): string {
  const traceSection = pipelineTrace
    ? `\nPipeline Trace (tool calls and responses):\n${pipelineTrace}\n`
    : '';

  return `Eval Input:
${evalInput}

Judge Criteria:
${judgeCriteria}
${traceSection}
Agent Final Response:
${agentResponse}`;
}
