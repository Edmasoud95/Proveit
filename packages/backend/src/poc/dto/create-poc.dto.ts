import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreatePocDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  description!: string;
}
