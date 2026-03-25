import { IsNotEmpty, IsOptional, IsString, IsNumber, Min, Max, IsInt } from 'class-validator';

export class CommitLinkDecisionDto {
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
}
