import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class GenerateCasesDto {
  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  count?: number = 5;

  @IsBoolean()
  @IsOptional()
  toolFocused?: boolean = false;
}
