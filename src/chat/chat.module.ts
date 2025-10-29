import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatSession } from './entities/ChatSession.entity';
import { Message } from './entities/Message.entity';
import { User } from '../users/entities/user.entity';
import { ChatSessionService } from './services/chat-session.service';
import { MessageService } from './services/message.service';
import { ProductContextModule } from '../product-context/product-context.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatSession, Message, User]),
    forwardRef(() => ProductContextModule),
  ],
  controllers: [],
  providers: [ChatSessionService, MessageService],
  exports: [ChatSessionService, MessageService],
})
export class ChatModule {}