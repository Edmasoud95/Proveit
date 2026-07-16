import { Controller, Post, Body, Param } from '@nestjs/common';
import { EvalGenerationService } from './eval-generation.service';
import { GenerateStubsDto } from './dto/generate-stubs.dto';

@Controller('pocs/:pocId/tools')
export class StubsController {
  constructor(private readonly generation: EvalGenerationService) {}

  @Post('stubs/generate')
  generateStubs(@Param('pocId') pocId: string, @Body() dto: GenerateStubsDto) {
    return this.generation.generateStubs(pocId, dto.overwrite ?? false, dto.toolNames);
  }
}
