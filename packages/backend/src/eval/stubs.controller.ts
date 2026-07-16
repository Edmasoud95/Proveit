import { Controller, Post, Body, Param } from '@nestjs/common';
import { EvalService } from './eval.service';
import { GenerateStubsDto } from './dto/generate-stubs.dto';

@Controller('pocs/:pocId/tools')
export class StubsController {
  constructor(private readonly evalService: EvalService) {}

  @Post('stubs/generate')
  generateStubs(@Param('pocId') pocId: string, @Body() dto: GenerateStubsDto) {
    return this.evalService.generateStubs(pocId, dto.overwrite ?? false, dto.toolNames);
  }
}
