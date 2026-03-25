import { IsOptional, IsString } from 'class-validator';

export class MattermostOutboundDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  icon_url?: string;
}
