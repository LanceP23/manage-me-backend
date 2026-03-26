import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  IsObject,
} from 'class-validator';
import { TicketSourceValues } from './ai-ticket-draft.dto';

export class GenerateTicketDraftsDto {
  @IsNotEmpty()
  @IsEnum(TicketSourceValues)
  source: string;

  @IsNotEmpty()
  @IsString()
  rawInput: string;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsString()
  aiProvider?: string;

  @IsOptional()
  @IsInt()
  productId?: number;

  @IsOptional()
  @IsInt()
  maxDrafts?: number;

  @IsOptional()
  @IsObject()
  decisionSnapshot?: Record<string, unknown>;
}
