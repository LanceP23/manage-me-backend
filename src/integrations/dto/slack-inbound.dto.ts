import { IsOptional, IsString, IsObject } from 'class-validator';

export class SlackInboundDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  challenge?: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  team_id?: string;

  @IsOptional()
  @IsString()
  api_app_id?: string;

  @IsOptional()
  @IsString()
  event_id?: string;

  @IsOptional()
  @IsString()
  event_time?: string;

  @IsOptional()
  @IsObject()
  event?: Record<string, any>;
}
