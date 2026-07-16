import { IsOptional, IsString, IsUrl } from 'class-validator';

export class FetchModelsDto {
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  @IsOptional()
  endpointUrl?: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  globalProviderId?: string;
}

export class FetchModelsForPocDto {
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true })
  endpointUrl!: string;

  @IsString()
  @IsOptional()
  apiKey?: string;
}
