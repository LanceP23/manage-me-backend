import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Answer } from '../answer/entities/answer.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationModule } from '../organization/organization.module';
import { Product } from '../product/entities/Product.entity';
import { ProductContext } from '../product-context/entities/ProductContext.entity';
import { ProductQuestion } from '../product-question/entities/product-question.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeChunk } from './entities/knowledge-chunk.entity';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { KnowledgeService } from './knowledge.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KnowledgeDocument,
      KnowledgeChunk,
      Ticket,
      Answer,
      ProductContext,
      ProductQuestion,
      Product,
    ]),
    OrganizationModule,
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, JwtAuthGuard],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
