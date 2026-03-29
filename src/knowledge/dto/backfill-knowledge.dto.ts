import { IsInt, IsOptional, Min } from 'class-validator';

export class BackfillKnowledgeDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  productId?: number;
}
