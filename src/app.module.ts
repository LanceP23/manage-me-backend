import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiAgentModule } from './ai-agent/ai-agent.module';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ProductContextModule } from './product-context/product-context.module';
import { ProductModule } from './product/product.module';
import { ProductQuestionModule } from './product-question/product-question.module';
import { AnswerModule } from './answer/answer.module';
import { ChatModule } from './chat/chat.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { TicketModule } from './ticket/ticket.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { OrganizationModule } from './organization/organization.module';
import { AgentModule } from './agent/agent.module';
import { UsageModule } from './usage/usage.module';
import { KnowledgeModule } from './knowledge/knowledge.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigService available globally
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    AiAgentModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
    ProductContextModule,
    ProductModule,
    ProductQuestionModule,
    AnswerModule,
    ChatModule,
    TicketModule,
    IntegrationsModule,
    OrganizationModule,
    AgentModule,
    UsageModule,
    KnowledgeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
