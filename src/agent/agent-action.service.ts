import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AgentActionLog } from './entities/agent-action-log.entity';
import { TicketService } from '../ticket/ticket.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { AgentExecuteDto } from './dto/agent-execute.dto';

const ACTION_TYPES = {
  CREATE_TICKET: 'create_ticket',
  UPDATE_TICKET_STATUS: 'update_ticket_status',
  POST_SLACK_MESSAGE: 'post_slack_message',
  POST_MATTERMOST_MESSAGE: 'post_mattermost_message',
  CREATE_OPENPROJECT_WORK_PACKAGE: 'create_openproject_work_package',
} as const;

type ActionResult = {
  actionId: number;
  type: string;
  status: string;
  result?: Record<string, any> | null;
  error?: string | null;
};

@Injectable()
export class AgentActionService {
  constructor(
    @InjectRepository(AgentActionLog)
    private readonly actionLogRepository: Repository<AgentActionLog>,
    private readonly ticketService: TicketService,
    private readonly integrationsService: IntegrationsService,
    private readonly configService: ConfigService,
  ) {}

  async executeActions(
    request: AgentExecuteDto,
    userId: string | undefined,
    organizationId: string,
  ) {
    if (!request.actions || request.actions.length === 0) {
      throw new BadRequestException('actions must include at least one action');
    }

    const maxActions = this.getMaxActions();
    if (request.actions.length > maxActions) {
      throw new BadRequestException(`actions exceeds max of ${maxActions}`);
    }

    const dryRun = request.dryRun !== undefined ? request.dryRun : true;
    const decision = request.decision || null;
    const minConfidence = this.getMinConfidence();

    const shouldSkipForConfidence =
      decision?.confidence !== undefined &&
      minConfidence !== null &&
      decision.confidence < minConfidence;

    const results: ActionResult[] = [];

    for (const action of request.actions) {
      const log = await this.actionLogRepository.save({
        actionType: action.type,
        status: 'received',
        dryRun,
        input: action.payload || {},
        decision: decision ? { ...decision } : null,
        organizationId,
        userId: userId || null,
        result: null,
        errorMessage: null,
      });

      if (shouldSkipForConfidence) {
        await this.actionLogRepository.save({
          id: log.id,
          status: 'skipped',
          errorMessage: 'Decision confidence below threshold',
          result: { skipped: true, reason: 'below_confidence_threshold' },
        });
        results.push({
          actionId: log.id,
          type: action.type,
          status: 'skipped',
          result: { skipped: true, reason: 'below_confidence_threshold' },
        });
        continue;
      }

      if (dryRun) {
        await this.actionLogRepository.save({
          id: log.id,
          status: 'executed',
          result: { dryRun: true },
        });
        results.push({
          actionId: log.id,
          type: action.type,
          status: 'executed',
          result: { dryRun: true },
        });
        continue;
      }

      try {
        const result = await this.executeAction(action.type, action.payload, organizationId);
        await this.actionLogRepository.save({
          id: log.id,
          status: 'executed',
          result: result ?? null,
        });
        results.push({
          actionId: log.id,
          type: action.type,
          status: 'executed',
          result: result ?? null,
        });
      } catch (error) {
        const message = error?.message || 'Action execution failed';
        await this.actionLogRepository.save({
          id: log.id,
          status: 'failed',
          errorMessage: message,
          result: { error: message },
        });
        results.push({
          actionId: log.id,
          type: action.type,
          status: 'failed',
          error: message,
        });
      }
    }

    return {
      dryRun,
      minConfidence,
      decision: decision ? { ...decision } : null,
      results,
    };
  }

  private async executeAction(
    type: string,
    payload: Record<string, any>,
    organizationId: string,
  ) {
    switch (type) {
      case ACTION_TYPES.CREATE_TICKET:
        return this.handleCreateTicket(payload, organizationId);
      case ACTION_TYPES.UPDATE_TICKET_STATUS:
        return this.handleUpdateTicketStatus(payload, organizationId);
      case ACTION_TYPES.POST_SLACK_MESSAGE:
        return this.handleSlackMessage(payload, organizationId);
      case ACTION_TYPES.POST_MATTERMOST_MESSAGE:
        return this.handleMattermostMessage(payload, organizationId);
      case ACTION_TYPES.CREATE_OPENPROJECT_WORK_PACKAGE:
        return this.handleOpenProjectWorkPackage(payload, organizationId);
      default:
        throw new BadRequestException(`Unsupported action type: ${type}`);
    }
  }

  private async handleCreateTicket(payload: Record<string, any>, organizationId: string) {
    const title = this.requireString(payload?.title, 'title');
    const description = this.requireString(payload?.description, 'description');

    const createTicketDto: Record<string, any> = {
      title,
      description,
    };

    if (payload?.status) {
      createTicketDto.status = payload.status;
    }
    if (payload?.priority) {
      createTicketDto.priority = payload.priority;
    }
    if (payload?.productId) {
      createTicketDto.productId = payload.productId;
    }
    if (payload?.assignedToId) {
      createTicketDto.assignedToId = payload.assignedToId;
    }

    const ticket = await this.ticketService.create(createTicketDto as any, organizationId);
    return { ticketId: ticket.id };
  }

  private async handleUpdateTicketStatus(
    payload: Record<string, any>,
    organizationId: string,
  ) {
    const ticketId = this.requireNumber(payload?.ticketId, 'ticketId');
    const status = this.requireString(payload?.status, 'status');

    await this.ticketService.update(
      ticketId,
      { status } as any,
      organizationId,
    );
    return { ticketId, status };
  }

  private async handleSlackMessage(payload: Record<string, any>, organizationId: string) {
    const text = this.requireString(payload?.text, 'text');
    const body: Record<string, any> = { text };
    if (payload?.username) {
      body.username = payload.username;
    }
    if (payload?.icon_url) {
      body.icon_url = payload.icon_url;
    }
    return this.integrationsService.handleSlackOutbound(body as any, undefined, organizationId);
  }

  private async handleMattermostMessage(
    payload: Record<string, any>,
    organizationId: string,
  ) {
    const text = this.requireString(payload?.text, 'text');
    const body: Record<string, any> = { text };
    if (payload?.channel) {
      body.channel = payload.channel;
    }
    if (payload?.username) {
      body.username = payload.username;
    }
    if (payload?.icon_url) {
      body.icon_url = payload.icon_url;
    }
    return this.integrationsService.handleMattermostOutbound(body as any, undefined, organizationId);
  }

  private async handleOpenProjectWorkPackage(
    payload: Record<string, any>,
    organizationId: string,
  ) {
    const projectId = this.requireNumber(payload?.projectId, 'projectId');
    const subject = this.requireString(payload?.subject, 'subject');

    const body: Record<string, any> = {
      projectId,
      subject,
    };
    if (payload?.description) {
      body.description = payload.description;
    }
    if (payload?.typeId) {
      body.typeId = payload.typeId;
    }
    if (payload?.priorityId) {
      body.priorityId = payload.priorityId;
    }
    if (payload?.statusId) {
      body.statusId = payload.statusId;
    }
    if (payload?.assigneeId) {
      body.assigneeId = payload.assigneeId;
    }
    if (payload?.ticketId) {
      body.ticketId = payload.ticketId;
    }

    return this.integrationsService.handleOpenProjectOutbound(
      body as any,
      undefined,
      organizationId,
    );
  }

  private requireString(value: any, field: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private requireNumber(value: any, field: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`${field} must be a number`);
    }
    return parsed;
  }

  private getMaxActions(): number {
    const raw = this.configService.get<string>('AGENT_ACTION_MAX_BATCH');
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 5;
    }
    return Math.min(Math.floor(parsed), 25);
  }

  private getMinConfidence(): number | null {
    const raw = this.configService.get<string>('AGENT_ACTION_MIN_CONFIDENCE');
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(0, Math.min(parsed, 1));
  }
}
