import { Module } from '@nestjs/common';
import { EvalController } from './eval.controller';
import { StubsController } from './stubs.controller';
import { EvalCaseService } from './eval-case.service';
import { EvalRunService } from './eval-run.service';
import { EvalGenerationService } from './eval-generation.service';
import { EvalSuiteVersionService } from './eval-suite-version.service';
import { EvalMetricsService } from './eval-metrics.service';
import { AgentRunnerService } from './agent-runner.service';
import { JudgeService } from './judge.service';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [LlmModule],
  controllers: [EvalController, StubsController],
  providers: [
    EvalCaseService,
    EvalRunService,
    EvalGenerationService,
    EvalSuiteVersionService,
    EvalMetricsService,
    AgentRunnerService,
    JudgeService,
  ],
})
export class EvalModule {}
