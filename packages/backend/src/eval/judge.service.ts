import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { buildJudgeSystemPrompt, buildJudgeUserPrompt } from './prompts/judge.prompt';

interface JudgeVerdict {
  passed: boolean;
  score: number;
  reasoning: string;
}

@Injectable()
export class JudgeService {
  async judge(
    client: OpenAI,
    model: string,
    evalInput: string,
    judgeCriteria: string,
    agentResponse: string,
  ): Promise<JudgeVerdict> {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: buildJudgeSystemPrompt() },
        {
          role: 'user',
          content: buildJudgeUserPrompt(evalInput, judgeCriteria, agentResponse),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const raw = response.choices[0].message.content ?? '{}';
    const parsed = JSON.parse(raw) as Partial<JudgeVerdict>;

    return {
      passed: parsed.passed ?? false,
      score: Math.max(0, Math.min(10, parsed.score ?? 0)),
      reasoning: parsed.reasoning ?? 'No reasoning provided',
    };
  }
}
