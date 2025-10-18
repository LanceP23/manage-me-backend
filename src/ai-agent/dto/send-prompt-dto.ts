import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ChatSession } from '../entities/ChatSession.entity';

export class SendPromptDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsOptional()
  chatSessionId?: number;
}
