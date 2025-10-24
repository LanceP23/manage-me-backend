import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  domain: string;

  @IsOptional()
  @IsNumber()
  userId?: number;
}