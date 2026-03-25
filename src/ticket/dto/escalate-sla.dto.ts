import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class EscalateSlaDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  days?: number;

  @IsOptional()
  @IsEnum(['todo', 'in_progress', 'done', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority?: string;
}
