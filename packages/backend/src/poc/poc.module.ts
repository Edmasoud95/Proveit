import { Module } from '@nestjs/common';
import { PocController } from './poc.controller';
import { PocService } from './poc.service';
import { ScaffoldModule } from '../scaffold/scaffold.module';

@Module({
  imports: [ScaffoldModule],
  controllers: [PocController],
  providers: [PocService],
  exports: [PocService],
})
export class PocModule {}
