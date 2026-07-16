import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class ScaffoldPocDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  endpointUrl?: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  globalProviderId?: string;
}
