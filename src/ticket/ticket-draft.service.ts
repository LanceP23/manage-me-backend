import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TicketDraft } from './entities/ticket-draft.entity';
import { Ticket } from './entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { Product } from '../product/entities/Product.entity';
import { AiTicketDraftDto } from './dto/ai-ticket-draft.dto';
import { ApproveTicketDraftDto } from './dto/approve-ticket-draft.dto';
import { RejectTicketDraftDto } from './dto/reject-ticket-draft.dto';
import { TicketDraftApprovalAudit } from './entities/ticket-draft-approval-audit.entity';
import { ConfigService } from '@nestjs/config';
import { Organization } from '../organization/entities/organization.entity';
import { AgentDecisionService } from '../agent/agent-decision.service';
import { AgentActionService } from '../agent/agent-action.service';
import { UsageService } from '../usage/usage.service';

@Injectable()
export class TicketDraftService {
  constructor(
    @InjectRepository(TicketDraft)
    private readonly draftRepository: Repository<TicketDraft>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(TicketDraftApprovalAudit)
    private readonly auditRepository: Repository<TicketDraftApprovalAudit>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AgentDecisionService))
    private readonly agentDecisionService: AgentDecisionService,
    @Inject(forwardRef(() => AgentActionService))
    private readonly agentActionService: AgentActionService,
    private readonly usageService: UsageService,
  ) {}

  async createDrafts(
    drafts: AiTicketDraftDto[],
    organizationId?: string,
  ): Promise<TicketDraft[]> {
    const created: TicketDraft[] = [];
    const autoApproveThreshold = this.getAutoApproveThreshold();
    let organization: Organization | null = null;
    if (organizationId) {
      organization = await this.organizationRepository.findOne({
        where: { id: organizationId },
      });
      if (!organization) {
        throw new NotFoundException(
          `Organization with ID ${organizationId} not found`,
        );
      }
    }

    for (const draft of drafts) {
      const entity = new TicketDraft();
      entity.title = draft.title;
      entity.description = draft.description;
      entity.status = draft.status || 'todo';
      entity.priority = draft.priority || 'medium';
      entity.approvalStatus = 'draft';
      entity.source = draft.source;
      entity.aiProvider = draft.aiProvider || null;
      entity.confidence = draft.confidence ?? null;
      entity.rawInputHash = draft.rawInputHash || null;

      if (draft.productId !== undefined) {
        const product = await this.productRepository.findOne({
          where: { id: draft.productId },
        });
        if (!product) {
          throw new NotFoundException(
            `Product with ID ${draft.productId} not found`,
          );
        }
        if (organization && product.organizationId !== organization.id) {
          throw new BadRequestException(
            'Product does not belong to this organization',
          );
        }
        entity.product = product;
      }

      if (draft.assignedToId) {
        const user = await this.userRepository.findOne({
          where: { id: draft.assignedToId },
        });
        if (!user) {
          throw new NotFoundException(
            `User with ID ${draft.assignedToId} not found`,
          );
        }
        entity.assignedTo = user;
      }

      if (organization) {
        entity.organization = organization;
        entity.organizationId = organization.id;
      }

      const savedDraft = await this.draftRepository.save(entity);

      if (
        autoApproveThreshold !== null &&
        typeof savedDraft.confidence === 'number' &&
        savedDraft.confidence >= autoApproveThreshold
      ) {
        const result = await this.approveDraftInternal(
          savedDraft,
          {},
          'auto_approved',
          null,
          {
            threshold: autoApproveThreshold,
            confidence: savedDraft.confidence,
          },
        );
        await this.runAgentForApprovedDraft({
          draft: result.draft,
          ticket: result.ticket,
          organizationId: organizationId || null,
          actorId: null,
          action: 'auto_approved',
        });
        created.push(result.draft);
      } else {
        created.push(savedDraft);
      }
    }

    return created;
  }

  async findAllDrafts() {
    return this.findAllDraftsByOrg();
  }

  async findAllDraftsByOrg(organizationId?: string) {
    const where = organizationId ? { organizationId } : {};
    return this.draftRepository.find({
      where,
      relations: ['assignedTo', 'product'],
      order: { createdAt: 'DESC' },
    });
  }

  async approveDraft(
    id: number,
    overrides: ApproveTicketDraftDto,
    organizationId?: string,
  ) {
    const draft = await this.draftRepository.findOne({
      where: organizationId ? { id, organizationId } : { id },
      relations: ['assignedTo', 'product', 'organization'],
    });

    if (!draft) {
      throw new NotFoundException(`Ticket draft with ID ${id} not found`);
    }

    if (draft.approvalStatus !== 'draft') {
      throw new BadRequestException(
        `Ticket draft with ID ${id} is already ${draft.approvalStatus}`,
      );
    }

    const result = await this.approveDraftInternal(
      draft,
      overrides,
      'approved',
      overrides.approvedById ?? null,
      null,
    );
    await this.runAgentForApprovedDraft({
      draft: result.draft,
      ticket: result.ticket,
      organizationId: organizationId || null,
      actorId: overrides.approvedById ?? null,
      action: 'approved',
    });
    return result.ticket;
  }

  async rejectDraft(id: number, input: RejectTicketDraftDto, organizationId?: string) {
    const draft = await this.draftRepository.findOne({
      where: organizationId ? { id, organizationId } : { id },
    });
    if (!draft) {
      throw new NotFoundException(`Ticket draft with ID ${id} not found`);
    }
    if (draft.approvalStatus !== 'draft') {
      throw new BadRequestException(
        `Ticket draft with ID ${id} is already ${draft.approvalStatus}`,
      );
    }
    draft.approvalStatus = 'rejected';
    draft.rejectedAt = new Date();
    let actor: User | null = null;
    if (input.rejectedById) {
      const rejector = await this.userRepository.findOne({
        where: { id: input.rejectedById },
      });
      if (!rejector) {
        throw new NotFoundException(
          `User with ID ${input.rejectedById} not found`,
        );
      }
      draft.rejectedBy = rejector;
      actor = rejector;
    } else {
      draft.rejectedBy = null;
    }

    const saved = await this.draftRepository.save(draft);
    await this.auditRepository.save({
      action: 'rejected',
      draft: saved,
      approvedTicket: null,
      actor,
      overrides: input ?? null,
      metadata: null,
    });
    return saved;
  }

  async listDraftAudit(draftId: number, organizationId?: string) {
    if (organizationId) {
      const draft = await this.draftRepository.findOne({
        where: { id: draftId, organizationId },
      });
      if (!draft) {
        throw new NotFoundException(`Ticket draft with ID ${draftId} not found`);
      }
    }
    return this.auditRepository.find({
      where: { draft: { id: draftId } },
      relations: ['actor', 'approvedTicket'],
      order: { createdAt: 'DESC' },
    });
  }

  private async approveDraftInternal(
    draft: TicketDraft,
    overrides: ApproveTicketDraftDto,
    action: 'approved' | 'auto_approved',
    actorId: string | null,
    metadata: Record<string, any> | null,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const ticket = new Ticket();
      ticket.title = overrides.title ?? draft.title;
      ticket.description = overrides.description ?? draft.description;
      ticket.status = overrides.status ?? draft.status ?? 'todo';
      ticket.priority = overrides.priority ?? draft.priority ?? 'medium';

      if (overrides.productId !== undefined) {
        const product = await manager.findOne(Product, {
          where: { id: overrides.productId },
        });
        if (!product) {
          throw new NotFoundException(
            `Product with ID ${overrides.productId} not found`,
          );
        }
        ticket.product = product;
      } else {
        ticket.product = draft.product || null;
      }

      if (overrides.assignedToId !== undefined) {
        const user = await manager.findOne(User, {
          where: { id: overrides.assignedToId },
        });
        if (!user) {
          throw new NotFoundException(
            `User with ID ${overrides.assignedToId} not found`,
          );
        }
        ticket.assignedTo = user;
      } else {
        ticket.assignedTo = draft.assignedTo || null;
      }

      if (draft.organization) {
        ticket.organization = draft.organization;
        ticket.organizationId = draft.organization.id;
      }

      const savedTicket = await manager.save(Ticket, ticket);

      draft.approvalStatus = 'approved';
      draft.approvedTicketId = savedTicket.id;
      draft.approvedAt = new Date();
      let actor: User | null = null;
      if (actorId) {
        const approver = await manager.findOne(User, {
          where: { id: actorId },
        });
        if (!approver) {
          throw new NotFoundException(`User with ID ${actorId} not found`);
        }
        draft.approvedBy = approver;
        actor = approver;
      } else {
        draft.approvedBy = null;
      }
      const savedDraft = await manager.save(TicketDraft, draft);

      const audit = new TicketDraftApprovalAudit();
      audit.action = action;
      audit.draft = savedDraft;
      audit.approvedTicket = savedTicket;
      audit.actor = actor;
      audit.overrides = Object.keys(overrides || {}).length ? overrides : null;
      audit.metadata = metadata;
      await manager.save(TicketDraftApprovalAudit, audit);

      return { ticket: savedTicket, draft: savedDraft };
    });
  }

  private getAutoApproveThreshold(): number | null {
    const raw = this.configService.get<string>(
      'AUTO_APPROVE_DRAFT_CONFIDENCE_THRESHOLD',
    );
    if (raw === undefined || raw === null || raw === '') {
      return null;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      return null;
    }
    return parsed;
  }

  private getAgentAutoConfig() {
    const enabled =
      this.configService.get<string>('AGENT_AUTO_RUN_ON_DRAFT_APPROVAL') !==
      'false';
    const dryRun =
      this.configService.get<string>('AGENT_AUTO_DRY_RUN') !== 'false';
    const minConfidenceRaw =
      this.configService.get<string>('AGENT_AUTO_MIN_CONFIDENCE') ?? '';
    const minConfidence = minConfidenceRaw !== '' ? Number(minConfidenceRaw) : undefined;
    const maxActionsRaw =
      this.configService.get<string>('AGENT_AUTO_MAX_ACTIONS') ?? '';
    const maxActions = maxActionsRaw !== '' ? Number(maxActionsRaw) : undefined;
    const allowedRaw =
      this.configService.get<string>('AGENT_AUTO_ALLOWED_ACTIONS') ?? '';
    const allowedActions = allowedRaw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    return {
      enabled,
      dryRun,
      minConfidence:
        typeof minConfidence === 'number' && Number.isFinite(minConfidence)
          ? Math.max(0, Math.min(minConfidence, 1))
          : undefined,
      maxActions:
        typeof maxActions === 'number' && Number.isFinite(maxActions)
          ? Math.max(1, Math.min(Math.floor(maxActions), 25))
          : undefined,
      allowedActions: allowedActions.length ? allowedActions : undefined,
    };
  }

  private async runAgentForApprovedDraft(params: {
    draft: TicketDraft;
    ticket: Ticket;
    organizationId: string | null;
    actorId: string | null;
    action: 'approved' | 'auto_approved';
  }) {
    const { draft, ticket, organizationId, actorId, action } = params;
    if (!organizationId) {
      return;
    }

    const config = this.getAgentAutoConfig();
    if (!config.enabled) {
      return;
    }

    const payload: Record<string, any> = {
      ticketId: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      productId: ticket.product?.id || draft.product?.id || null,
      draftId: draft.id,
      draftConfidence: draft.confidence ?? null,
      draftSource: draft.source,
      approvalAction: action,
    };

    const context = [
      `A ticket draft was ${action.replace('_', ' ')}.`,
      `Ticket ${ticket.id}: ${ticket.title}.`,
      `Source: ${draft.source}.`,
      `Decide if any actions should be executed.`,
    ].join(' ');

    try {
      const decision = await this.agentDecisionService.decide(
        {
          context,
          payload,
          allowedActions: config.allowedActions,
          dryRun: config.dryRun,
          minConfidence: config.minConfidence,
          maxActions: config.maxActions,
          source: 'draft_approval',
        },
        organizationId,
      );

      if (!decision.execute) {
        return;
      }

      await this.usageService.assertWithinLimit(
        organizationId,
        'agent_action',
        decision.actions?.length || 1,
      );

      const response = await this.agentActionService.executeActions(
        {
          actions: decision.actions,
          decision: {
            confidence: decision.confidence,
            rationale: decision.rationale,
            promptVersion: 'agent-actions',
            source: 'draft_approval',
          },
          dryRun: config.dryRun,
        },
        actorId || undefined,
        organizationId,
      );

      if (!config.dryRun) {
        await this.usageService.recordEvent({
          organizationId,
          userId: actorId || undefined,
          kind: 'agent_action',
          quantity: response.results?.length || 1,
          metadata: { auto: true, source: 'draft_approval' },
        });
      }
    } catch (error) {
      console.warn(
        'Agent auto-run failed for approved draft',
        draft.id,
        error?.message || error,
      );
    }
  }
}
