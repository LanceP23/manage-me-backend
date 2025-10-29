import { Module, forwardRef } from '@nestjs/common';
import { ProductContextController } from './product-context.controller';
import { ProductContextService } from './services/product-context.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductContext } from './entities/ProductContext.entity';
import { ProductQuestion } from 'src/product-question/entities/product-question.entity';
import { Answer } from 'src/answer/entities/answer.entity';
import { ProductQuestionModule } from 'src/product-question/product-question.module';
import { ProductModule } from 'src/product/product.module';
import { GoogleGeminiAi } from 'src/ai-agent/entities/GoogleGeminiAi.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductContext, ProductQuestion, Answer]),
    ProductQuestionModule,
    forwardRef(() => ProductModule),
  ],
  controllers: [ProductContextController],
  providers: [ProductContextService, GoogleGeminiAi],
  exports: [ProductContextService],
})
export class ProductContextModule {}
