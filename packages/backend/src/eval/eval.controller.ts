import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Sse,
  MessageEvent,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Observable, fromEvent } from 'rxjs';
import { map } from 'rxjs/operators';
import { EvalService } from './eval.service';

class AddCasesDto {
  cases!: Array<{ name: string; input: unknown; judgeCriteria: string }>;
}

class GenerateCasesDto {
  count?: number = 5;
}

@Controller('pocs/:pocId/evals')
export class EvalController {
  constructor(private readonly evalService: EvalService) {}

  @Post()
  addCases(@Param('pocId') pocId: string, @Body() dto: AddCasesDto) {
    return this.evalService.addCases(pocId, dto.cases);
  }

  @Post('generate')
  generateCases(@Param('pocId') pocId: string, @Body() dto: GenerateCasesDto) {
    return this.evalService.generateCases(pocId, dto.count);
  }

  @Post('run')
  @HttpCode(HttpStatus.ACCEPTED)
  startRun(@Param('pocId') pocId: string) {
    return this.evalService.startRun(pocId);
  }

  @Sse('run/:runId/stream')
  streamRun(
    @Param('pocId') _pocId: string,
    @Param('runId') runId: string,
  ): Observable<MessageEvent> {
    const subject = this.evalService.subscribeToRun(runId);
    return subject.pipe(
      map((event) => ({
        type: event.type,
        data: JSON.stringify(event.data),
      })),
    );
  }

  @Get('runs')
  listRuns(@Param('pocId') pocId: string) {
    return this.evalService.listRuns(pocId);
  }

  @Get('runs/:runId')
  getRun(@Param('pocId') pocId: string, @Param('runId') runId: string) {
    return this.evalService.getRun(pocId, runId);
  }
}
