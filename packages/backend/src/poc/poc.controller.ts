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
} from '@nestjs/common';
import { Response } from 'express';
import { PocService } from './poc.service';
import { CreatePocDto } from './dto/create-poc.dto';
import { UpdatePocDto } from './dto/update-poc.dto';

class ScaffoldPocDto {
  description!: string;
  endpointUrl!: string;
  apiKey?: string;
  model?: string;
}

@Controller('pocs')
export class PocController {
  constructor(private readonly pocService: PocService) {}

  @Post('scaffold')
  scaffold(@Body() body: ScaffoldPocDto) {
    return this.pocService.scaffoldWithLlm(
      body.description,
      body.endpointUrl,
      body.apiKey,
      body.model,
    );
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

  @Get(':id/export')
  async export(@Param('id') id: string, @Res() res: Response) {
    const data = await this.pocService.export(id);
    const filename = `${data.poc.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data, null, 2));
  }
}
