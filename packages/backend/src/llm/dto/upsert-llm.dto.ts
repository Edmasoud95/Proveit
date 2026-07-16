import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpsertLlmDto {
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  endpointUrl!: string;

  @IsString()
  @IsNotEmpty()
  model!: string;

  @IsString()
  @IsOptional()
  apiKey?: string;
}
