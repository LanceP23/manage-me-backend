import { IsInt, IsOptional, IsString } from 'class-validator';

export class MergeTicketDraftDto {
  @IsInt()
  targetTicketId: number;

  @IsOptional()
  @IsString()
  mergedById?: string;
}
