import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateProviderDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  endpointUrl?: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  model?: string;
}
