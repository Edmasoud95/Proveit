import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Sse,
  MessageEvent,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { EvalService } from './eval.service';

class AddCasesDto {
  cases!: Array<{ name: string; input: unknown; judgeCriteria: string }>;
}

class GenerateCasesDto {
  count?: number = 5;
  toolFocused?: boolean = false;
}

@Controller('pocs/:pocId/evals')
export class EvalController {
  constructor(private readonly evalService: EvalService) {}

  @Post()
  addCases(@Param('pocId') pocId: string, @Body() dto: AddCasesDto) {
    return this.evalService.addCases(pocId, dto.cases);
  }

  @Patch('cases/:caseId')
  updateCase(
    @Param('pocId') pocId: string,
    @Param('caseId') caseId: string,
    @Body() dto: Partial<{ name: string; input: unknown; judgeCriteria: string; order: number }>,
  ) {
    return this.evalService.updateCase(pocId, caseId, dto);
  }

  @Delete('cases/:caseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCase(@Param('pocId') pocId: string, @Param('caseId') caseId: string) {
    return this.evalService.deleteCase(pocId, caseId);
  }

  @Post('generate')
  generateCases(@Param('pocId') pocId: string, @Body() dto: GenerateCasesDto) {
    return this.evalService.generateCases(pocId, dto.count, dto.toolFocused);
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

  @Delete('runs/:runId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRun(@Param('pocId') pocId: string, @Param('runId') runId: string) {
    return this.evalService.deleteRun(pocId, runId);
  }

  @Get('versions')
  listVersions(@Param('pocId') pocId: string) {
    return this.evalService.listVersions(pocId);
  }

  @Get('compare')
  compareRuns(
    @Param('pocId') pocId: string,
    @Query('runA') runAId: string,
    @Query('runB') runBId: string,
  ) {
    return this.evalService.compareRuns(pocId, runAId, runBId);
  }
}
