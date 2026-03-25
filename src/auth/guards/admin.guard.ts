import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const orgRole = request?.organizationRole
      ? String(request.organizationRole).toLowerCase()
      : null;
    if (orgRole === 'owner' || orgRole === 'admin') {
      return true;
    }

    const user = request?.user;
    const email = user?.email ? String(user.email).toLowerCase() : null;

    const raw = this.configService.get<string>('ADMIN_EMAILS') || '';
    const allowed = raw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (allowed.length && email && allowed.includes(email)) {
      return true;
    }

    throw new ForbiddenException('Admin access required');
  }
}
