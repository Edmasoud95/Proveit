import { describe, expect, it, vi } from 'vitest';
import type OpenAI from 'openai';
import { AgentRunnerService } from './agent-runner.service';
import type { ToolDefinition } from '@proveit/shared';

type Completion = {
  choices: Array<{ finish_reason: string; message: Record<string, unknown> }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

function clientWithResponses(responses: Completion[]): { client: OpenAI; create: ReturnType<typeof vi.fn> } {
  const create = vi.fn();
  responses.forEach((r) => create.mockResolvedValueOnce(r));
  return { client: { chat: { completions: { create } } } as unknown as OpenAI, create };
}

const textResponse = (content: string, usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }): Completion => ({
  choices: [{ finish_reason: 'stop', message: { content } }],
  usage,
});

const toolCallResponse = (name: string, id = 'call_1'): Completion => ({
  choices: [
    {
      finish_reason: 'tool_calls',
      message: {
        content: null,
        tool_calls: [{ id, type: 'function', function: { name, arguments: '{}' } }],
      },
    },
  ],
  usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
});

const weatherTool: ToolDefinition = {
  name: 'get_weather',
  description: 'Get weather',
  parameters: { type: 'object', properties: {} },
  mockResponse: '{"temp": 21}',
};

const runner = new AgentRunnerService();
const userMessages = [{ role: 'user', content: 'hi' }];

describe('AgentRunnerService.callAgent', () => {
  it('returns a direct answer and accumulates token usage', async () => {
    const { client } = clientWithResponses([textResponse('hello')]);
    const result = await runner.callAgent(client, 'm', 'sys', userMessages, []);
    expect(result.response).toBe('hello');
    expect(result.totalTokens).toBe(15);
    // history = system + user + assistant
    expect(result.history).toHaveLength(3);
  });

  it('feeds the stubbed tool response back and continues the loop', async () => {
    const { client, create } = clientWithResponses([
      toolCallResponse('get_weather'),
      textResponse('21 degrees'),
    ]);
    const result = await runner.callAgent(client, 'm', 'sys', userMessages, [weatherTool]);
    expect(result.response).toBe('21 degrees');
    expect(result.totalTokens).toBe(45);

    // Second call must include the tool result message with the stub content
    const secondCallMessages = create.mock.calls[1][0].messages as Array<Record<string, unknown>>;
    const toolMsg = secondCallMessages.find((m) => m.role === 'tool');
    expect(toolMsg).toMatchObject({ tool_call_id: 'call_1', content: '{"temp": 21}' });
  });

  it('answers with an error payload for unknown tools instead of crashing', async () => {
    const { client, create } = clientWithResponses([
      toolCallResponse('unknown_tool'),
      textResponse('ok'),
    ]);
    await runner.callAgent(client, 'm', 'sys', userMessages, [weatherTool]);
    const secondCallMessages = create.mock.calls[1][0].messages as Array<Record<string, unknown>>;
    const toolMsg = secondCallMessages.find((m) => m.role === 'tool');
    expect(String(toolMsg?.content)).toContain("'unknown_tool' is not defined");
  });

  it('only advertises tools that have a stub configured', async () => {
    const stubless: ToolDefinition = { ...weatherTool, name: 'no_stub', mockResponse: undefined };
    const { client, create } = clientWithResponses([textResponse('done')]);
    await runner.callAgent(client, 'm', 'sys', userMessages, [weatherTool, stubless]);
    const tools = create.mock.calls[0][0].tools as Array<{ function: { name: string } }>;
    expect(tools.map((t) => t.function.name)).toEqual(['get_weather']);
  });

  it('throws after the max-iteration guard when the model loops on tool calls', async () => {
    const responses = Array.from({ length: 10 }, (_, i) => toolCallResponse('get_weather', `call_${i}`));
    const { client } = clientWithResponses(responses);
    await expect(runner.callAgent(client, 'm', 'sys', userMessages, [weatherTool])).rejects.toThrow(
      'maximum iterations',
    );
  });
});

describe('AgentRunnerService.serializePipelineTrace', () => {
  it('drops the system prompt and serializes the rest', () => {
    const history = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ] as OpenAI.Chat.ChatCompletionMessageParam[];
    const trace = runner.serializePipelineTrace(history);
    expect(JSON.parse(trace!)).toHaveLength(2);
  });

  it('returns null when there is nothing beyond the system prompt', () => {
    const history = [{ role: 'system', content: 'sys' }] as OpenAI.Chat.ChatCompletionMessageParam[];
    expect(runner.serializePipelineTrace(history)).toBeNull();
  });
});
