import { IsEnum, IsString } from 'class-validator';

export class AddOrganizationMemberDto {
  @IsString()
  userId: string;

  @IsEnum(['owner', 'admin', 'member', 'viewer'])
  role: string;
}
