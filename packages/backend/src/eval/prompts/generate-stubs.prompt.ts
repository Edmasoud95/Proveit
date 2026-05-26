interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  mockResponse?: string;
}

export function buildGenerateStubsSystemPrompt(): string {
  return `You are a test data generator. Given a list of tool definitions, produce realistic mock responses for each tool.
Return ONLY a valid JSON object where each key is a tool name and each value is the mock response object that tool would realistically return.
Produce domain-appropriate, diverse values. Do not include any explanation or markdown — just the JSON object.`;
}

export function buildGenerateStubsUserPrompt(tools: ToolDefinition[]): string {
  const toolList = tools
    .map(
      (t) =>
        `Tool: ${t.name}\nDescription: ${t.description}\nParameters: ${JSON.stringify(t.parameters, null, 2)}`,
    )
    .join('\n\n');

  return `Generate mock responses for these tools:\n\n${toolList}\n\nReturn a JSON object: { "tool_name": <mock response object>, ... }`;
}
