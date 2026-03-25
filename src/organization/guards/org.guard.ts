import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OrganizationService } from '../organization.service';

@Injectable()
export class OrgGuard implements CanActivate {
  constructor(private readonly organizationService: OrganizationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const orgId = request.headers['x-org-id'];
    if (!orgId || typeof orgId !== 'string') {
      throw new BadRequestException('x-org-id header is required');
    }

    const role = await this.organizationService.getMemberRole(user.userId, orgId);
    if (!role) {
      throw new ForbiddenException('User is not a member of this organization');
    }

    request.organizationId = orgId;
    request.organizationRole = role;
    return true;
  }
}
