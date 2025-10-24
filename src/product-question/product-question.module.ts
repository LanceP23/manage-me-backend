import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductQuestion } from './entities/product-question.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductQuestion])],
})
export class ProductQuestionModule {}