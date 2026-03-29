import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnswerService } from './answer.service';
import { AnswerController } from './answer.controller';
import { Answer } from './entities/answer.entity';
import { ProductContext } from 'src/product-context/entities/ProductContext.entity';
import { ProductQuestion } from 'src/product-question/entities/product-question.entity';
import { User } from 'src/users/entities/user.entity';
import { OrganizationModule } from '../organization/organization.module';
import { AdminGuard } from '../auth/guards/admin.guard';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Answer, ProductContext, ProductQuestion, User]),
    OrganizationModule,
    KnowledgeModule,
  ],
  providers: [AnswerService, AdminGuard],
  controllers: [AnswerController],
})
export class AnswerModule {}
