import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationEvent } from './entities/integration-event.entity';
import { IntegrationConfig } from './entities/integration-config.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { TicketExternalLink } from '../ticket/entities/ticket-external-link.entity';
import { TicketModule } from '../ticket/ticket.module';
import { UsageModule } from '../usage/usage.module';
import { OrganizationModule } from '../organization/organization.module';
import { Product } from '../product/entities/Product.entity';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntegrationEvent,
      IntegrationConfig,
      TicketExternalLink,
      Ticket,
      Product,
    ]),
    forwardRef(() => TicketModule),
    UsageModule,
    OrganizationModule,
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, AdminGuard],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
