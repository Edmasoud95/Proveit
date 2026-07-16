import { Allow, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCaseDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  // Arbitrary JSON payload — see AddCasesDto.
  @Allow()
  @IsOptional()
  input?: unknown;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  judgeCriteria?: string;

  @IsInt()
  @IsOptional()
  order?: number;
}
