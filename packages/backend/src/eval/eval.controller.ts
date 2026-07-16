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
import { Observable, defer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { EvalService } from './eval.service';
import { AddCasesDto } from './dto/add-cases.dto';
import { UpdateCaseDto } from './dto/update-case.dto';
import { GenerateCasesDto } from './dto/generate-cases.dto';

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
    @Body() dto: UpdateCaseDto,
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
    @Param('pocId') pocId: string,
    @Param('runId') runId: string,
  ): Observable<MessageEvent> {
    // Verify the run belongs to this POC before exposing its stream.
    return defer(() => this.evalService.assertRunInPoc(pocId, runId)).pipe(
      switchMap(() => this.evalService.subscribeToRun(runId)),
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
