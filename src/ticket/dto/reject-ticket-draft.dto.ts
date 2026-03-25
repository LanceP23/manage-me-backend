import { IsOptional, IsString } from 'class-validator';

export class RejectTicketDraftDto {
  @IsOptional()
  @IsString()
  rejectedById?: string;
}
