import {
  Controller,
  Get,
  Headers,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgGuard } from '../organization/guards/org.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UsageService } from './usage.service';
import { UsageEventKind } from './entities/usage-event.entity';

type UsageEventsQuery = {
  kind?: UsageEventKind;
  limit?: string;
};

@Controller('usage')
@UseGuards(JwtAuthGuard, OrgGuard, AdminGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get('summary')
  getSummary(@Headers('x-org-id') orgId?: string) {
    return this.usageService.getUsageSummary(orgId || '');
  }

  @Get('events')
  getEvents(
    @Headers('x-org-id') orgId?: string,
    @Query() query?: UsageEventsQuery,
  ) {
    const limit = query?.limit ? Number(query.limit) : undefined;
    return this.usageService.listRecentEvents(orgId || '', {
      kind: query?.kind,
      limit,
    });
  }
}
