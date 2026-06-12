import { Module } from '@nestjs/common';
import { LlmController, LlmGlobalController, LlmRootController } from './llm.controller';
import { LlmService } from './llm.service';
import { KeyMigrationService } from './key-migration.service';

@Module({
  controllers: [LlmRootController, LlmController, LlmGlobalController],
  providers: [LlmService, KeyMigrationService],
  exports: [LlmService],
})
export class LlmModule {}
