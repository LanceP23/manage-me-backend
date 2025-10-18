import { Module } from '@nestjs/common';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';
import { GoogleGeminiAi } from './entities/GoogleGeminiAi.entity';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule],
  controllers: [AiAgentController],
  providers: [AiAgentService, GoogleGeminiAi],
})
export class AiAgentModule {}
