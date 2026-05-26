import { Controller, Put, Post, Get, Body, Param } from '@nestjs/common';
import { LlmService } from './llm.service';

class UpsertLlmDto {
  endpointUrl!: string;
  model!: string;
  apiKey?: string;
}

@Controller('llm')
export class LlmRootController {
  constructor(private readonly llmService: LlmService) {}

  @Post('models')
  fetchModels(@Body() dto: { endpointUrl: string; apiKey?: string }) {
    return this.llmService.fetchModelsFromUrl(dto.endpointUrl, dto.apiKey);
  }
}

@Controller('pocs/:pocId/llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Put()
  upsert(@Param('pocId') pocId: string, @Body() dto: UpsertLlmDto) {
    return this.llmService.upsert(pocId, dto.endpointUrl, dto.model, dto.apiKey);
  }

  @Post('test')
  test(@Param('pocId') pocId: string) {
    return this.llmService.test(pocId);
  }

  @Get('models')
  getModels(@Param('pocId') pocId: string) {
    return this.llmService.getModels(pocId);
  }

  @Post('models')
  fetchModelsForPoc(@Body() dto: { endpointUrl: string; apiKey?: string }) {
    return this.llmService.fetchModelsFromUrl(dto.endpointUrl, dto.apiKey);
  }

  @Get()
  getConnection(@Param('pocId') pocId: string) {
    return this.llmService.getConnection(pocId);
  }
}
