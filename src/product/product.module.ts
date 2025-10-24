import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/Product.entity';
import { ProductContext } from 'src/product-context/entities/ProductContext.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductContext])],
  providers: [ProductService],
  controllers: [ProductController],
})
export class ProductModule {}
