import { IsNotEmpty, IsString } from 'class-validator';

export class SetRoutingDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;

  @IsString()
  @IsNotEmpty()
  model!: string;
}
