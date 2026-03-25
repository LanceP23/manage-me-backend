import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentController } from './agent.controller';
import { AgentActionService } from './agent-action.service';
import { AgentDecisionService } from './agent-decision.service';
import { AgentActionLog } from './entities/agent-action-log.entity';
import { TicketModule } from '../ticket/ticket.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { OrganizationModule } from '../organization/organization.module';
import { AiProviderModule } from '../ai-agent/ai-provider.module';
import { AiEvaluationModule } from '../ai-agent/ai-evaluation.module';
import { UsageModule } from '../usage/usage.module';
import { AdminGuard } from '../auth/guards/admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentActionLog]),
    forwardRef(() => TicketModule),
    forwardRef(() => IntegrationsModule),
    OrganizationModule,
    AiProviderModule,
    AiEvaluationModule,
    UsageModule,
  ],
  controllers: [AgentController],
  providers: [AgentActionService, AgentDecisionService, AdminGuard],
  exports: [AgentActionService, AgentDecisionService],
})
export class AgentModule {}
