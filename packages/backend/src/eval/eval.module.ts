import { Module } from '@nestjs/common';
import { EvalController } from './eval.controller';
import { StubsController } from './stubs.controller';
import { EvalService } from './eval.service';
import { JudgeService } from './judge.service';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [LlmModule],
  controllers: [EvalController, StubsController],
  providers: [EvalService, JudgeService],
})
export class EvalModule {}
