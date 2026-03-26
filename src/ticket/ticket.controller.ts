// src/ticket/ticket.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { GenerateTicketDraftsDto } from './dto/generate-ticket-drafts.dto';
import { ApproveTicketDraftDto } from './dto/approve-ticket-draft.dto';
import { LinkCommitDto } from './dto/link-commit.dto';
import { SaveCommitLinkDto } from './dto/save-commit-link.dto';
import { RejectTicketDraftDto } from './dto/reject-ticket-draft.dto';
import { MergeTicketDraftDto } from './dto/merge-ticket-draft.dto';
import { IngestChatDto } from './dto/ingest-chat.dto';
import { IngestWebDto } from './dto/ingest-web.dto';
import { AutoLinkCommitDto } from './dto/auto-link-commit.dto';
import { EscalateSlaDto } from './dto/escalate-sla.dto';
import { AnalyzeTicketTriageDto } from './dto/analyze-ticket-triage.dto';
import { AiTicketService } from './ai-ticket.service';
import { TicketDraftService } from './ticket-draft.service';
import { TicketCommitLinkService } from './ticket-commit-link.service';
import { TicketIngestService } from './ticket-ingest.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgGuard } from '../organization/guards/org.guard';
import { UsageService } from '../usage/usage.service';
import { TicketTriageService } from './ticket-triage.service';

@Controller('tickets')
@UseGuards(JwtAuthGuard, OrgGuard)
export class TicketController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly aiTicketService: AiTicketService,
    private readonly ticketDraftService: TicketDraftService,
    private readonly ticketCommitLinkService: TicketCommitLinkService,
    private readonly ticketIngestService: TicketIngestService,
    private readonly ticketTriageService: TicketTriageService,
    private readonly configService: ConfigService,
    private readonly usageService: UsageService,
  ) {}

  @Post()
  create(
    @Body() createTicketDto: CreateTicketDto,
    @Headers('x-org-id') orgId: string,
  ) {
    return this.ticketService.create(createTicketDto, orgId);
  }

  @Get()
  findAll(@Headers('x-org-id') orgId: string) {
    return this.ticketService.findAll(orgId);
  }

  @Post('generate-drafts')
  async generateDrafts(
    @Body() generateTicketDraftsDto: GenerateTicketDraftsDto,
    @Headers('x-org-id') orgId: string,
  ) {
    await this.usageService.assertWithinLimit(orgId, 'ticket_draft');

    const drafts = await this.aiTicketService.generateTicketDrafts(
      generateTicketDraftsDto,
      orgId,
    );
    const draftsWithDecisionContext = drafts.map((draft) => ({
      ...draft,
      decisionSnapshot: generateTicketDraftsDto.decisionSnapshot,
    }));
    const created = await this.ticketDraftService.createDrafts(
      draftsWithDecisionContext,
      orgId,
    );

    await this.usageService.recordEvent({
      organizationId: orgId,
      kind: 'ticket_draft',
      quantity: created.length,
    });

    return created;
  }

  @Post('ingest-chat')
  async ingestChat(
    @Body() ingestChatDto: IngestChatDto,
    @Headers('x-org-id') orgId: string,
  ) {
    await this.usageService.assertWithinLimit(orgId, 'ticket_draft');

    const drafts = await this.aiTicketService.generateTicketDrafts(
      {
        source: 'chat',
        rawInput: ingestChatDto.chatText,
        context: ingestChatDto.context,
        productId: ingestChatDto.productId,
        maxDrafts: ingestChatDto.maxDrafts,
      },
      orgId,
    );
    const created = await this.ticketDraftService.createDrafts(drafts, orgId);

    await this.usageService.recordEvent({
      organizationId: orgId,
      kind: 'ticket_draft',
      quantity: created.length,
      metadata: { source: 'chat' },
    });

    return created;
  }

  @Post('ingest-web')
  async ingestWeb(
    @Body() ingestWebDto: IngestWebDto,
    @Headers('x-org-id') orgId: string,
  ) {
    await this.usageService.assertWithinLimit(orgId, 'ticket_draft');

    const rawInput = await this.ticketIngestService.ingestWeb(ingestWebDto);
    const drafts = await this.aiTicketService.generateTicketDrafts(
      {
        source: 'scrape',
        rawInput,
        context: ingestWebDto.context || ingestWebDto.url,
        productId: ingestWebDto.productId,
        maxDrafts: ingestWebDto.maxDrafts,
      },
      orgId,
    );
    const created = await this.ticketDraftService.createDrafts(drafts, orgId);

    await this.usageService.recordEvent({
      organizationId: orgId,
      kind: 'ticket_draft',
      quantity: created.length,
      metadata: { source: 'scrape' },
    });

    return created;
  }

  @Get('drafts')
  findAllDrafts(@Headers('x-org-id') orgId: string) {
    return this.ticketDraftService.findAllDraftsByOrg(orgId);
  }

  @Get('drafts/:id')
  findDraftById(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-org-id') orgId: string,
  ) {
    return this.ticketDraftService.findDraftById(id, orgId);
  }

  @Get('drafts/:id/audit')
  listDraftAudit(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-org-id') orgId: string,
  ) {
    return this.ticketDraftService.listDraftAudit(id, orgId);
  }

  @Post('drafts/:id/approve')
  approveDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body() approveTicketDraftDto: ApproveTicketDraftDto,
    @Headers('x-org-id') orgId: string,
  ) {
    return this.ticketDraftService.approveDraft(id, approveTicketDraftDto, orgId);
  }

  @Post('drafts/:id/reject')
  rejectDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body() rejectTicketDraftDto: RejectTicketDraftDto,
    @Headers('x-org-id') orgId: string,
  ) {
    return this.ticketDraftService.rejectDraft(id, rejectTicketDraftDto, orgId);
  }

  @Post('drafts/:id/merge-existing')
  mergeDraftIntoExisting(
    @Param('id', ParseIntPipe) id: number,
    @Body() mergeTicketDraftDto: MergeTicketDraftDto,
    @Headers('x-org-id') orgId: string,
  ) {
    return this.ticketDraftService.mergeIntoExistingTicket(
      id,
      mergeTicketDraftDto,
      orgId,
    );
  }

  @Post('link-commit')
  async linkCommit(
    @Body() linkCommitDto: LinkCommitDto,
    @Headers('x-org-id') orgId: string,
  ) {
    await this.usageService.assertWithinLimit(orgId, 'commit_link');

    const decision = await this.aiTicketService.classifyCommitLink(
      linkCommitDto,
      orgId,
    );

    await this.usageService.recordEvent({
      organizationId: orgId,
      kind: 'commit_link',
    });

    return decision;
  }

  @Post('triage/analyze')
  async analyzeTriage(
    @Body() analyzeTicketTriageDto: AnalyzeTicketTriageDto,
    @Headers('x-org-id') orgId: string,
  ) {
    const quantity = analyzeTicketTriageDto.rawReports?.length || 1;
    await this.usageService.assertWithinLimit(orgId, 'triage_analysis', quantity);

    const result = await this.ticketTriageService.analyze(
      analyzeTicketTriageDto,
      orgId,
    );

    await this.usageService.recordEvent({
      organizationId: orgId,
      kind: 'triage_analysis',
      quantity,
      metadata: {
        mode: analyzeTicketTriageDto.mode || 'hybrid',
        pastTicketCount: analyzeTicketTriageDto.pastTickets?.length || 0,
        candidateOwnerCount:
          analyzeTicketTriageDto.candidateOwners?.length || 0,
      },
    });

    return result;
  }

  @Post('sla/escalate')
  escalateSla(
    @Body() escalateSlaDto: EscalateSlaDto,
    @Headers('x-org-id') orgId: string,
  ) {
    return this.ticketService.escalateStaleTickets(escalateSlaDto, orgId);
  }

  @Post('link-commit/auto')
  async autoLinkCommit(
    @Body() autoLinkCommitDto: AutoLinkCommitDto,
    @Headers('x-org-id') orgId: string,
  ) {
    await this.usageService.assertWithinLimit(orgId, 'commit_link');

    const decision = await this.aiTicketService.classifyCommitLink(
      autoLinkCommitDto,
      orgId,
    );

    await this.usageService.recordEvent({
      organizationId: orgId,
      kind: 'commit_link',
      metadata: { auto: true },
    });

    if (!decision) {
      return { linked: false, decision: null };
    }

    const defaultThreshold = Number(
      this.configService.get<string>('AUTO_LINK_CONFIDENCE_THRESHOLD') || 0.85,
    );
    const threshold =
      autoLinkCommitDto.minConfidence ?? defaultThreshold;

    if (decision.confidence < threshold) {
      return { linked: false, decision };
    }

    const statusOverride =
      autoLinkCommitDto.updateTicketStatus ||
      this.configService.get<string>('AUTO_LINK_STATUS') ||
      undefined;

    const link = await this.ticketCommitLinkService.createLink(
      {
        commitSha: autoLinkCommitDto.commitSha,
        commitMessage: autoLinkCommitDto.commitMessage,
        repoUrl: autoLinkCommitDto.repoUrl,
        diffSummary: autoLinkCommitDto.diffSummary,
        ticketId: decision.ticketId,
        confidence: decision.confidence,
        rationale:
          autoLinkCommitDto.autoLinkReason || decision.rationale || undefined,
        updateTicketStatus: statusOverride,
      },
      orgId,
    );

    return { linked: true, decision, link };
  }

  @Post('link-commit/confirm')
  confirmCommitLink(
    @Body() saveCommitLinkDto: SaveCommitLinkDto,
    @Headers('x-org-id') orgId: string,
  ) {
    return this.ticketCommitLinkService.createLink(saveCommitLinkDto, orgId);
  }

  @Get(':id/commit-links')
  async listCommitLinks(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-org-id') orgId: string,
  ) {
    if (orgId) {
      await this.ticketService.findOne(id, orgId);
    }
    return this.ticketCommitLinkService.findByTicketId(id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-org-id') orgId: string,
  ) {
    return this.ticketService.findOne(id, orgId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTicketDto: UpdateTicketDto,
    @Headers('x-org-id') orgId: string,
  ) {
    return this.ticketService.update(id, updateTicketDto, orgId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-org-id') orgId: string,
  ) {
    return this.ticketService.remove(id, orgId);
  }
}
