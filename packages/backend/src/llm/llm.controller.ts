import { Controller, Put, Post, Get, Patch, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { LlmService } from './llm.service';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { SetRoutingDto } from './dto/set-routing.dto';
import { UpsertLlmDto } from './dto/upsert-llm.dto';
import { FetchModelsDto, FetchModelsForPocDto } from './dto/fetch-models.dto';

@Controller('llm')
export class LlmRootController {
  constructor(private readonly llmService: LlmService) {}

  @Post('models')
  fetchModels(@Body() dto: FetchModelsDto) {
    return this.llmService.fetchModels(dto.endpointUrl, dto.apiKey, dto.globalProviderId);
  }
}

@Controller('pocs/:pocId/llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  // ─── Provider CRUD ────────────────────────────────────────────────────────

  @Get('providers')
  listProviders(@Param('pocId') pocId: string) {
    return this.llmService.listProviders(pocId);
  }

  @Post('providers')
  createProvider(@Param('pocId') pocId: string, @Body() dto: CreateProviderDto) {
    return this.llmService.createProvider(pocId, dto);
  }

  @Patch('providers/:id')
  updateProvider(@Param('pocId') pocId: string, @Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.llmService.updateProvider(pocId, id, dto);
  }

  @Delete('providers/:id')
  @HttpCode(204)
  deleteProvider(@Param('pocId') pocId: string, @Param('id') id: string) {
    return this.llmService.deleteProvider(pocId, id);
  }

  @Post('providers/:id/test')
  testProvider(@Param('pocId') pocId: string, @Param('id') id: string) {
    return this.llmService.testProvider(pocId, id);
  }

  @Post('providers/:id/default')
  setDefault(@Param('pocId') pocId: string, @Param('id') id: string) {
    return this.llmService.setDefault(pocId, id);
  }

  // ─── Routing ──────────────────────────────────────────────────────────────

  @Get('routing')
  getRouting(@Param('pocId') pocId: string) {
    return this.llmService.getRouting(pocId);
  }

  @Put('routing/:taskType')
  setRouting(
    @Param('pocId') pocId: string,
    @Param('taskType') taskType: string,
    @Body() dto: SetRoutingDto,
  ) {
    return this.llmService.setTaskOverride(pocId, taskType, dto.connectionId, dto.model);
  }

  @Delete('routing/:taskType')
  @HttpCode(204)
  clearRouting(@Param('pocId') pocId: string, @Param('taskType') taskType: string) {
    return this.llmService.clearTaskOverride(pocId, taskType);
  }

  // ─── Legacy shims (backward compatibility) ────────────────────────────────

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
  fetchModelsForPoc(@Body() dto: FetchModelsForPocDto) {
    return this.llmService.fetchModelsFromUrl(dto.endpointUrl, dto.apiKey);
  }

  @Get()
  getConnection(@Param('pocId') pocId: string) {
    return this.llmService.getConnection(pocId);
  }
}

@Controller('llm/global-providers')
export class LlmGlobalController {
  constructor(private readonly llmService: LlmService) {}

  @Get()
  list() {
    return this.llmService.listGlobalProviders();
  }

  @Post()
  create(@Body() dto: CreateProviderDto) {
    return this.llmService.createGlobalProvider(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.llmService.updateGlobalProvider(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string) {
    return this.llmService.deleteGlobalProvider(id);
  }

  @Post(':id/test')
  test(@Param('id') id: string) {
    return this.llmService.testGlobalProvider(id);
  }

  @Post(':id/default')
  setDefault(@Param('id') id: string) {
    return this.llmService.setGlobalDefault(id);
  }
}
