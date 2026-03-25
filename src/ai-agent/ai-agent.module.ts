import { Module } from '@nestjs/common';
import { AiAgentController } from './ai-agent.controller';
import { AiEvaluationLogController } from './ai-evaluation.controller';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AiAgentService } from './ai-agent.service';
import { ChatModule } from '../chat/chat.module';
import { AiProviderModule } from './ai-provider.module';
import { AiEvaluationModule } from './ai-evaluation.module';
import { OrganizationModule } from '../organization/organization.module';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [
    ChatModule,
    AiProviderModule,
    AiEvaluationModule,
    OrganizationModule,
    UsageModule,
  ],
  controllers: [AiAgentController, AiEvaluationLogController],
  providers: [AiAgentService, AdminGuard],
})
export class AiAgentModule {}
