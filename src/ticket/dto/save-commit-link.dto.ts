import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsInt,
  IsEnum,
} from 'class-validator';

export class SaveCommitLinkDto {
  @IsNotEmpty()
  @IsString()
  commitSha: string;

  @IsNotEmpty()
  @IsString()
  commitMessage: string;

  @IsOptional()
  @IsString()
  repoUrl?: string;

  @IsOptional()
  @IsString()
  diffSummary?: string;

  @IsNotEmpty()
  @IsInt()
  ticketId: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @IsOptional()
  @IsString()
  rationale?: string;

  @IsOptional()
  @IsEnum(['todo', 'in_progress', 'done', 'cancelled'])
  updateTicketStatus?: string;
}
