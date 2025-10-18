import { Module } from '@nestjs/common';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatSession } from './entities/ChatSession.entity';
import { Message } from './entities/Message.entity';
import { GoogleGeminiAi } from './entities/GoogleGeminiAi.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChatSession, Message])],
  controllers: [AiAgentController],
  providers: [AiAgentService, GoogleGeminiAi],
})
export class AiAgentModule {}
