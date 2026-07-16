import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class GenerateStubsDto {
  @IsBoolean()
  @IsOptional()
  overwrite?: boolean = false;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  toolNames?: string[];
}
