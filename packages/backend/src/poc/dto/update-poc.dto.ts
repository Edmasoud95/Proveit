import { IsString, IsOptional, IsArray } from 'class-validator';

export class UpdatePocDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @IsArray()
  @IsOptional()
  tools?: Record<string, unknown>[];
}
