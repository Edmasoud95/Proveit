import { Type } from 'class-transformer';
import { Allow, ArrayNotEmpty, IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

export class EvalCaseInputDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  // Arbitrary JSON payload sent to the agent — no shape constraint by design.
  // @Allow keeps it from being stripped by the whitelist ValidationPipe.
  @Allow()
  input!: unknown;

  @IsString()
  @IsNotEmpty()
  judgeCriteria!: string;
}

export class AddCasesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => EvalCaseInputDto)
  cases!: EvalCaseInputDto[];
}
