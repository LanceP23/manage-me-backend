// src/ticket/ticket.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { Ticket } from './entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { Product } from '../product/entities/Product.entity';
import { AiProviderModule } from '../ai-agent/ai-provider.module';
import { AiEvaluationModule } from '../ai-agent/ai-evaluation.module';
import { AiTicketService } from './ai-ticket.service';
import { TicketDraft } from './entities/ticket-draft.entity';
import { TicketDraftApprovalAudit } from './entities/ticket-draft-approval-audit.entity';
import { TicketExternalLink } from './entities/ticket-external-link.entity';
import { Organization } from '../organization/entities/organization.entity';
import { TicketDraftService } from './ticket-draft.service';
import { CommitLink } from './entities/commit-link.entity';
import { TicketCommitLinkService } from './ticket-commit-link.service';
import { TicketIngestService } from './ticket-ingest.service';
import { OrganizationModule } from '../organization/organization.module';
import { UsageModule } from '../usage/usage.module';
import { AgentModule } from '../agent/agent.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      TicketDraft,
      TicketDraftApprovalAudit,
      TicketExternalLink,
      Organization,
      CommitLink,
      User,
      Product,
    ]),
    AiProviderModule,
    AiEvaluationModule,
    OrganizationModule,
    UsageModule,
    forwardRef(() => AgentModule),
  ],
  controllers: [TicketController],
  providers: [
    TicketService,
    AiTicketService,
    TicketDraftService,
    TicketCommitLinkService,
    TicketIngestService,
  ],
  exports: [
    TicketDraftService,
    AiTicketService,
    TicketCommitLinkService,
    TicketService,
  ],
})
export class TicketModule {}
