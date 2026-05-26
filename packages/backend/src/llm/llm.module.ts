import { Module } from '@nestjs/common';
import { LlmController, LlmRootController } from './llm.controller';
import { LlmService } from './llm.service';

@Module({
  controllers: [LlmRootController, LlmController],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
