import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PocModule } from './poc/poc.module';
import { LlmModule } from './llm/llm.module';
import { EvalModule } from './eval/eval.module';
import { ScaffoldModule } from './scaffold/scaffold.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [PrismaModule, ScaffoldModule, PocModule, LlmModule, EvalModule, ChatModule],
})
export class AppModule {}
