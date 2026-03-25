import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiEvaluationLog } from './entities/AiEvaluationLog.entity';
import { AiEvaluationLogService } from './ai-evaluation.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiEvaluationLog])],
  providers: [AiEvaluationLogService],
  exports: [AiEvaluationLogService],
})
export class AiEvaluationModule {}
