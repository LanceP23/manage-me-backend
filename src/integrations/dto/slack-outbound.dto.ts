import { IsOptional, IsString } from 'class-validator';

export class SlackOutboundDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  icon_url?: string;
}
