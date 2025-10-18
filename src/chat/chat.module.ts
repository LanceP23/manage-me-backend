import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatSession } from './entities/ChatSession.entity';
import { Message } from './entities/Message.entity';
import { ChatSessionService } from './services/chat-session.service';
import { MessageService } from './services/message.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChatSession, Message])],
  providers: [ChatSessionService, MessageService],
  exports: [ChatSessionService, MessageService],
})
export class ChatModule {}