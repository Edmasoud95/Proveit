import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { buildJudgeSystemPrompt, buildJudgeUserPrompt } from './prompts/judge.prompt';

export interface JudgeVerdict {
  passed: boolean;
  score: number;
  reasoning: string;
  failureStep: 'wrong_tool' | 'wrong_arguments' | 'wrong_final_response' | null;
}

@Injectable()
export class JudgeService {
  async judge(
    client: OpenAI,
    model: string,
    evalInput: string,
    judgeCriteria: string,
    agentResponse: string,
    pipelineTrace: string | null = null,
  ): Promise<JudgeVerdict> {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: buildJudgeSystemPrompt() },
        {
          role: 'user',
          content: buildJudgeUserPrompt(evalInput, judgeCriteria, agentResponse, pipelineTrace),
        },
      ],
      temperature: 0.1,
    });

    const raw = response.choices[0].message.content ?? '{}';
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
    let parsed: Partial<JudgeVerdict> = {};
    try {
      parsed = JSON.parse(jsonStr) as Partial<JudgeVerdict>;
    } catch {
      // fallback: unparseable response treated as a score-0 failure
    }

    const validFailureSteps = ['wrong_tool', 'wrong_arguments', 'wrong_final_response'];
    const failureStep = validFailureSteps.includes(parsed.failureStep as string)
      ? (parsed.failureStep as JudgeVerdict['failureStep'])
      : null;

    return {
      passed: parsed.passed ?? false,
      score: Math.max(0, Math.min(10, parsed.score ?? 0)),
      reasoning: parsed.reasoning ?? 'No reasoning provided',
      failureStep: parsed.passed ? null : failureStep,
    };
  }
}
