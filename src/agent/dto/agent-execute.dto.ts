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
  ValidateNested,
} from 'class-validator';

export class AgentDecisionDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsString()
  rationale?: string;

  @IsOptional()
  @IsString()
  promptVersion?: string;

  @IsOptional()
  @IsString()
  source?: string;
}

export class AgentActionInputDto {
  @IsString()
  type: string;

  @IsObject()
  payload: Record<string, any>;
}

export class AgentExecuteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentActionInputDto)
  actions: AgentActionInputDto[];

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AgentDecisionDto)
  decision?: AgentDecisionDto;
}
