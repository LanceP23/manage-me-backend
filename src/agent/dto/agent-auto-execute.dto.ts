import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class AgentAutoExecuteDto {
  @IsString()
  context: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedActions?: string[];

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minConfidence?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(25)
  maxActions?: number;

  @IsOptional()
  @IsString()
  source?: string;
}
