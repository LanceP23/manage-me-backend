import {
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
  IsNumber,
  Min,
  Max,
  IsInt,
} from 'class-validator';

export const TicketStatusValues = [
  'todo',
  'in_progress',
  'done',
  'cancelled',
] as const;

export const TicketPriorityValues = ['low', 'medium', 'high', 'urgent'] as const;

export const TicketSourceValues = ['chat', 'commit', 'scrape', 'manual'] as const;

export class AiTicketDraftDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsEnum(TicketStatusValues)
  status?: string;

  @IsOptional()
  @IsEnum(TicketPriorityValues)
  priority?: string;

  @IsNotEmpty()
  @IsEnum(TicketSourceValues)
  source: string;

  @IsOptional()
  @IsString()
  aiProvider?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsString()
  rawInputHash?: string;

  @IsOptional()
  @IsInt()
  productId?: number;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}
