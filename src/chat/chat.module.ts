import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatSession } from './entities/ChatSession.entity';
import { Message } from './entities/Message.entity';
import { User } from '../users/entities/user.entity';
import { ChatSessionService } from './services/chat-session.service';
import { MessageService } from './services/message.service';
import { ChatController } from './chat.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ChatSession, Message, User])],
  controllers: [ChatController],
  providers: [ChatSessionService, MessageService],
  exports: [ChatSessionService, MessageService],
})
export class ChatModule {}