import { Module } from '@nestjs/common';
import { ScaffoldService } from './scaffold.service';

@Module({
  providers: [ScaffoldService],
  exports: [ScaffoldService],
})
export class ScaffoldModule {}
