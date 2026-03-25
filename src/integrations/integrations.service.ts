import { Injectable, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { IntegrationEvent } from './entities/integration-event.entity';
import { MattermostInboundDto } from './dto/mattermost-inbound.dto';
import { MattermostOutboundDto } from './dto/mattermost-outbound.dto';
import { SlackInboundDto } from './dto/slack-inbound.dto';
import { SlackOutboundDto } from './dto/slack-outbound.dto';
import { OpenProjectOutboundDto } from './dto/openproject-outbound.dto';
import { AiTicketService } from '../ticket/ai-ticket.service';
import { TicketDraftService } from '../ticket/ticket-draft.service';
import { createHmac, timingSafeEqual } from 'crypto';
import { TicketExternalLink } from '../ticket/entities/ticket-external-link.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { TicketCommitLinkService } from '../ticket/ticket-commit-link.service';
import { UsageService } from '../usage/usage.service';
import { IntegrationConfig } from './entities/integration-config.entity';
import { CreateGithubIntegrationDto, UpdateGithubIntegrationDto } from './dto/github-integration.dto';
import { Product } from '../product/entities/Product.entity';

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(IntegrationEvent)
    private readonly eventRepository: Repository<IntegrationEvent>,
    @InjectRepository(IntegrationConfig)
    private readonly integrationConfigRepository: Repository<IntegrationConfig>,
    @InjectRepository(TicketExternalLink)
    private readonly externalLinkRepository: Repository<TicketExternalLink>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly configService: ConfigService,
    private readonly aiTicketService: AiTicketService,
    @Inject(forwardRef(() => TicketDraftService))
    private readonly ticketDraftService: TicketDraftService,
    private readonly ticketCommitLinkService: TicketCommitLinkService,
    private readonly usageService: UsageService,
  ) {}

  async handleMattermostInbound(payload: MattermostInboundDto, organizationId?: string) {
    this.validateMattermostToken(payload);

    const normalized = this.normalizeMattermost(payload);
    const event = await this.eventRepository.save({
      provider: 'mattermost',
      direction: 'inbound',
      eventType: 'chat_message',
      externalId: payload.post_id ?? null,
      organizationId: organizationId || null,
      status: 'received',
      errorMessage: null,
      payload: payload as Record<string, any>,
      normalized,
      metadata: null,
    });

    const ignoreReason = this.getMattermostIgnoreReason(payload);
    if (ignoreReason) {
      await this.updateEvent(event.id, {
        status: 'processed',
        metadata: { ignored: true, reason: ignoreReason },
      });
      return { received: true, ignored: true, reason: ignoreReason };
    }

    if (!normalized.text) {
      await this.updateEvent(event.id, {
        status: 'failed',
        errorMessage: 'No text content provided',
      });
      throw new BadRequestException('No text content provided');
    }

    try {
      if (organizationId) {
        await this.usageService.assertWithinLimit(
          organizationId,
          'integration_draft',
        );
      }

      const drafts = await this.aiTicketService.generateTicketDrafts({
        source: 'chat',
        rawInput: normalized.text,
        context: normalized.context,
        maxDrafts: this.getDefaultMaxDrafts(),
      }, organizationId);

      const createdDrafts = await this.ticketDraftService.createDrafts(
        drafts,
        organizationId,
      );

      if (organizationId) {
        await this.usageService.recordEvent({
          organizationId,
          kind: 'integration_draft',
          quantity: createdDrafts.length,
          metadata: { provider: 'mattermost' },
        });
      }

      await this.updateEvent(event.id, {
        status: 'processed',
        metadata: {
          draftCount: createdDrafts.length,
          draftIds: createdDrafts.map((draft) => draft.id),
        },
      });
      return { received: true, drafts: createdDrafts };
    } catch (error) {
      await this.updateEvent(event.id, {
        status: 'failed',
        errorMessage: error?.message || 'Failed to create drafts',
      });
      throw error;
    }
  }

  async handleMattermostOutbound(
    payload: MattermostOutboundDto,
    token?: string,
    organizationId?: string,
  ) {
    this.validateIntegrationToken(token);
    const webhookUrl = this.configService.get<string>(
      'MATTERMOST_INCOMING_WEBHOOK_URL',
    );
    if (!webhookUrl) {
      throw new BadRequestException('MATTERMOST_INCOMING_WEBHOOK_URL is not set');
    }

    const event = await this.eventRepository.save({
      provider: 'mattermost',
      direction: 'outbound',
      eventType: 'post_message',
      externalId: null,
      organizationId: organizationId || null,
      status: 'received',
      errorMessage: null,
      payload: payload as Record<string, any>,
      normalized: null,
      metadata: null,
    });

    try {
      await axios.post(webhookUrl, payload, { timeout: 10000 });
      await this.updateEvent(event.id, {
        status: 'processed',
      });
      return { sent: true };
    } catch (error) {
      await this.updateEvent(event.id, {
        status: 'failed',
        errorMessage: error?.message || 'Failed to send outbound message',
      });
      throw error;
    }
  }

  async handleSlackInbound(
    payload: SlackInboundDto,
    rawBody: string | null,
    signature?: string,
    timestamp?: string,
    organizationId?: string,
  ) {
    this.validateSlackSignature(rawBody, signature, timestamp);

    const event = await this.eventRepository.save({
      provider: 'slack',
      direction: 'inbound',
      eventType: payload.type || 'unknown',
      externalId: payload.event_id ?? null,
      organizationId: organizationId || null,
      status: 'received',
      errorMessage: null,
      payload: payload as Record<string, any>,
      normalized: null,
      metadata: null,
    });

    if (payload.type === 'url_verification' && payload.challenge) {
      await this.updateEvent(event.id, {
        status: 'processed',
        metadata: { urlVerification: true },
      });
      return { challenge: payload.challenge };
    }

    if (payload.type !== 'event_callback') {
      await this.updateEvent(event.id, {
        status: 'processed',
        metadata: { ignored: true, reason: 'Unsupported event type' },
      });
      return { received: true, ignored: true };
    }

    const slackEvent = payload.event || {};
    const ignoreReason = this.getSlackIgnoreReason(slackEvent);
    if (ignoreReason) {
      await this.updateEvent(event.id, {
        status: 'processed',
        metadata: { ignored: true, reason: ignoreReason },
      });
      return { received: true, ignored: true, reason: ignoreReason };
    }

    const normalized = this.normalizeSlack(payload);
    if (!normalized.text) {
      await this.updateEvent(event.id, {
        status: 'failed',
        errorMessage: 'No text content provided',
      });
      throw new BadRequestException('No text content provided');
    }

    await this.updateEvent(event.id, { normalized });

    try {
      if (organizationId) {
        await this.usageService.assertWithinLimit(
          organizationId,
          'integration_draft',
        );
      }

      const drafts = await this.aiTicketService.generateTicketDrafts({
        source: 'chat',
        rawInput: normalized.text,
        context: normalized.context,
        maxDrafts: this.getDefaultMaxDrafts(),
      }, organizationId);

      const createdDrafts = await this.ticketDraftService.createDrafts(
        drafts,
        organizationId,
      );

      if (organizationId) {
        await this.usageService.recordEvent({
          organizationId,
          kind: 'integration_draft',
          quantity: createdDrafts.length,
          metadata: { provider: 'slack' },
        });
      }

      await this.updateEvent(event.id, {
        status: 'processed',
        metadata: {
          draftCount: createdDrafts.length,
          draftIds: createdDrafts.map((draft) => draft.id),
        },
      });
      return { received: true, drafts: createdDrafts };
    } catch (error) {
      await this.updateEvent(event.id, {
        status: 'failed',
        errorMessage: error?.message || 'Failed to create drafts',
      });
      throw error;
    }
  }

  async handleSlackOutbound(
    payload: SlackOutboundDto,
    token?: string,
    organizationId?: string,
  ) {
    this.validateIntegrationToken(token);
    const webhookUrl = this.configService.get<string>(
      'SLACK_INCOMING_WEBHOOK_URL',
    );
    if (!webhookUrl) {
      throw new BadRequestException('SLACK_INCOMING_WEBHOOK_URL is not set');
    }

    const event = await this.eventRepository.save({
      provider: 'slack',
      direction: 'outbound',
      eventType: 'post_message',
      externalId: null,
      organizationId: organizationId || null,
      status: 'received',
      errorMessage: null,
      payload: payload as Record<string, any>,
      normalized: null,
      metadata: null,
    });

    try {
      await axios.post(webhookUrl, payload, { timeout: 10000 });
      await this.updateEvent(event.id, { status: 'processed' });
      return { sent: true };
    } catch (error) {
      await this.updateEvent(event.id, {
        status: 'failed',
        errorMessage: error?.message || 'Failed to send outbound message',
      });
      throw error;
    }
  }

  async handleOpenProjectOutbound(
    payload: OpenProjectOutboundDto,
    token?: string,
    organizationId?: string,
  ) {
    this.validateIntegrationToken(token);
    const baseUrl = this.configService.get<string>('OPENPROJECT_BASE_URL');
    const apiKey = this.configService.get<string>('OPENPROJECT_API_KEY');
    if (!baseUrl || !apiKey) {
      throw new BadRequestException(
        'OPENPROJECT_BASE_URL and OPENPROJECT_API_KEY are required',
      );
    }

    const event = await this.eventRepository.save({
      provider: 'openproject',
      direction: 'outbound',
      eventType: 'create_work_package',
      externalId: null,
      organizationId: organizationId || null,
      status: 'received',
      errorMessage: null,
      payload: payload as Record<string, any>,
      normalized: null,
      metadata: null,
    });

    const requestBody: Record<string, any> = {
      subject: payload.subject,
    };
    if (payload.description) {
      requestBody.description = {
        format: 'markdown',
        raw: payload.description,
      };
    }
    if (payload.typeId) {
      requestBody.type = { href: `/api/v3/types/${payload.typeId}` };
    }
    if (payload.priorityId) {
      requestBody.priority = { href: `/api/v3/priorities/${payload.priorityId}` };
    }
    if (payload.statusId) {
      requestBody.status = { href: `/api/v3/statuses/${payload.statusId}` };
    }
    if (payload.assigneeId) {
      requestBody.assignee = { href: `/api/v3/users/${payload.assigneeId}` };
    }

    const url = `${baseUrl.replace(/\/$/, '')}/api/v3/projects/${payload.projectId}/work_packages`;
    const auth = Buffer.from(`apikey:${apiKey}`).toString('base64');

    try {
      const response = await axios.post(url, requestBody, {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      const workPackageId = response.data?.id ?? null;
      const workPackageHref = response.data?._links?.self?.href ?? null;
      await this.updateEvent(event.id, {
        status: 'processed',
        metadata: {
          workPackageId,
          workPackageHref,
        },
      });

      if (payload.ticketId && workPackageId) {
        const ticket = await this.ticketRepository.findOne({
          where: organizationId
            ? { id: payload.ticketId, organizationId }
            : { id: payload.ticketId },
        });
        if (ticket) {
          await this.externalLinkRepository.save({
            provider: 'openproject',
            externalId: String(workPackageId),
            externalUrl: workPackageHref,
            organizationId: ticket.organizationId || null,
            metadata: {
              projectId: payload.projectId,
            },
            ticket,
          });
        }
      }

      return {
        created: true,
        id: workPackageId,
        href: workPackageHref,
      };
    } catch (error) {
      await this.updateEvent(event.id, {
        status: 'failed',
        errorMessage: error?.message || 'Failed to create work package',
      });
      throw error;
    }
  }

  async handleOpenProjectInbound(
    payload: Record<string, any>,
    token?: string,
    organizationId?: string,
  ) {
    this.validateOpenProjectToken(token);

    const normalized = this.normalizeOpenProject(payload);
    const event = await this.eventRepository.save({
      provider: 'openproject',
      direction: 'inbound',
      eventType: normalized.eventType || 'work_package',
      externalId: normalized.externalId,
      organizationId: organizationId || null,
      status: 'received',
      errorMessage: null,
      payload: payload as Record<string, any>,
      normalized,
      metadata: null,
    });

    if (!normalized.externalId) {
      await this.updateEvent(event.id, {
        status: 'failed',
        errorMessage: 'Missing external work package id',
      });
      throw new BadRequestException('Missing external work package id');
    }

    const link = await this.externalLinkRepository.findOne({
      where: { provider: 'openproject', externalId: normalized.externalId },
      relations: ['ticket'],
    });
    if (!link || !link.ticket) {
      await this.updateEvent(event.id, {
        status: 'processed',
        metadata: { ignored: true, reason: 'No linked ticket found' },
      });
      return { received: true, ignored: true };
    }
    if (organizationId && link.ticket.organizationId !== organizationId) {
      await this.updateEvent(event.id, {
        status: 'processed',
        metadata: { ignored: true, reason: 'Ticket not in organization' },
      });
      return { received: true, ignored: true };
    }

    const updates: Partial<Ticket> = {};
    const syncFields = this.getOpenProjectSyncFields();
    if (syncFields.includes('status')) {
      const mappedStatus = this.mapOpenProjectStatus(normalized.status);
      if (mappedStatus) {
        updates.status = mappedStatus;
      }
    }
    if (syncFields.includes('priority')) {
      const mappedPriority = this.mapOpenProjectPriority(normalized.priority);
      if (mappedPriority) {
        updates.priority = mappedPriority;
      }
    }
    if (syncFields.includes('title') && normalized.title) {
      updates.title = normalized.title;
    }
    if (syncFields.includes('description') && normalized.description) {
      updates.description = normalized.description;
    }

    if (!Object.keys(updates).length) {
      await this.updateEvent(event.id, {
        status: 'processed',
        metadata: { ignored: true, reason: 'No mapped updates' },
      });
      return { received: true, ignored: true };
    }

    await this.ticketRepository.update(link.ticket.id, updates);
    await this.updateEvent(event.id, {
      status: 'processed',
      metadata: {
        ticketId: link.ticket.id,
        applied: Object.keys(updates),
      },
    });
    return { received: true, updated: true, ticketId: link.ticket.id };
  }

  async handleGithubInbound(
    payload: Record<string, any>,
    rawBody: string | null,
    signature?: string,
    eventType?: string,
    organizationId?: string,
  ) {
    const candidates = await this.findGithubIntegrationCandidates(
      payload,
      organizationId,
    );
    const matchedConfig = this.matchGithubWebhookSignature(
      rawBody,
      signature,
      candidates,
    );

    if (candidates.length > 0 && !matchedConfig) {
      throw new ForbiddenException('Invalid GitHub signature');
    }

    if (!matchedConfig) {
      this.validateGithubSignature(rawBody, signature);
    }

    const event = await this.eventRepository.save({
      provider: 'github',
      direction: 'inbound',
      eventType: eventType || payload?.hook?.type || payload?.action || 'event',
      externalId: payload?.after || payload?.head_commit?.id || null,
      organizationId: organizationId || matchedConfig?.organizationId || null,
      status: 'received',
      errorMessage: null,
      payload: payload as Record<string, any>,
      normalized: null,
      metadata: matchedConfig ? { integrationConfigId: matchedConfig.id } : null,
    });

    if (eventType !== 'push') {
      await this.updateEvent(event.id, {
        status: 'processed',
        metadata: { ignored: true, reason: 'Unsupported event type' },
      });
      return { received: true, ignored: true };
    }

    const commits = Array.isArray(payload?.commits) ? payload.commits : [];
    if (!commits.length) {
      await this.updateEvent(event.id, {
        status: 'processed',
        metadata: { ignored: true, reason: 'No commits found' },
      });
      return { received: true, ignored: true };
    }

    const repoUrl =
      payload?.repository?.html_url ||
      payload?.repository?.url ||
      payload?.repository?.clone_url ||
      null;

    const autoLinkStatus =
      this.configService.get<string>('AUTO_LINK_STATUS') || undefined;

    const results: Record<string, any>[] = [];

    for (const commit of commits) {
      const message = commit?.message || '';
      const ticketIds = this.extractTicketIds(message);
      if (!ticketIds.length) {
        results.push({ commit: commit?.id, linked: false, reason: 'no_ticket_ids' });
        continue;
      }

      if (ticketIds.length === 1) {
        try {
          const link = await this.ticketCommitLinkService.createLink(
            {
            commitSha: commit.id,
            commitMessage: message,
            repoUrl,
            diffSummary: undefined,
            ticketId: ticketIds[0],
            confidence: 1,
            rationale: 'Explicit ticket id in commit message',
            updateTicketStatus: autoLinkStatus,
            },
            organizationId,
          );
          results.push({ commit: commit?.id, linked: true, linkId: link.id });
        } catch (error) {
          results.push({
            commit: commit?.id,
            linked: false,
            reason: error?.message || 'link_failed',
          });
        }
        continue;
      }

      const useAi = this.configService.get<string>('GIT_AUTO_LINK_USE_AI') !== 'false';
      if (!useAi) {
        results.push({ commit: commit?.id, linked: false, reason: 'multiple_ticket_ids' });
        continue;
      }

      try {
        const decision = await this.aiTicketService.classifyCommitLink(
          {
          commitSha: commit.id,
          commitMessage: message,
          repoUrl: repoUrl || undefined,
          diffSummary: undefined,
          candidateTicketIds: ticketIds,
          },
          organizationId,
        );

        if (!decision) {
          results.push({ commit: commit?.id, linked: false, reason: 'no_match' });
          continue;
        }

        const threshold = Number(
          this.configService.get<string>('AUTO_LINK_CONFIDENCE_THRESHOLD') || 0.85,
        );
        if (decision.confidence < threshold) {
          results.push({
            commit: commit?.id,
            linked: false,
            reason: 'below_threshold',
            confidence: decision.confidence,
          });
          continue;
        }

        const link = await this.ticketCommitLinkService.createLink(
          {
          commitSha: commit.id,
          commitMessage: message,
          repoUrl,
          diffSummary: undefined,
          ticketId: decision.ticketId,
          confidence: decision.confidence,
          rationale: decision.rationale || 'AI match',
          updateTicketStatus: autoLinkStatus,
          },
          organizationId,
        );
        results.push({
          commit: commit?.id,
          linked: true,
          linkId: link.id,
          confidence: decision.confidence,
        });
      } catch (error) {
        results.push({
          commit: commit?.id,
          linked: false,
          reason: error?.message || 'ai_link_failed',
        });
      }
    }

    await this.updateEvent(event.id, {
      status: 'processed',
      metadata: {
        commitCount: commits.length,
        linkedCount: results.filter((item) => item.linked).length,
      },
    });

    return { received: true, results };
  }

  async createGithubIntegrationConfig(
    payload: CreateGithubIntegrationDto,
    organizationId?: string,
  ) {
    const orgId = this.requireOrganizationId(organizationId);
    const repoId = payload.repoId?.trim() || null;
    const repoFullName = payload.repoFullName?.trim() || null;

    if (!repoId && !repoFullName) {
      throw new BadRequestException('repoId or repoFullName is required');
    }

    if (payload.productId) {
      await this.assertProductInOrganization(payload.productId, orgId);
    }

    const config = this.integrationConfigRepository.create({
      provider: 'github',
      organizationId: orgId,
      productId: payload.productId ?? null,
      repoId,
      repoFullName,
      webhookSecret: payload.webhookSecret,
      metadata: null,
    });

    const saved = await this.integrationConfigRepository.save(config);
    return this.serializeGithubIntegrationConfig(saved);
  }

  async updateGithubIntegrationConfig(
    id: number,
    payload: UpdateGithubIntegrationDto,
    organizationId?: string,
  ) {
    const orgId = this.requireOrganizationId(organizationId);
    const config = await this.integrationConfigRepository.findOne({
      where: { id, organizationId: orgId, provider: 'github' },
    });
    if (!config) {
      throw new BadRequestException('GitHub integration not found');
    }

    const repoId =
      payload.repoId === undefined ? config.repoId : payload.repoId?.trim() || null;
    const repoFullName =
      payload.repoFullName === undefined
        ? config.repoFullName
        : payload.repoFullName?.trim() || null;

    if (payload.productId) {
      await this.assertProductInOrganization(payload.productId, orgId);
    }

    if (!repoId && !repoFullName) {
      throw new BadRequestException('repoId or repoFullName is required');
    }

    const updated = await this.integrationConfigRepository.save({
      ...config,
      productId:
        payload.productId === undefined ? config.productId : payload.productId,
      repoId,
      repoFullName,
      webhookSecret: payload.webhookSecret ?? config.webhookSecret,
    });

    return this.serializeGithubIntegrationConfig(updated);
  }

  async listGithubIntegrationConfigs(organizationId?: string) {
    const orgId = this.requireOrganizationId(organizationId);
    const rows = await this.integrationConfigRepository.find({
      where: { organizationId: orgId, provider: 'github' },
      order: { createdAt: 'DESC' },
    });

    return { data: rows.map((row) => this.serializeGithubIntegrationConfig(row)) };
  }

  async handleGitlabInbound(
    payload: Record<string, any>,
    rawBody: string | null,
    token?: string,
    eventType?: string,
    organizationId?: string,
  ) {
    this.validateGitlabToken(token, rawBody);

    const event = await this.eventRepository.save({
      provider: 'gitlab',
      direction: 'inbound',
      eventType: eventType || payload?.event_name || payload?.object_kind || 'event',
      externalId: payload?.after || null,
      organizationId: organizationId || null,
      status: 'received',
      errorMessage: null,
      payload: payload as Record<string, any>,
      normalized: null,
      metadata: null,
    });

    if (eventType && eventType !== 'Push Hook' && eventType !== 'push') {
      await this.updateEvent(event.id, {
        status: 'processed',
        metadata: { ignored: true, reason: 'Unsupported event type' },
      });
      return { received: true, ignored: true };
    }

    const commits = Array.isArray(payload?.commits) ? payload.commits : [];
    if (!commits.length) {
      await this.updateEvent(event.id, {
        status: 'processed',
        metadata: { ignored: true, reason: 'No commits found' },
      });
      return { received: true, ignored: true };
    }

    const repoUrl =
      payload?.project?.web_url ||
      payload?.project?.git_http_url ||
      payload?.project?.git_ssh_url ||
      null;

    const autoLinkStatus =
      this.configService.get<string>('AUTO_LINK_STATUS') || undefined;

    const results: Record<string, any>[] = [];

    for (const commit of commits) {
      const message = commit?.message || '';
      const ticketIds = this.extractTicketIds(message);
      if (!ticketIds.length) {
        results.push({ commit: commit?.id, linked: false, reason: 'no_ticket_ids' });
        continue;
      }

      if (ticketIds.length === 1) {
        try {
          const link = await this.ticketCommitLinkService.createLink(
            {
            commitSha: commit.id,
            commitMessage: message,
            repoUrl,
            diffSummary: undefined,
            ticketId: ticketIds[0],
            confidence: 1,
            rationale: 'Explicit ticket id in commit message',
            updateTicketStatus: autoLinkStatus,
            },
            organizationId,
          );
          results.push({ commit: commit?.id, linked: true, linkId: link.id });
        } catch (error) {
          results.push({
            commit: commit?.id,
            linked: false,
            reason: error?.message || 'link_failed',
          });
        }
        continue;
      }

      const useAi = this.configService.get<string>('GIT_AUTO_LINK_USE_AI') !== 'false';
      if (!useAi) {
        results.push({ commit: commit?.id, linked: false, reason: 'multiple_ticket_ids' });
        continue;
      }

      try {
        const decision = await this.aiTicketService.classifyCommitLink(
          {
          commitSha: commit.id,
          commitMessage: message,
          repoUrl: repoUrl || undefined,
          diffSummary: undefined,
          candidateTicketIds: ticketIds,
          },
          organizationId,
        );

        if (!decision) {
          results.push({ commit: commit?.id, linked: false, reason: 'no_match' });
          continue;
        }

        const threshold = Number(
          this.configService.get<string>('AUTO_LINK_CONFIDENCE_THRESHOLD') || 0.85,
        );
        if (decision.confidence < threshold) {
          results.push({
            commit: commit?.id,
            linked: false,
            reason: 'below_threshold',
            confidence: decision.confidence,
          });
          continue;
        }

        const link = await this.ticketCommitLinkService.createLink(
          {
          commitSha: commit.id,
          commitMessage: message,
          repoUrl,
          diffSummary: undefined,
          ticketId: decision.ticketId,
          confidence: decision.confidence,
          rationale: decision.rationale || 'AI match',
          updateTicketStatus: autoLinkStatus,
          },
          organizationId,
        );
        results.push({
          commit: commit?.id,
          linked: true,
          linkId: link.id,
          confidence: decision.confidence,
        });
      } catch (error) {
        results.push({
          commit: commit?.id,
          linked: false,
          reason: error?.message || 'ai_link_failed',
        });
      }
    }

    await this.updateEvent(event.id, {
      status: 'processed',
      metadata: {
        commitCount: commits.length,
        linkedCount: results.filter((item) => item.linked).length,
      },
    });

    return { received: true, results };
  }

  async handleBitbucketInbound(
    payload: Record<string, any>,
    rawBody: string | null,
    signature?: string,
    eventType?: string,
    organizationId?: string,
  ) {
    this.validateBitbucketSignature(rawBody, signature);

    const event = await this.eventRepository.save({
      provider: 'bitbucket',
      direction: 'inbound',
      eventType: eventType || payload?.eventKey || 'event',
      externalId: null,
      organizationId: organizationId || null,
      status: 'received',
      errorMessage: null,
      payload: payload as Record<string, any>,
      normalized: null,
      metadata: null,
    });

    if (eventType && eventType !== 'repo:push' && eventType !== 'push') {
      await this.updateEvent(event.id, {
        status: 'processed',
        metadata: { ignored: true, reason: 'Unsupported event type' },
      });
      return { received: true, ignored: true };
    }

    const commits = this.extractBitbucketCommits(payload);
    if (!commits.length) {
      await this.updateEvent(event.id, {
        status: 'processed',
        metadata: { ignored: true, reason: 'No commits found' },
      });
      return { received: true, ignored: true };
    }

    const repoUrl =
      payload?.repository?.links?.html?.href ||
      payload?.repository?.links?.self?.href ||
      payload?.repository?.website ||
      null;

    const autoLinkStatus =
      this.configService.get<string>('AUTO_LINK_STATUS') || undefined;

    const results: Record<string, any>[] = [];

    for (const commit of commits) {
      const message = commit?.message || '';
      const ticketIds = this.extractTicketIds(message);
      if (!ticketIds.length) {
        results.push({ commit: commit?.id, linked: false, reason: 'no_ticket_ids' });
        continue;
      }

      if (ticketIds.length === 1) {
        try {
          const link = await this.ticketCommitLinkService.createLink(
            {
            commitSha: commit.id,
            commitMessage: message,
            repoUrl,
            diffSummary: undefined,
            ticketId: ticketIds[0],
            confidence: 1,
            rationale: 'Explicit ticket id in commit message',
            updateTicketStatus: autoLinkStatus,
            },
            organizationId,
          );
          results.push({ commit: commit?.id, linked: true, linkId: link.id });
        } catch (error) {
          results.push({
            commit: commit?.id,
            linked: false,
            reason: error?.message || 'link_failed',
          });
        }
        continue;
      }

      const useAi = this.configService.get<string>('GIT_AUTO_LINK_USE_AI') !== 'false';
      if (!useAi) {
        results.push({ commit: commit?.id, linked: false, reason: 'multiple_ticket_ids' });
        continue;
      }

      try {
        const decision = await this.aiTicketService.classifyCommitLink(
          {
          commitSha: commit.id,
          commitMessage: message,
          repoUrl: repoUrl || undefined,
          diffSummary: undefined,
          candidateTicketIds: ticketIds,
          },
          organizationId,
        );

        if (!decision) {
          results.push({ commit: commit?.id, linked: false, reason: 'no_match' });
          continue;
        }

        const threshold = Number(
          this.configService.get<string>('AUTO_LINK_CONFIDENCE_THRESHOLD') || 0.85,
        );
        if (decision.confidence < threshold) {
          results.push({
            commit: commit?.id,
            linked: false,
            reason: 'below_threshold',
            confidence: decision.confidence,
          });
          continue;
        }

        const link = await this.ticketCommitLinkService.createLink(
          {
          commitSha: commit.id,
          commitMessage: message,
          repoUrl,
          diffSummary: undefined,
          ticketId: decision.ticketId,
          confidence: decision.confidence,
          rationale: decision.rationale || 'AI match',
          updateTicketStatus: autoLinkStatus,
          },
          organizationId,
        );
        results.push({
          commit: commit?.id,
          linked: true,
          linkId: link.id,
          confidence: decision.confidence,
        });
      } catch (error) {
        results.push({
          commit: commit?.id,
          linked: false,
          reason: error?.message || 'ai_link_failed',
        });
      }
    }

    await this.updateEvent(event.id, {
      status: 'processed',
      metadata: {
        commitCount: commits.length,
        linkedCount: results.filter((item) => item.linked).length,
      },
    });

    return { received: true, results };
  }

  async getIntegrationStatus(organizationId: string) {
    const knownProviders = [
      'slack',
      'mattermost',
      'openproject',
      'github',
      'gitlab',
      'bitbucket',
    ];

    const rawProviders = await this.eventRepository
      .createQueryBuilder('event')
      .select('DISTINCT event.provider', 'provider')
      .where('event.organizationId = :organizationId', { organizationId })
      .getRawMany<{ provider: string }>();

    const providers = Array.from(
      new Set([...knownProviders, ...rawProviders.map((row) => row.provider)]),
    );

    const statusRows = await Promise.all(
      providers.map(async (provider) => {
        const latest = await this.eventRepository.findOne({
          where: { provider, organizationId },
          order: { createdAt: 'DESC' },
        });

        if (!latest) {
          return {
            provider,
            status: 'unknown',
            lastEventAt: null,
            lastEventType: null,
            lastDirection: null,
            lastStatus: null,
            lastError: null,
          };
        }

        return {
          provider,
          status: latest.status === 'failed' ? 'degraded' : 'active',
          lastEventAt: latest.createdAt,
          lastEventType: latest.eventType,
          lastDirection: latest.direction,
          lastStatus: latest.status,
          lastError: latest.errorMessage,
        };
      }),
    );

    return { data: statusRows };
  }

  private normalizeMattermost(payload: MattermostInboundDto) {
    const text = this.stripTriggerWord(
      payload.text || '',
      payload.trigger_word || '',
    );
    const channel = payload.channel_name || payload.channel_id || null;
    const user = payload.user_name || payload.user_id || null;
    const team = payload.team_domain || payload.team_id || null;
    const contextParts = [
      team ? `team=${team}` : null,
      channel ? `channel=${channel}` : null,
      user ? `user=${user}` : null,
    ].filter(Boolean);

    return {
      provider: 'mattermost',
      text: text.trim(),
      channel,
      user,
      externalMessageId: payload.post_id ?? null,
      timestamp: payload.timestamp ?? null,
      context: contextParts.length ? `Mattermost (${contextParts.join(', ')})` : 'Mattermost',
    };
  }

  private stripTriggerWord(text: string, triggerWord: string) {
    if (!triggerWord) {
      return text;
    }
    if (text.toLowerCase().startsWith(triggerWord.toLowerCase())) {
      return text.slice(triggerWord.length).trim();
    }
    return text;
  }

  private validateMattermostToken(payload: MattermostInboundDto) {
    const expected = this.getWebhookSecret('MATTERMOST_OUTGOING_TOKEN');
    if (!expected) {
      return;
    }
    if (!payload.token || payload.token !== expected) {
      throw new ForbiddenException('Invalid Mattermost token');
    }
  }

  private validateSlackSignature(
    rawBody: string | null,
    signature?: string,
    timestamp?: string,
  ) {
    const secret = this.getWebhookSecret('SLACK_SIGNING_SECRET');
    if (!secret) {
      return;
    }
    if (!rawBody || !signature || !timestamp) {
      throw new ForbiddenException('Missing Slack signature headers');
    }

    const fiveMinutes = 60 * 5;
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > fiveMinutes) {
      throw new ForbiddenException('Stale Slack signature timestamp');
    }

    const base = `v0:${timestamp}:${rawBody}`;
    const digest = createHmac('sha256', secret).update(base, 'utf8').digest('hex');
    const expected = `v0=${digest}`;
    if (expected !== signature) {
      throw new ForbiddenException('Invalid Slack signature');
    }
  }

  private validateOpenProjectToken(token?: string) {
    const expected = this.getWebhookSecret('OPENPROJECT_WEBHOOK_TOKEN');
    if (!expected) {
      return;
    }
    if (!token || token !== expected) {
      throw new ForbiddenException('Invalid OpenProject webhook token');
    }
  }

  private validateGithubSignature(rawBody: string | null, signature?: string) {
    const secret = this.getWebhookSecret('GITHUB_WEBHOOK_SECRET');
    if (!secret) {
      return;
    }
    if (!rawBody || !signature) {
      throw new ForbiddenException('Missing GitHub signature');
    }
    const digest = createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');
    const expected = `sha256=${digest}`;
    if (expected !== signature) {
      throw new ForbiddenException('Invalid GitHub signature');
    }
  }

  private async findGithubIntegrationCandidates(
    payload: Record<string, any>,
    organizationId?: string,
  ) {
    const repoId = payload?.repository?.id
      ? String(payload.repository.id)
      : null;
    const repoFullName = payload?.repository?.full_name || null;

    if (!repoId && !repoFullName) {
      return [];
    }

    const query = this.integrationConfigRepository
      .createQueryBuilder('config')
      .where('config.provider = :provider', { provider: 'github' });

    if (organizationId) {
      query.andWhere('config.organizationId = :organizationId', {
        organizationId,
      });
    }

    if (repoId && repoFullName) {
      query.andWhere(
        '(config.repoId = :repoId OR config.repoFullName = :repoFullName)',
        { repoId, repoFullName },
      );
    } else if (repoId) {
      query.andWhere('config.repoId = :repoId', { repoId });
    } else {
      query.andWhere('config.repoFullName = :repoFullName', { repoFullName });
    }

    return query.getMany();
  }

  private matchGithubWebhookSignature(
    rawBody: string | null,
    signature: string | undefined,
    candidates: IntegrationConfig[],
  ) {
    if (!rawBody || !signature || candidates.length === 0) {
      return null;
    }

    for (const candidate of candidates) {
      const digest = createHmac('sha256', candidate.webhookSecret)
        .update(rawBody, 'utf8')
        .digest('hex');
      const expected = `sha256=${digest}`;
      if (this.safeEquals(expected, signature)) {
        return candidate;
      }
    }

    return null;
  }

  private safeEquals(a: string, b: string) {
    const aBuffer = Buffer.from(a, 'utf8');
    const bBuffer = Buffer.from(b, 'utf8');
    if (aBuffer.length !== bBuffer.length) {
      return false;
    }
    return timingSafeEqual(aBuffer, bBuffer);
  }

  private requireOrganizationId(organizationId?: string) {
    if (!organizationId) {
      throw new BadRequestException('x-org-id header is required');
    }
    return organizationId;
  }

  private async assertProductInOrganization(productId: number, organizationId: string) {
    const product = await this.productRepository.findOne({
      where: { id: productId, organizationId },
    });
    if (!product) {
      throw new BadRequestException('Product not found for organization');
    }
  }

  private serializeGithubIntegrationConfig(config: IntegrationConfig) {
    return {
      id: config.id,
      provider: config.provider,
      organizationId: config.organizationId,
      productId: config.productId,
      repoId: config.repoId,
      repoFullName: config.repoFullName,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  private validateGitlabToken(token?: string, rawBody?: string | null) {
    const secret = this.getWebhookSecret('GITLAB_WEBHOOK_TOKEN');
    if (!secret) {
      return;
    }
    if (!token) {
      throw new ForbiddenException('Missing GitLab token');
    }
    if (token !== secret) {
      throw new ForbiddenException('Invalid GitLab token');
    }
  }

  private validateBitbucketSignature(rawBody: string | null, signature?: string) {
    const secret = this.getWebhookSecret('BITBUCKET_WEBHOOK_SECRET');
    if (!secret) {
      return;
    }
    if (!rawBody || !signature) {
      throw new ForbiddenException('Missing Bitbucket signature');
    }
    const digest = createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex');
    const expected = `sha256=${digest}`;
    if (expected !== signature) {
      throw new ForbiddenException('Invalid Bitbucket signature');
    }
  }

  private normalizeSlack(payload: SlackInboundDto) {
    const slackEvent = payload.event || {};
    const text = typeof slackEvent.text === 'string' ? slackEvent.text : '';
    const channel = slackEvent.channel || null;
    const user = slackEvent.user || null;
    const team = payload.team_id || null;
    const contextParts = [
      team ? `team=${team}` : null,
      channel ? `channel=${channel}` : null,
      user ? `user=${user}` : null,
    ].filter(Boolean);

    return {
      provider: 'slack',
      text: text.trim(),
      channel,
      user,
      externalMessageId: slackEvent.client_msg_id || payload.event_id || null,
      timestamp: slackEvent.ts || payload.event_time || null,
      context: contextParts.length ? `Slack (${contextParts.join(', ')})` : 'Slack',
    };
  }

  private validateIntegrationToken(token?: string) {
    const expected = this.getWebhookSecret('INTEGRATION_WEBHOOK_TOKEN');
    if (!expected) {
      return;
    }
    if (!token || token !== expected) {
      throw new ForbiddenException('Invalid integration token');
    }
  }

  private getDefaultMaxDrafts(): number {
    const raw = this.configService.get<string>('INTEGRATION_MAX_DRAFTS');
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 5;
    }
    return Math.min(Math.floor(parsed), 10);
  }

  private getWebhookSecret(key: string): string | null {
    const value = this.configService.get<string>(key) || null;
    if (value) {
      return value;
    }
    if (this.shouldEnforceWebhookSecrets()) {
      throw new ForbiddenException(`${key} is not configured`);
    }
    return null;
  }

  private shouldEnforceWebhookSecrets() {
    const explicit = this.configService.get<string>('ENFORCE_WEBHOOK_SECRETS');
    if (explicit !== undefined) {
      return explicit === 'true';
    }
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    return nodeEnv === 'production';
  }

  private getMattermostIgnoreReason(payload: MattermostInboundDto): string | null {
    const requireTrigger =
      this.configService.get<string>('MATTERMOST_REQUIRE_TRIGGER_WORD') === 'true';
    if (requireTrigger && !payload.trigger_word) {
      return 'Missing trigger word';
    }

    const allowed = this.configService.get<string>(
      'MATTERMOST_ALLOWED_TRIGGER_WORDS',
    );
    if (allowed) {
      const allowedList = allowed
        .split(',')
        .map((word) => word.trim().toLowerCase())
        .filter(Boolean);
      if (
        allowedList.length &&
        (!payload.trigger_word ||
          !allowedList.includes(payload.trigger_word.toLowerCase()))
      ) {
        return 'Trigger word not allowed';
      }
    }
    return null;
  }

  private async updateEvent(
    id: number,
    fields: Partial<IntegrationEvent>,
  ): Promise<void> {
    await this.eventRepository.save({ id, ...fields });
  }

  private getSlackIgnoreReason(event: Record<string, any>): string | null {
    if (!event || typeof event !== 'object') {
      return 'Missing event payload';
    }
    if (event.subtype || event.bot_id) {
      return 'Bot or subtype message ignored';
    }
    if (!event.text) {
      return 'Empty message';
    }
    return null;
  }

  private normalizeOpenProject(payload: Record<string, any>) {
    const workPackage =
      payload?.work_package ||
      payload?.workPackage ||
      payload?.work_package_detail ||
      payload?.payload?.work_package ||
      payload?.work_package_data ||
      payload;

    const externalId =
      workPackage?.id ||
      workPackage?.work_package_id ||
      workPackage?.workPackageId ||
      payload?.work_package_id ||
      payload?.workPackageId ||
      payload?.id ||
      null;

    const status =
      workPackage?.status?.name ||
      workPackage?.status?.title ||
      workPackage?._links?.status?.title ||
      payload?.status?.name ||
      payload?.status?.title ||
      null;

    const priority =
      workPackage?.priority?.name ||
      workPackage?.priority?.title ||
      workPackage?._links?.priority?.title ||
      payload?.priority?.name ||
      payload?.priority?.title ||
      null;

    const title = workPackage?.subject || workPackage?.title || payload?.subject || null;
    const description =
      workPackage?.description?.raw ||
      workPackage?.description ||
      payload?.description ||
      null;

    return {
      externalId: externalId ? String(externalId) : null,
      status: status ? String(status) : null,
      priority: priority ? String(priority) : null,
      title: title ? String(title) : null,
      description: description ? String(description) : null,
      eventType: payload?.action || payload?.event || payload?.type || null,
    };
  }

  private extractTicketIds(message: string): number[] {
    const raw = this.configService.get<string>('GIT_TICKET_ID_REGEX') || '#(\\d+)';
    let regex: RegExp | null = null;
    try {
      regex = new RegExp(raw, 'g');
    } catch (error) {
      regex = /#(\d+)/g;
    }

    const ids = new Set<number>();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(message)) !== null) {
      const value = match[1] || match[0];
      const parsed = Number(String(value).replace(/\D+/g, ''));
      if (Number.isFinite(parsed)) {
        ids.add(parsed);
      }
    }
    return Array.from(ids);
  }

  private extractBitbucketCommits(payload: Record<string, any>): any[] {
    const commits: any[] = [];
    const changes = Array.isArray(payload?.push?.changes)
      ? payload.push.changes
      : [];
    for (const change of changes) {
      const changeCommits = Array.isArray(change?.commits) ? change.commits : [];
      for (const commit of changeCommits) {
        commits.push({
          id: commit?.hash || commit?.id || commit?.commit || null,
          message: commit?.message || '',
        });
      }

      const target = change?.new?.target;
      if (target && !changeCommits.length) {
        commits.push({
          id: target?.hash || target?.id || null,
          message: target?.message || '',
        });
      }
    }
    return commits.filter((commit) => commit.id);
  }

  private getOpenProjectSyncFields(): string[] {
    const raw =
      this.configService.get<string>('OPENPROJECT_SYNC_FIELDS') ||
      'status,priority';
    return raw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }

  private mapOpenProjectStatus(status: string | null): string | null {
    if (!status) {
      return null;
    }
    const normalized = status.trim().toLowerCase();
    if (normalized.includes('cancel')) {
      return 'cancelled';
    }
    if (
      normalized.includes('done') ||
      normalized.includes('closed') ||
      normalized.includes('resolved')
    ) {
      return 'done';
    }
    if (normalized.includes('progress')) {
      return 'in_progress';
    }
    if (normalized.includes('open') || normalized.includes('new') || normalized === 'todo') {
      return 'todo';
    }
    return null;
  }

  private mapOpenProjectPriority(priority: string | null): string | null {
    if (!priority) {
      return null;
    }
    const normalized = priority.trim().toLowerCase();
    if (normalized.includes('urgent') || normalized.includes('critical') || normalized.includes('immediate')) {
      return 'urgent';
    }
    if (normalized.includes('high')) {
      return 'high';
    }
    if (normalized.includes('low')) {
      return 'low';
    }
    if (normalized.includes('normal') || normalized.includes('medium')) {
      return 'medium';
    }
    return null;
  }
}
