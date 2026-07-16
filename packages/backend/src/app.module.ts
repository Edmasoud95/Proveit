import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { PocModule } from './poc/poc.module';
import { LlmModule } from './llm/llm.module';
import { EvalModule } from './eval/eval.module';
import { ScaffoldModule } from './scaffold/scaffold.module';
import { ChatModule } from './chat/chat.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

@Module({
  imports: [PrismaModule, ScaffoldModule, PocModule, LlmModule, EvalModule, ChatModule],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
