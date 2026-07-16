import { describe, expect, it } from 'vitest';
import type OpenAI from 'openai';
import { JudgeService } from './judge.service';

function clientReturning(content: string | null): OpenAI {
  return {
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content } }] }),
      },
    },
  } as unknown as OpenAI;
}

const judge = new JudgeService();

describe('JudgeService.judge', () => {
  it('parses a plain JSON verdict', async () => {
    const verdict = await judge.judge(
      clientReturning('{"passed": true, "score": 9, "reasoning": "solid"}'),
      'model',
      '{}',
      'criteria',
      'response',
    );
    expect(verdict).toEqual({ passed: true, score: 9, reasoning: 'solid', failureStep: null });
  });

  it('parses a verdict wrapped in a markdown fence', async () => {
    const verdict = await judge.judge(
      clientReturning('```json\n{"passed": false, "score": 2, "reasoning": "bad", "failureStep": "wrong_tool"}\n```'),
      'model',
      '{}',
      'criteria',
      'response',
    );
    expect(verdict.passed).toBe(false);
    expect(verdict.failureStep).toBe('wrong_tool');
  });

  it('treats unparseable output as a score-0 failure', async () => {
    const verdict = await judge.judge(clientReturning('sorry, I cannot'), 'model', '{}', 'c', 'r');
    expect(verdict).toEqual({
      passed: false,
      score: 0,
      reasoning: 'No reasoning provided',
      failureStep: null,
    });
  });

  it('handles null content', async () => {
    const verdict = await judge.judge(clientReturning(null), 'model', '{}', 'c', 'r');
    expect(verdict.passed).toBe(false);
    expect(verdict.score).toBe(0);
  });

  it('clamps score to [0, 10]', async () => {
    const high = await judge.judge(
      clientReturning('{"passed": true, "score": 42, "reasoning": "x"}'),
      'model', '{}', 'c', 'r',
    );
    expect(high.score).toBe(10);
    const low = await judge.judge(
      clientReturning('{"passed": false, "score": -5, "reasoning": "x"}'),
      'model', '{}', 'c', 'r',
    );
    expect(low.score).toBe(0);
  });

  it('discards invalid failureStep values and clears it on pass', async () => {
    const invalid = await judge.judge(
      clientReturning('{"passed": false, "score": 1, "reasoning": "x", "failureStep": "nonsense"}'),
      'model', '{}', 'c', 'r',
    );
    expect(invalid.failureStep).toBeNull();
    const passed = await judge.judge(
      clientReturning('{"passed": true, "score": 9, "reasoning": "x", "failureStep": "wrong_tool"}'),
      'model', '{}', 'c', 'r',
    );
    expect(passed.failureStep).toBeNull();
  });
});
