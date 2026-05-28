import { Module } from '@nestjs/common';
import { LlmController, LlmGlobalController, LlmRootController } from './llm.controller';
import { LlmService } from './llm.service';

@Module({
  controllers: [LlmRootController, LlmController, LlmGlobalController],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
