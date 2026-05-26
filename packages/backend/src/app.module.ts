import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PocModule } from './poc/poc.module';
import { LlmModule } from './llm/llm.module';
import { EvalModule } from './eval/eval.module';
import { ScaffoldModule } from './scaffold/scaffold.module';

@Module({
  imports: [PrismaModule, ScaffoldModule, PocModule, LlmModule, EvalModule],
})
export class AppModule {}
