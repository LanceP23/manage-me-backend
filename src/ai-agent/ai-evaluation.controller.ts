import { Controller, Get, Post, Body, Query, UseGuards, Res, Headers } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AiEvaluationLogService } from './ai-evaluation.service';
import { ListAiEvaluationLogsDto } from './dto/list-ai-evaluation-logs.dto';
import { RetentionPolicyDto } from './dto/retention-policy.dto';
import { OrgGuard } from '../organization/guards/org.guard';

@Controller('ai-evaluation-logs')
@UseGuards(JwtAuthGuard, OrgGuard, AdminGuard)
export class AiEvaluationLogController {
  constructor(private readonly aiEvaluationLogService: AiEvaluationLogService) {}

  @Get()
  list(
    @Query() query: ListAiEvaluationLogsDto,
    @Headers('x-org-id') orgId?: string,
  ) {
    return this.aiEvaluationLogService.listLogs(query, orgId);
  }

  @Get('export')
  async exportCsv(
    @Query() query: ListAiEvaluationLogsDto,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-org-id') orgId?: string,
  ) {
    const csv = await this.aiEvaluationLogService.exportLogsCsv(query, orgId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="ai-evaluation-logs.csv"',
    );
    return csv;
  }

  @Post('retention')
  applyRetention(
    @Body() body: RetentionPolicyDto,
    @Headers('x-org-id') orgId?: string,
  ) {
    return this.aiEvaluationLogService.deleteOlderThan(body.days, orgId);
  }
}
