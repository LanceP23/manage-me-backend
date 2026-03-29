import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RetrieveKnowledgeDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  productId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @IsOptional()
  @IsArray()
  @IsIn(['ticket', 'product_answer'], { each: true })
  sourceTypes?: Array<'ticket' | 'product_answer'>;
}
