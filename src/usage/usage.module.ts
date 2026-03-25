import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsageEvent } from './entities/usage-event.entity';
import { UsageMonthly } from './entities/usage-monthly.entity';
import { UsagePlan } from './entities/usage-plan.entity';
import { UsageService } from './usage.service';
import { Organization } from '../organization/entities/organization.entity';
import { UsageController } from './usage.controller';
import { OrganizationModule } from '../organization/organization.module';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsageEvent, UsageMonthly, UsagePlan, Organization]),
    OrganizationModule,
  ],
  controllers: [UsageController],
  providers: [UsageService, AdminGuard],
  exports: [UsageService],
})
export class UsageModule {}
