import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsageEvent, UsageEventKind } from './entities/usage-event.entity';
import { UsageMonthly } from './entities/usage-monthly.entity';
import { UsagePlan } from './entities/usage-plan.entity';
import { Organization } from '../organization/entities/organization.entity';
import {
  DEFAULT_USAGE_LIMITS,
  UsageLimitKey,
  USAGE_PLAN_SLUGS,
} from './usage.constants';

const KIND_TO_FIELD: Record<UsageEventKind, UsageLimitKey> = {
  ai_prompt: 'aiPrompts',
  ticket_draft: 'ticketDrafts',
  agent_action: 'agentActions',
  commit_link: 'commitLinks',
  integration_draft: 'integrationDrafts',
  triage_analysis: 'triageAnalyses',
};

@Injectable()
export class UsageService {
  constructor(
    @InjectRepository(UsageEvent)
    private readonly usageEventRepository: Repository<UsageEvent>,
    @InjectRepository(UsageMonthly)
    private readonly usageMonthlyRepository: Repository<UsageMonthly>,
    @InjectRepository(UsagePlan)
    private readonly usagePlanRepository: Repository<UsagePlan>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  getMonthKey(date: Date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    return `${year}-${month}`;
  }

  async assertWithinLimit(
    organizationId: string,
    kind: UsageEventKind,
    quantity = 1,
  ): Promise<void> {
    if (!organizationId) {
      throw new BadRequestException('Organization is required for usage checks');
    }

    const limitKey = KIND_TO_FIELD[kind];
    const limit = await this.getLimitForOrg(organizationId, limitKey);
    if (!limit || limit === 0) {
      return;
    }

    const monthKey = this.getMonthKey();
    const monthly = await this.usageMonthlyRepository.findOne({
      where: { organizationId, monthKey },
    });
    const used = monthly ? Number(monthly[limitKey] ?? 0) : 0;
    if (used + quantity > limit) {
      throw new HttpException(
        `Usage limit exceeded for ${limitKey} (${used}/${limit})`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async recordEvent(input: {
    organizationId: string;
    userId?: string | null;
    kind: UsageEventKind;
    quantity?: number;
    metadata?: Record<string, any> | null;
  }): Promise<UsageEvent> {
    const quantity = input.quantity ?? 1;
    const event = this.usageEventRepository.create({
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      kind: input.kind,
      quantity,
      metadata: input.metadata ?? null,
    });

    await this.usageEventRepository.save(event);
    await this.incrementMonthly(input.organizationId, input.kind, quantity);

    return event;
  }

  async getUsageSummary(organizationId: string, date = new Date()) {
    if (!organizationId) {
      throw new BadRequestException('Organization is required for usage summary');
    }

    const monthKey = this.getMonthKey(date);
    const monthly = await this.usageMonthlyRepository.findOne({
      where: { organizationId, monthKey },
    });

    const plan = await this.getPlanForOrg(organizationId);
    const limits =
      plan?.limits ??
      (DEFAULT_USAGE_LIMITS[plan?.slug || USAGE_PLAN_SLUGS.FREE] ||
        DEFAULT_USAGE_LIMITS[USAGE_PLAN_SLUGS.FREE]);

    return {
      organizationId,
      monthKey,
      plan: plan
        ? { slug: plan.slug, name: plan.name }
        : { slug: USAGE_PLAN_SLUGS.FREE, name: 'Free' },
      usage: {
        aiPrompts: monthly?.aiPrompts ?? 0,
        ticketDrafts: monthly?.ticketDrafts ?? 0,
        agentActions: monthly?.agentActions ?? 0,
        commitLinks: monthly?.commitLinks ?? 0,
        integrationDrafts: monthly?.integrationDrafts ?? 0,
        triageAnalyses: monthly?.triageAnalyses ?? 0,
      },
      limits,
    };
  }

  async listRecentEvents(
    organizationId: string,
    options?: { kind?: UsageEventKind; limit?: number },
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization is required for usage events');
    }

    const limit = Math.max(1, Math.min(options?.limit || 25, 100));
    const query = this.usageEventRepository
      .createQueryBuilder('event')
      .where('event.organizationId = :organizationId', { organizationId })
      .orderBy('event.createdAt', 'DESC')
      .take(limit);

    if (options?.kind) {
      query.andWhere('event.kind = :kind', { kind: options.kind });
    }

    const events = await query.getMany();
    return {
      organizationId,
      count: events.length,
      events,
    };
  }

  private async incrementMonthly(
    organizationId: string,
    kind: UsageEventKind,
    quantity: number,
  ): Promise<void> {
    const monthKey = this.getMonthKey();
    let monthly = await this.usageMonthlyRepository.findOne({
      where: { organizationId, monthKey },
    });

    if (!monthly) {
      monthly = this.usageMonthlyRepository.create({
        organizationId,
        monthKey,
      });
    }

    const limitKey = KIND_TO_FIELD[kind];
    monthly[limitKey] = Number(monthly[limitKey] ?? 0) + quantity;
    await this.usageMonthlyRepository.save(monthly);
  }

  private async getLimitForOrg(
    organizationId: string,
    limitKey: UsageLimitKey,
  ): Promise<number | null> {
    const plan = await this.getPlanForOrg(organizationId);
    if (plan?.limits && plan.limits[limitKey] !== undefined) {
      return Number(plan.limits[limitKey]);
    }

    const fallback =
      DEFAULT_USAGE_LIMITS[plan?.slug || USAGE_PLAN_SLUGS.FREE] ||
      DEFAULT_USAGE_LIMITS[USAGE_PLAN_SLUGS.FREE];
    if (fallback && fallback[limitKey] !== undefined) {
      return Number(fallback[limitKey]);
    }

    return null;
  }

  private async getPlanForOrg(organizationId: string) {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    const planSlug = organization?.planSlug || USAGE_PLAN_SLUGS.FREE;

    const plan = await this.usagePlanRepository.findOne({
      where: { slug: planSlug, isActive: true },
    });

    if (plan) {
      return plan;
    }

    return {
      id: 'default',
      slug: planSlug,
      name:
        planSlug === USAGE_PLAN_SLUGS.PRO
          ? 'Pro'
          : planSlug === USAGE_PLAN_SLUGS.ENTERPRISE
            ? 'Enterprise'
            : 'Free',
      limits: DEFAULT_USAGE_LIMITS[planSlug] || DEFAULT_USAGE_LIMITS.free,
    } as UsagePlan;
  }
}
