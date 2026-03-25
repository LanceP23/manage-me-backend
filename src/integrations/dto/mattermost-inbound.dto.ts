import { IsOptional, IsString } from 'class-validator';

export class MattermostInboundDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsString()
  team_id?: string;

  @IsOptional()
  @IsString()
  team_domain?: string;

  @IsOptional()
  @IsString()
  channel_id?: string;

  @IsOptional()
  @IsString()
  channel_name?: string;

  @IsOptional()
  @IsString()
  post_id?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  trigger_word?: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsString()
  user_name?: string;

  @IsOptional()
  @IsString()
  timestamp?: string;
}
