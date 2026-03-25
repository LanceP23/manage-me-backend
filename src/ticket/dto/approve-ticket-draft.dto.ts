import { IsOptional, IsEnum, IsString, IsInt } from 'class-validator';

export class ApproveTicketDraftDto {
  @IsOptional()
  @IsString()
  approvedById?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['todo', 'in_progress', 'done', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority?: string;

  @IsOptional()
  @IsInt()
  productId?: number;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}
