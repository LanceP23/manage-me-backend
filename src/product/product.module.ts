import { Module, forwardRef } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/Product.entity';
import { ProductContextModule } from 'src/product-context/product-context.module';
import { AiProviderModule } from 'src/ai-agent/ai-provider.module';
import { OrganizationModule } from '../organization/organization.module';
import { Organization } from '../organization/entities/organization.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Organization, User]),
    forwardRef(() => ProductContextModule),
    AiProviderModule,
    OrganizationModule,
  ],
  providers: [ProductService],
  controllers: [ProductController],
  exports: [ProductService],
})
export class ProductModule {}
