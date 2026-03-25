import { IsNotEmpty, IsOptional, IsString, IsInt, IsUrl } from 'class-validator';

export class IngestWebDto {
  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsInt()
  productId?: number;

  @IsOptional()
  @IsInt()
  maxDrafts?: number;
}
