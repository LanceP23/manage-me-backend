import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  IsInt,
} from 'class-validator';

export class LinkCommitDto {
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

  @IsOptional()
  @IsInt()
  productId?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  candidateTicketIds?: number[];
}
