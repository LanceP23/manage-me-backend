import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiEvaluationLog } from './entities/AiEvaluationLog.entity';
import { ListAiEvaluationLogsDto } from './dto/list-ai-evaluation-logs.dto';

type AiLogInput = {
  provider: string;
  prompt: string;
  response?: string | null;
  context?: string | null;
  organizationId?: string | null;
  metadata?: Record<string, any> | null;
  errorMessage?: string | null;
};

@Injectable()
export class AiEvaluationLogService {
  constructor(
    @InjectRepository(AiEvaluationLog)
    private readonly logRepository: Repository<AiEvaluationLog>,
  ) {}

  async logSuccess(input: AiLogInput) {
    await this.safeSave({
      ...input,
      success: true,
      errorMessage: null,
    });
  }

  async logFailure(input: AiLogInput) {
    await this.safeSave({
      ...input,
      success: false,
    });
  }

  private async safeSave(input: {
    provider: string;
    prompt: string;
    response?: string | null;
    context?: string | null;
    organizationId?: string | null;
    metadata?: Record<string, any> | null;
    success: boolean;
    errorMessage?: string | null;
  }) {
    try {
      const log = new AiEvaluationLog();
      log.provider = input.provider;
      log.prompt = this.sanitizeTextRequired(input.prompt);
      log.response = this.sanitizeTextOptional(input.response ?? null);
      log.context = this.sanitizeTextOptional(input.context ?? null);
      log.organizationId = input.organizationId ?? null;
      log.metadata = input.metadata ?? null;
      log.success = input.success;
      log.errorMessage = this.sanitizeTextOptional(input.errorMessage ?? null);
      await this.logRepository.save(log);
    } catch (error) {
      // Swallow logging errors to avoid impacting primary flows.
    }
  }

  async listLogs(params: ListAiEvaluationLogsDto, organizationId?: string) {
    const take = this.normalizeLimit(params.limit);
    const skip = this.normalizeOffset(params.offset);

    const query = this.logRepository.createQueryBuilder('log');
    query.andWhere('log.deletedAt IS NULL');
    if (organizationId) {
      query.andWhere('log.organizationId = :organizationId', { organizationId });
    }

    if (params.provider) {
      query.andWhere('log.provider = :provider', { provider: params.provider });
    }

    if (params.success !== undefined) {
      const success = params.success === 'true';
      query.andWhere('log.success = :success', { success });
    }

    if (params.type) {
      query.andWhere("log.metadata ->> 'type' = :type", { type: params.type });
    }

    if (params.promptVersion) {
      query.andWhere("log.metadata ->> 'promptVersion' = :promptVersion", {
        promptVersion: params.promptVersion,
      });
    }

    query.orderBy('log.createdAt', 'DESC').take(take).skip(skip);

    const [items, total] = await query.getManyAndCount();

    return {
      items,
      total,
      limit: take,
      offset: skip,
    };
  }

  async exportLogsCsv(params: ListAiEvaluationLogsDto, organizationId?: string) {
    const result = await this.listLogs(params, organizationId);
    const header = [
      'id',
      'provider',
      'success',
      'type',
      'promptVersion',
      'createdAt',
      'errorMessage',
      'prompt',
      'response',
      'context',
    ];

    const rows = result.items.map((item) => {
      const type = item.metadata?.type ?? '';
      const promptVersion = item.metadata?.promptVersion ?? '';
      return [
        item.id,
        item.provider,
        item.success,
        type,
        promptVersion,
        item.createdAt?.toISOString?.() || '',
        item.errorMessage || '',
        item.prompt || '',
        item.response || '',
        item.context || '',
      ]
        .map((value) => this.escapeCsv(String(value)))
        .join(',');
    });

    return [header.join(','), ...rows].join('\n');
  }

  async deleteOlderThan(days: number, organizationId?: string) {
    if (!Number.isFinite(days) || days < 1) {
      return {
        deleted: 0,
        message: 'days must be >= 1',
      };
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const query = this.logRepository
      .createQueryBuilder()
      .update()
      .set({ deletedAt: () => 'CURRENT_TIMESTAMP' })
      .where('createdAt < :cutoff', { cutoff })
      .andWhere('deletedAt IS NULL');

    if (organizationId) {
      query.andWhere('organizationId = :organizationId', { organizationId });
    }

    const result = await query.execute();

    return {
      deleted: result.affected || 0,
      cutoff,
    };
  }

  private normalizeLimit(input?: string): number {
    const parsed = Number(input);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 50;
    }
    return Math.min(parsed, 200);
  }

  private normalizeOffset(input?: string): number {
    const parsed = Number(input);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Math.floor(parsed);
  }

  private escapeCsv(value: string): string {
    if (value.includes('"')) {
      value = value.replace(/"/g, '""');
    }
    if (value.includes(',') || value.includes('\n') || value.includes('\r')) {
      return `"${value}"`;
    }
    return value;
  }

  private sanitizeTextRequired(input: string): string {
    return this.sanitizeTextOptional(input) || '';
  }

  private sanitizeTextOptional(input: string | null): string | null {
    if (!input) {
      return input;
    }

    let output = input;
    output = output.replace(
      /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
      'Bearer [REDACTED]',
    );
    output = output.replace(/sk-[A-Za-z0-9]{20,}/g, '[REDACTED_API_KEY]');
    output = output.replace(/AIza[0-9A-Za-z\-_]{20,}/g, '[REDACTED_API_KEY]');
    output = output.replace(/ghp_[A-Za-z0-9]{20,}/g, '[REDACTED_TOKEN]');
    return output;
  }
}
