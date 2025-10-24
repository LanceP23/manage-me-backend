import { Module, forwardRef } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/Product.entity';
import { GoogleGeminiAi } from 'src/ai-agent/entities/GoogleGeminiAi.entity';
import { ProductContextModule } from 'src/product-context/product-context.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
    forwardRef(() => ProductContextModule),
  ],
  providers: [ProductService, GoogleGeminiAi],
  controllers: [ProductController],
  exports: [ProductService],
})
export class ProductModule {}
