import { IsOptional, IsString, IsBooleanString } from 'class-validator';

export class ListAiEvaluationLogsDto {
  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  promptVersion?: string;

  @IsOptional()
  @IsBooleanString()
  success?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  offset?: string;
}
