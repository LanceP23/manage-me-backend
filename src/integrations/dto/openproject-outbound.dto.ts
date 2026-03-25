import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class OpenProjectOutboundDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  ticketId?: number;

  @IsInt()
  @Min(1)
  projectId: number;

  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  typeId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  priorityId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  statusId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  assigneeId?: number;
}
