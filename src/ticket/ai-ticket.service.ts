import { Injectable, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProviderService } from '../ai-agent/ai-provider.service';
import { AiEvaluationLogService } from '../ai-agent/ai-evaluation.service';
import {
  TICKET_DRAFTS_PROMPT_V1,
  COMMIT_LINK_PROMPT_V1,
} from '../ai-agent/prompts/ticket.prompts';
import { AiTicketInterface } from './interfaces/ai-ticket.interface';
import { GenerateTicketDraftsDto } from './dto/generate-ticket-drafts.dto';
import {
  AiTicketDraftDto,
  TicketPriorityValues,
  TicketStatusValues,
} from './dto/ai-ticket-draft.dto';
import { LinkCommitDto } from './dto/link-commit.dto';
import { CommitLinkDecisionDto } from './dto/commit-link-decision.dto';
import { Ticket } from './entities/ticket.entity';

@Injectable()
export class AiTicketService implements AiTicketInterface {
  constructor(
    private readonly aiProviderService: AiProviderService,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly aiEvaluationLogService: AiEvaluationLogService,
  ) {}

  async generateTicketDrafts(
    input: GenerateTicketDraftsDto,
    organizationId?: string,
  ): Promise<AiTicketDraftDto[]> {
    const aiAgent = this.aiProviderService.getProvider();
    const providerName = aiAgent.providerName;
    const maxDrafts = this.normalizeMaxDrafts(input.maxDrafts);
    const rawInputHash = createHash('sha256')
      .update(input.rawInput)
      .digest('hex');

    let lastError: string | null = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const prompt = TICKET_DRAFTS_PROMPT_V1.build(
        input,
        maxDrafts,
        attempt === 2 ? lastError : null,
      );
      const response = await aiAgent.generateResponse(prompt);
      let validationError: string | null = null;
      let parsedDrafts: any[] = [];
      try {
        parsedDrafts = this.parseDrafts(response);
      } catch (error) {
        validationError = error?.message || 'Invalid AI response format';
      }

      const validation = validationError
        ? { valid: false, drafts: [], error: validationError }
        : this.validateDrafts(parsedDrafts, maxDrafts);

      if (validation.valid) {
        await this.aiEvaluationLogService.logSuccess({
          provider: aiAgent.providerName,
          prompt,
          response,
          context: aiAgent.context,
          organizationId,
          metadata: {
            type: 'ticket-drafts',
            attempt,
            source: input.source,
            maxDrafts,
            promptVersion: TICKET_DRAFTS_PROMPT_V1.version,
          },
        });
        return validation.drafts.map((draft) => ({
          title: draft.title,
          description: draft.description,
          status: draft.status || 'todo',
          priority: draft.priority || 'medium',
          confidence: draft.confidence,
          source: input.source,
          aiProvider: providerName,
          rawInputHash,
          productId: input.productId,
          assignedToId: undefined,
        }));
      }

      await this.aiEvaluationLogService.logFailure({
        provider: aiAgent.providerName,
        prompt,
        response,
        context: aiAgent.context,
        organizationId,
        errorMessage: validation.error || 'Invalid draft format',
        metadata: {
          type: 'ticket-drafts',
          attempt,
          source: input.source,
          maxDrafts,
          promptVersion: TICKET_DRAFTS_PROMPT_V1.version,
        },
      });

      lastError = validation.error || 'Invalid draft format';
    }

    throw new Error(`Invalid AI response format: ${lastError}`);
  }

  async classifyCommitLink(
    input: LinkCommitDto,
    organizationId?: string,
  ): Promise<CommitLinkDecisionDto | null> {
    if (!input.candidateTicketIds || input.candidateTicketIds.length === 0) {
      throw new BadRequestException(
        'candidateTicketIds is required to classify commit links',
      );
    }

    const tickets = await this.ticketRepository.find({
      where: input.candidateTicketIds.map((id) =>
        organizationId ? { id, organizationId } : { id },
      ),
    });

    if (!tickets.length) {
      throw new BadRequestException('No candidate tickets found');
    }

    const aiAgent = this.aiProviderService.getProvider();
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const candidateText = tickets
        .map(
          (ticket) =>
            `- ${ticket.id}: ${ticket.title} | ${ticket.description} | status=${ticket.status} | priority=${ticket.priority}`,
        )
        .join('\n');

      const prompt = COMMIT_LINK_PROMPT_V1.build(
        input,
        candidateText,
        attempt === 2 ? lastError : null,
      );
      const response = await aiAgent.generateResponse(prompt);
      let validationError: string | null = null;
      let decision: any = null;
      try {
        decision = this.parseCommitDecision(response);
      } catch (error) {
        validationError = error?.message || 'Invalid AI response format';
      }

      const validation = validationError
        ? { valid: false, decision: null, error: validationError }
        : this.validateCommitDecision(decision, tickets);

      if (validation.valid) {
        await this.aiEvaluationLogService.logSuccess({
          provider: aiAgent.providerName,
          prompt,
          response,
          context: aiAgent.context,
          organizationId,
          metadata: {
            type: 'commit-link',
            attempt,
            candidateTicketIds: input.candidateTicketIds,
            promptVersion: COMMIT_LINK_PROMPT_V1.version,
          },
        });
        return validation.decision;
      }

      await this.aiEvaluationLogService.logFailure({
        provider: aiAgent.providerName,
        prompt,
        response,
        context: aiAgent.context,
        organizationId,
        errorMessage: validation.error || 'Invalid commit link decision',
        metadata: {
          type: 'commit-link',
          attempt,
          candidateTicketIds: input.candidateTicketIds,
          promptVersion: COMMIT_LINK_PROMPT_V1.version,
        },
      });

      lastError = validation.error || 'Invalid commit link decision';
    }

    throw new Error(`Invalid AI response format: ${lastError}`);
  }

  private parseDrafts(response: string): any[] {
    const cleanResponse = response
      .trim()
      .replace(/```(json)?/g, '')
      .replace(/```/g, '');

    let parsed: any;
    try {
      const extracted = this.extractJsonArray(cleanResponse) ?? cleanResponse;
      parsed = JSON.parse(extracted);
    } catch (error) {
      throw new Error('Invalid AI response format: expected JSON');
    }

    const drafts = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.tickets)
      ? parsed.tickets
      : null;

    if (!drafts || drafts.length === 0) {
      throw new Error('Invalid AI response format: no drafts found');
    }

    return drafts;
  }

  private validateDrafts(
    drafts: any[],
    maxDrafts: number,
  ): { valid: boolean; drafts: AiTicketDraftDto[]; error?: string } {
    const normalized: AiTicketDraftDto[] = [];
    for (const item of drafts.slice(0, maxDrafts)) {
      if (!item || typeof item !== 'object') {
        return { valid: false, drafts: [], error: 'Draft is not an object' };
      }

      const title = typeof item.title === 'string' ? item.title.trim() : '';
      const description =
        typeof item.description === 'string' ? item.description.trim() : '';
      if (!title || !description) {
        return {
          valid: false,
          drafts: [],
          error: 'Each draft must include non-empty title and description',
        };
      }

      if (
        item.status &&
        !TicketStatusValues.includes(item.status as any)
      ) {
        return {
          valid: false,
          drafts: [],
          error: `Invalid status value: ${item.status}`,
        };
      }

      if (
        item.priority &&
        !TicketPriorityValues.includes(item.priority as any)
      ) {
        return {
          valid: false,
          drafts: [],
          error: `Invalid priority value: ${item.priority}`,
        };
      }

      if (
        item.confidence !== undefined &&
        (typeof item.confidence !== 'number' ||
          item.confidence < 0 ||
          item.confidence > 1)
      ) {
        return {
          valid: false,
          drafts: [],
          error: `Invalid confidence value: ${item.confidence}`,
        };
      }

      normalized.push({
        title,
        description,
        status: item.status,
        priority: item.priority,
        confidence:
          typeof item.confidence === 'number' ? item.confidence : undefined,
        source: 'manual',
      });
    }

    if (!normalized.length) {
      return {
        valid: false,
        drafts: [],
        error: 'No valid drafts after validation',
      };
    }

    return { valid: true, drafts: normalized };
  }

  private normalizeMaxDrafts(input?: number): number {
    if (!input || input < 1) {
      return 5;
    }
    return Math.min(input, 10);
  }

  private parseCommitDecision(response: string): any {
    const cleanResponse = response
      .trim()
      .replace(/```(json)?/g, '')
      .replace(/```/g, '');

    try {
      const extracted = this.extractJsonObject(cleanResponse) ?? cleanResponse;
      return JSON.parse(extracted);
    } catch (error) {
      throw new Error('Invalid AI response format: expected JSON');
    }
  }

  private validateCommitDecision(
    decision: any,
    tickets: Ticket[],
  ): { valid: boolean; decision: CommitLinkDecisionDto | null; error?: string } {
    if (!decision || typeof decision !== 'object') {
      return { valid: false, decision: null, error: 'Decision is not an object' };
    }

    const ticketId =
      decision.ticketId === null || decision.ticketId === undefined
        ? null
        : Number(decision.ticketId);

    if (
      ticketId !== null &&
      !tickets.some((ticket) => ticket.id === ticketId)
    ) {
      return {
        valid: false,
        decision: null,
        error: `ticketId must be one of the candidate ids or null`,
      };
    }

    if (
      typeof decision.confidence !== 'number' ||
      decision.confidence < 0 ||
      decision.confidence > 1
    ) {
      return {
        valid: false,
        decision: null,
        error: 'confidence must be a number between 0 and 1',
      };
    }

    if (
      decision.rationale !== undefined &&
      decision.rationale !== null &&
      typeof decision.rationale !== 'string'
    ) {
      return {
        valid: false,
        decision: null,
        error: 'rationale must be a string if provided',
      };
    }

    if (ticketId === null) {
      return { valid: true, decision: null };
    }

    return {
      valid: true,
      decision: {
        ticketId,
        confidence: decision.confidence,
        rationale: decision.rationale,
      },
    };
  }

  private extractJsonArray(text: string): string | null {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }
    return text.slice(start, end + 1);
  }

  private extractJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }
    return text.slice(start, end + 1);
  }
}
