import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Header,
  Res,
  BadRequestException,
  Sse,
} from '@nestjs/common';
import { Response } from 'express';
import { PocService } from './poc.service';
import { CreatePocDto } from './dto/create-poc.dto';
import { UpdatePocDto } from './dto/update-poc.dto';
import { PrismaService } from '../prisma/prisma.service';

class ScaffoldPocDto {
  description!: string;
  endpointUrl?: string;
  apiKey?: string;
  model?: string;
  globalProviderId?: string;
}

@Controller('pocs')
export class PocController {
  constructor(
    private readonly pocService: PocService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('scaffold')
  @HttpCode(202)
  async scaffold(@Body() body: ScaffoldPocDto) {
    let endpointUrl = body.endpointUrl;
    let apiKey = body.apiKey;
    let model = body.model;

    if (body.globalProviderId) {
      const provider = await this.prisma.llmConnection.findFirst({
        where: { id: body.globalProviderId, pocConfigId: null },
      });
      if (!provider) throw new BadRequestException('Global provider not found');
      endpointUrl = provider.endpointUrl;
      apiKey = provider.apiKey ?? undefined;
      model = model || provider.model;
    }

    if (!endpointUrl) throw new BadRequestException('endpointUrl is required');

    const jobId = this.pocService.startScaffoldJob({ description: body.description, endpointUrl, apiKey, model });
    return { jobId };
  }

  @Sse('scaffold/stream/:jobId')
  @Header('Cache-Control', 'no-cache')
  @Header('X-Accel-Buffering', 'no')
  scaffoldStream(@Param('jobId') jobId: string) {
    return this.pocService.getJobStream(jobId);
  }

  @Get('scaffold/completed/:jobId')
  getCompletedJob(@Param('jobId') jobId: string) {
    return { pocId: this.pocService.getCompletedPocId(jobId) };
  }

  @Get()
  findAll() {
    return this.pocService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pocService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePocDto) {
    return this.pocService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.pocService.remove(id);
  }

  // ─── Config Versions ──────────────────────────────────────────────────────

  @Get(':id/config-versions')
  listConfigVersions(@Param('id') id: string) {
    return this.pocService.listConfigVersions(id);
  }

  @Get(':id/config-versions/:versionId')
  getConfigVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.pocService.getConfigVersion(id, versionId);
  }

  @Post(':id/config-versions/:versionId/restore')
  restoreConfigVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.pocService.restoreConfigVersion(id, versionId);
  }

  @Get(':id/export')
  async export(@Param('id') id: string, @Res() res: Response) {
    const data = await this.pocService.export(id);
    const filename = `${data.poc.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data, null, 2));
  }
}
