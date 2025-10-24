import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateAnswerDto {
  @IsString()
  answerText: string;

  @IsNumber()
  productContextId: number;

  @IsOptional()
  @IsNumber()
  productQuestionId?: number;

  @IsNumber()
  userId: number;
}