import { IsOptional, IsNumber, Min, Max, IsEnum, IsString } from 'class-validator';
import { LinkCommitDto } from './link-commit.dto';

export class AutoLinkCommitDto extends LinkCommitDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minConfidence?: number;

  @IsOptional()
  @IsEnum(['todo', 'in_progress', 'done', 'cancelled'])
  updateTicketStatus?: string;

  @IsOptional()
  @IsString()
  autoLinkReason?: string;
}
