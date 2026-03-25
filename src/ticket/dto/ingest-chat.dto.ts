import { IsNotEmpty, IsOptional, IsString, IsInt } from 'class-validator';

export class IngestChatDto {
  @IsNotEmpty()
  @IsString()
  chatText: string;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsInt()
  productId?: number;

  @IsOptional()
  @IsInt()
  maxDrafts?: number;
}
