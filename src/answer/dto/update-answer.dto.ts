import { IsString, IsNumber, IsOptional } from 'class-validator';

export class UpdateAnswerDto {
  @IsOptional()
  @IsString()
  answerText?: string;

  @IsOptional()
  @IsNumber()
  productContextId?: number;

  @IsOptional()
  @IsNumber()
  productQuestionId?: number;

  @IsOptional()
  @IsNumber()
  userId?: number;
}