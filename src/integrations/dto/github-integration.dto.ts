import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateGithubIntegrationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  productId?: number;

  @IsOptional()
  @IsString()
  repoId?: string;

  @IsOptional()
  @IsString()
  repoFullName?: string;

  @IsString()
  webhookSecret: string;
}

export class UpdateGithubIntegrationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  productId?: number | null;

  @IsOptional()
  @IsString()
  repoId?: string | null;

  @IsOptional()
  @IsString()
  repoFullName?: string | null;

  @IsOptional()
  @IsString()
  webhookSecret?: string;
}
