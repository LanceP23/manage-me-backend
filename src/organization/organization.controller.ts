import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { AddOrganizationMemberDto } from './dto/add-organization-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  createOrganization(@Body() input: CreateOrganizationDto, @Req() req: Request) {
    const user = (req as any).user;
    const ownerUserId = user?.userId;
    return this.organizationService.createOrganization({
      ...input,
      ownerUserId,
    });
  }

  @Post(':id/members')
  async addMember(
    @Param('id') organizationId: string,
    @Body() input: AddOrganizationMemberDto,
    @Req() req: Request,
  ) {
    const user = (req as any).user;
    const userId = user?.userId;
    await this.organizationService.assertUserHasAnyRole(userId, organizationId, [
      'owner',
      'admin',
    ]);
    const actorRole = await this.organizationService.getMemberRole(
      userId,
      organizationId,
    );
    const targetRole = String(input.role || '').toLowerCase();
    if (
      actorRole !== 'owner' &&
      (targetRole === 'owner' || targetRole === 'admin')
    ) {
      throw new ForbiddenException(
        'Only organization owners can assign owner/admin roles',
      );
    }

    return this.organizationService.addMember(organizationId, input);
  }

  @Get(':id/members')
  async listMembers(@Param('id') organizationId: string, @Req() req: Request) {
    const user = (req as any).user;
    await this.organizationService.assertUserHasAnyRole(
      user?.userId,
      organizationId,
      ['owner', 'admin'],
    );
    return this.organizationService.listMembers(organizationId);
  }
}
