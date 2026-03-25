import { Module, forwardRef } from '@nestjs/common';
import { ProductContextController } from './product-context.controller';
import { ProductContextService } from './services/product-context.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductContext } from './entities/ProductContext.entity';
import { ProductQuestion } from 'src/product-question/entities/product-question.entity';
import { Answer } from 'src/answer/entities/answer.entity';
import { TicketModule } from 'src/ticket/ticket.module';
import { ProductQuestionModule } from 'src/product-question/product-question.module';
import { ProductModule } from 'src/product/product.module';
import { AiProviderModule } from 'src/ai-agent/ai-provider.module';
import { AiEvaluationModule } from 'src/ai-agent/ai-evaluation.module';
import { OrganizationModule } from '../organization/organization.module';
import { Organization } from '../organization/entities/organization.entity';
import { Product } from 'src/product/entities/Product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductContext,
      ProductQuestion,
      Answer,
      Organization,
      Product,
    ]),
    ProductQuestionModule,
    forwardRef(() => ProductModule),
    AiProviderModule,
    TicketModule,
    AiEvaluationModule,
    OrganizationModule,
  ],
  controllers: [ProductContextController],
  providers: [ProductContextService],
  exports: [ProductContextService],
})
export class ProductContextModule {}
