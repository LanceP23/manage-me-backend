import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  isString,
} from 'class-validator';

export class CreateAnswerDto {
  @IsString()
  answerText: string;

  @IsNumber()
  productContextId: number;

  @IsOptional()
  @IsNumber()
  productQuestionId?: number;

  @IsUUID()
  userId: string;
}
