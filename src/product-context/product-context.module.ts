import { Module } from '@nestjs/common';
import { ProductContextController } from './product-context.controller';
import { ProductContextService } from './services/product-context.service';
import { ChatModule } from 'src/chat/chat.module';

@Module({
  imports: [ChatModule],
  controllers: [ProductContextController],
  providers: [ProductContextService],
})
export class ProductContextModule {}
