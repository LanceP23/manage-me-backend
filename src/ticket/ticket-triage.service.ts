import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiEvaluationLogService } from '../ai-agent/ai-evaluation.service';
import { AiProviderService } from '../ai-agent/ai-provider.service';
import { AnalyzeTicketTriageDto } from './dto/analyze-ticket-triage.dto';
import { Ticket } from './entities/ticket.entity';
import {
  TicketTriageActionTarget,
  TicketTriageAnalysisResponseDto,
  TicketTriageMatchedPastTicket,
  TicketTriageRecommendation,
  TicketTriageSuggestedOwner,
  TriageDuplicateRisk,
  TriageEffort,
  TriagePriority,
  TriageRecommendedAction,
} from './dto/ticket-triage-response.dto';

type DomainTag =
  | 'payments'
  | 'auth'
  | 'mobile'
  | 'frontend'
  | 'backend'
  | 'infra'
  | 'data';

type PrioritySignal = {
  weight: number;
  reason: string;
  patterns: RegExp[];
};

type TicketTriageEffort = {
  estimate: TriageEffort;
  reasons: string[];
};

type HistoricalMatch = TicketTriageMatchedPastTicket & {
  score: number;
  overlap: number;
  tagOverlap: number;
  ownerHint?: string;
  priority?: string;
};

type OwnerSuggestion = {
  suggestedOwner: TicketTriageSuggestedOwner;
  reasons: string[];
  score: number;
};

type ActionRecommendation = {
  duplicateRisk: TriageDuplicateRisk;
  recommendedAction: TriageRecommendedAction;
  recommendedActionReasoning: string[];
  recommendedTargetTicket: TicketTriageActionTarget;
};

type TriageMode = 'heuristic' | 'hybrid';

type TriageReasoningRewrite = {
  reportIndex: number;
  priorityReasoning?: string[];
  ownerReasoning?: string[];
  effortReasoning?: string[];
  recommendedActionReasoning?: string[];
};

type TriageReasoningRewriteResponse = {
  rewrites: TriageReasoningRewrite[];
};

const PRIORITY_ORDER: Record<TriagePriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const DOMAIN_KEYWORDS: Record<DomainTag, string[]> = {
  payments: [
    'billing',
    'card',
    'charge',
    'checkout',
    'invoice',
    'payment',
    'payout',
    'refund',
    'stripe',
  ],
  auth: [
    'auth',
    'authenticate',
    'authorization',
    'login',
    'logout',
    'password',
    'session',
    'signin',
    'signup',
    'token',
  ],
  mobile: ['android', 'app', 'ios', 'mobile', 'tablet'],
  frontend: [
    'button',
    'component',
    'css',
    'frontend',
    'layout',
    'page',
    'screen',
    'text',
    'ui',
  ],
  backend: [
    'api',
    'backend',
    'database',
    'endpoint',
    'queue',
    'server',
    'service',
    'timeout',
    'webhook',
    'worker',
  ],
  infra: [
    'cpu',
    'cron',
    'deploy',
    'downtime',
    'infrastructure',
    'latency',
    'memory',
    'outage',
    'performance',
    'uptime',
  ],
  data: ['corrupt', 'data', 'delete', 'duplicate', 'export', 'import', 'missing'],
};

const HIGH_PRIORITY_SIGNALS: PrioritySignal[] = [
  {
    weight: 4,
    reason: 'Report suggests users are blocked from completing a core workflow.',
    patterns: [
      /\bcannot\b/,
      /\bcan'?t\b/,
      /\bblocked\b/,
      /\bfail(?:ed|ing|s)?\b/,
      /\bunable to\b/,
    ],
  },
  {
    weight: 4,
    reason: 'Issue appears to involve a crash, outage, or unavailable service.',
    patterns: [
      /\bcrash(?:es|ed|ing)?\b/,
      /\bdown\b/,
      /\boutage\b/,
      /\bunavailable\b/,
      /\b502\b/,
      /\b503\b/,
      /\b500\b/,
    ],
  },
  {
    weight: 3,
    reason: 'Production or live environment is explicitly affected.',
    patterns: [/\bproduction\b/, /\blive\b/, /\bprod\b/],
  },
  {
    weight: 3,
    reason: 'The report touches a revenue-critical payment or checkout flow.',
    patterns: [/\bpayment\b/, /\bcheckout\b/, /\bbilling\b/, /\bcard\b/],
  },
  {
    weight: 3,
    reason: 'Authentication or login flow appears affected.',
    patterns: [/\blogin\b/, /\bsign[\s-]?in\b/, /\bauth\b/, /\btoken\b/],
  },
  {
    weight: 3,
    reason: 'The impact sounds broad across customers or users.',
    patterns: [
      /\ball users\b/,
      /\beveryone\b/,
      /\bmultiple customers\b/,
      /\bmany users\b/,
      /\bwidespread\b/,
      /\bcustomers\b/,
    ],
  },
  {
    weight: 3,
    reason: 'The report mentions security or data integrity risk.',
    patterns: [
      /\bsecurity\b/,
      /\bbreach\b/,
      /\bdata loss\b/,
      /\bmissing data\b/,
      /\bcorrupt(?:ion)?\b/,
    ],
  },
];

const LOW_PRIORITY_SIGNALS: PrioritySignal[] = [
  {
    weight: -2,
    reason: 'The report appears cosmetic or content-related rather than workflow-blocking.',
    patterns: [
      /\balignment\b/,
      /\bcopy\b/,
      /\bcosmetic\b/,
      /\bcolor\b/,
      /\bspacing\b/,
      /\btext\b/,
      /\btypo\b/,
    ],
  },
];

@Injectable()
export class TicketTriageService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly aiProviderService: AiProviderService,
    private readonly aiEvaluationLogService: AiEvaluationLogService,
  ) {}

  async analyze(
    input: AnalyzeTicketTriageDto,
    organizationId?: string,
  ): Promise<TicketTriageAnalysisResponseDto> {
    const requestedMode: TriageMode = input.mode === 'heuristic' ? 'heuristic' : 'hybrid';
    const pastTickets = await this.resolvePastTickets(input, organizationId);

    const heuristicRecommendations = input.rawReports.map((rawReport) =>
      this.analyzeReport(rawReport, input, pastTickets),
    );

    const {
      recommendations,
      reasoningSource,
    } = requestedMode === 'hybrid'
      ? await this.rewriteReasoningWithLlm(
          heuristicRecommendations,
          input,
          organizationId,
        )
      : {
          recommendations: heuristicRecommendations,
          reasoningSource: 'heuristic' as const,
        };

    const highestPriority = recommendations.reduce<TriagePriority>(
      (current, item) =>
        PRIORITY_ORDER[item.priority] > PRIORITY_ORDER[current]
          ? item.priority
          : current,
      'low',
    );

    return {
      summary: {
        reportCount: recommendations.length,
        highestPriority,
        mode: requestedMode,
        reasoningSource,
      },
      recommendations,
    };
  }

  private async rewriteReasoningWithLlm(
    recommendations: TicketTriageRecommendation[],
    input: AnalyzeTicketTriageDto,
    organizationId?: string,
  ): Promise<{
    recommendations: TicketTriageRecommendation[];
    reasoningSource: 'llm_rewritten' | 'heuristic_fallback';
  }> {
    if (!recommendations.length) {
      return {
        recommendations,
        reasoningSource: 'heuristic_fallback',
      };
    }

    const aiAgent = this.aiProviderService.getProvider();
    const prompt = this.buildHybridReasoningPrompt(recommendations, input);

    try {
      const response = await aiAgent.generateResponse(prompt);
      const parsed = this.parseReasoningRewriteResponse(response);
      const rewrittenRecommendations = this.applyReasoningRewrites(
        recommendations,
        parsed.rewrites,
      );

      await this.aiEvaluationLogService.logSuccess({
        provider: aiAgent.providerName,
        prompt,
        response,
        context: aiAgent.context,
        organizationId,
        metadata: {
          type: 'ticket-triage-reasoning',
          mode: 'hybrid',
          reportCount: recommendations.length,
        },
      });

      return {
        recommendations: rewrittenRecommendations,
        reasoningSource: 'llm_rewritten',
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to rewrite triage reasoning';

      await this.aiEvaluationLogService.logFailure({
        provider: aiAgent.providerName,
        prompt,
        response: null,
        context: aiAgent.context,
        organizationId,
        errorMessage: message,
        metadata: {
          type: 'ticket-triage-reasoning',
          mode: 'hybrid',
          reportCount: recommendations.length,
        },
      });

      return {
        recommendations,
        reasoningSource: 'heuristic_fallback',
      };
    }
  }

  private analyzeReport(
    rawReport: string,
    input: AnalyzeTicketTriageDto,
    pastTickets: NonNullable<AnalyzeTicketTriageDto['pastTickets']>,
  ): TicketTriageRecommendation {
    const report = rawReport.trim();
    const contextText = this.buildContextText(input);
    const enrichedText = `${report} ${contextText}`.trim();
    const reportTags = this.extractTags(enrichedText);
    const matchedPastTickets = this.matchPastTickets(
      enrichedText,
      pastTickets,
      reportTags,
    );

    const priority = this.determinePriority(enrichedText, matchedPastTickets);
    const effort = this.determineEffort(enrichedText, reportTags, priority.priority);
    const action = this.recommendAction(enrichedText, matchedPastTickets);
    const owner = this.suggestOwner(
      enrichedText,
      reportTags,
      matchedPastTickets,
      input,
    );
    const confidence = this.calculateConfidence(
      priority.reasons,
      matchedPastTickets,
      owner.score,
      effort.reasons,
    );

    return {
      rawReport: report,
      priority: priority.priority,
      priorityReasoning: priority.reasons,
      suggestedOwner: owner.suggestedOwner,
      ownerReasoning: owner.reasons,
      effortEstimate: effort.estimate,
      effortReasoning: effort.reasons,
      duplicateRisk: action.duplicateRisk,
      recommendedAction: action.recommendedAction,
      recommendedActionReasoning: action.recommendedActionReasoning,
      recommendedTargetTicket: action.recommendedTargetTicket,
      matchedPastTickets: matchedPastTickets.map((ticket) => ({
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        similarityReason: ticket.similarityReason,
      })),
      confidence,
    };
  }

  private buildContextText(input: AnalyzeTicketTriageDto) {
    const parts = [
      input.context?.productArea ? `product area ${input.context.productArea}` : '',
      input.context?.environment ? `environment ${input.context.environment}` : '',
    ].filter(Boolean);

    return parts.join(' ');
  }

  private determinePriority(
    text: string,
    matchedPastTickets: HistoricalMatch[],
  ): { priority: TriagePriority; reasons: string[]; score: number } {
    let score = 0;
    const reasons: string[] = [];

    for (const signal of HIGH_PRIORITY_SIGNALS) {
      if (signal.patterns.some((pattern) => pattern.test(text))) {
        score += signal.weight;
        reasons.push(signal.reason);
      }
    }

    for (const signal of LOW_PRIORITY_SIGNALS) {
      if (signal.patterns.some((pattern) => pattern.test(text))) {
        score += signal.weight;
        reasons.push(signal.reason);
      }
    }

    if (matchedPastTickets.length > 0) {
      const strongestMatch = matchedPastTickets[0];
      score += strongestMatch.score >= 0.45 ? 2 : 1;
      reasons.push(
        strongestMatch.score >= 0.45
          ? 'A strong historical ticket match reinforces the likely severity.'
          : 'A related historical ticket provides additional context for severity.',
      );
    }

    if (!reasons.length) {
      reasons.push('The report has limited explicit severity signals, so the system stays conservative.');
    }

    if (score >= 8) {
      return { priority: 'high', reasons, score };
    }
    if (score >= 3) {
      return { priority: 'medium', reasons, score };
    }
    return { priority: 'low', reasons, score };
  }

  private determineEffort(
    text: string,
    tags: Set<DomainTag>,
    priority: TriagePriority,
  ): TicketTriageEffort {
    const reasons: string[] = [];

    if (LOW_PRIORITY_SIGNALS.some((signal) => signal.patterns.some((pattern) => pattern.test(text)))) {
      reasons.push('Signals point to a cosmetic or presentation issue.');
      return { estimate: 'small', reasons };
    }

    const affectsCoreFlow = HIGH_PRIORITY_SIGNALS
      .slice(0, 5)
      .some((signal) => signal.patterns.some((pattern) => pattern.test(text)));
    const isCrossFunctional =
      tags.has('frontend') &&
      (tags.has('backend') || tags.has('payments') || tags.has('auth'));
    const isCriticalSystemIssue =
      priority === 'high' &&
      (tags.has('payments') ||
        tags.has('auth') ||
        tags.has('infra') ||
        tags.has('data'));

    if (priority === 'high' && (isCrossFunctional || isCriticalSystemIssue)) {
      reasons.push('The issue likely spans multiple layers or a critical production system.');
      return { estimate: 'large', reasons };
    }

    if (affectsCoreFlow || tags.size >= 2) {
      reasons.push('The issue likely needs investigation inside at least one active subsystem.');
      return { estimate: 'medium', reasons };
    }

    reasons.push('The report looks scoped enough for an isolated fix or validation.');
    return { estimate: 'small', reasons };
  }

  private suggestOwner(
    text: string,
    reportTags: Set<DomainTag>,
    matchedPastTickets: HistoricalMatch[],
    input: AnalyzeTicketTriageDto,
  ): OwnerSuggestion {
    const candidateOwners = input.candidateOwners || [];
    if (!candidateOwners.length) {
      return {
        suggestedOwner: null,
        reasons: ['No candidate owners were provided for assignment matching.'],
        score: 0,
      };
    }

    const pastOwnerHints = matchedPastTickets
      .map((ticket) => ticket.ownerHint?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value));

    let bestSuggestion: OwnerSuggestion = {
      suggestedOwner: null,
      reasons: ['No candidate owner matched the issue area strongly enough.'],
      score: 0,
    };

    for (const owner of candidateOwners) {
      let score = 0;
      const reasons: string[] = [];
      const roleText = this.normalize(owner.role || '');
      const skillText = this.normalize((owner.skills || []).join(' '));
      const ownerText = `${roleText} ${skillText}`.trim();

      for (const tag of reportTags) {
        const keywords = DOMAIN_KEYWORDS[tag];
        const roleMatches = roleText.includes(tag);
        const keywordMatches = keywords.some((keyword) => ownerText.includes(keyword));
        if (roleMatches) {
          score += 2;
          reasons.push(`Owner role aligns with the detected ${tag} area.`);
        } else if (keywordMatches) {
          score += 1;
          reasons.push(`Owner skills align with the detected ${tag} area.`);
        }
      }

      for (const hint of pastOwnerHints) {
        if (ownerText.includes(hint) || this.normalize(owner.name).includes(hint)) {
          score += 2;
          reasons.push('Historical ticket ownership points toward this owner profile.');
        }
      }

      if (
        input.context?.productArea &&
        ownerText.includes(this.normalize(input.context.productArea))
      ) {
        score += 1;
        reasons.push('Owner metadata references the current product area.');
      }

      if (score > bestSuggestion.score) {
        bestSuggestion = {
          suggestedOwner:
            score >= 2
              ? {
                  id: owner.id,
                  name: owner.name,
                }
              : null,
          reasons:
            reasons.length > 0
              ? this.uniqueReasons(reasons)
              : ['Owner metadata did not provide a strong enough match.'],
          score,
        };
      }
    }

    if (bestSuggestion.score < 2) {
      return {
        suggestedOwner: null,
        reasons: ['Candidate owners were provided, but none matched strongly enough to auto-suggest.'],
        score: bestSuggestion.score,
      };
    }

    return bestSuggestion;
  }

  private matchPastTickets(
    text: string,
    pastTickets: NonNullable<AnalyzeTicketTriageDto['pastTickets']>,
    reportTags: Set<DomainTag>,
  ): HistoricalMatch[] {
    const reportTokens = new Set(this.tokenize(text));

    return pastTickets
      .map((ticket) => {
        const ticketText = `${ticket.title} ${ticket.description || ''} ${ticket.ownerHint || ''}`;
        const ticketTokens = new Set(this.tokenize(ticketText));
        const overlap = this.countOverlap(reportTokens, ticketTokens);
        const union = new Set([...reportTokens, ...ticketTokens]).size || 1;
        const ticketTags = this.extractTags(ticketText);
        const tagOverlap = this.countTagOverlap(reportTags, ticketTags);
        const score = overlap / union + tagOverlap * 0.08;

        return {
          id: ticket.id,
          title: ticket.title,
          status: ticket.status,
          similarityReason: this.buildSimilarityReason(
            reportTokens,
            ticketTokens,
            reportTags,
            ticketTags,
          ),
          ownerHint: ticket.ownerHint,
          priority: ticket.priority,
          overlap,
          tagOverlap,
          score: Number(score.toFixed(2)),
        };
      })
      .filter((ticket) => {
        if (ticket.tagOverlap >= 2) {
          return ticket.score >= 0.12;
        }
        if (ticket.overlap >= 2) {
          return ticket.score >= 0.14;
        }
        return ticket.score >= 0.18;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  private recommendAction(
    text: string,
    matchedPastTickets: HistoricalMatch[],
  ): ActionRecommendation {
    const strongestMatch = matchedPastTickets[0];
    if (!strongestMatch) {
      return {
        duplicateRisk: 'low',
        recommendedAction: 'create_draft',
        recommendedActionReasoning: [
          'No strong historical match was found, so creating a new draft is the safest default.',
        ],
        recommendedTargetTicket: null,
      };
    }

    const target = {
      id: strongestMatch.id,
      title: strongestMatch.title,
      status: strongestMatch.status,
    };
    const reasons = [
      this.describeHistoricalMatch(strongestMatch),
      `The closest matching ticket is "${strongestMatch.title}"${
        strongestMatch.status ? ` and is currently ${strongestMatch.status}.` : '.'
      }`,
    ];
    const isStrongMatch =
      strongestMatch.score >= 0.24 ||
      strongestMatch.overlap >= 3 ||
      strongestMatch.tagOverlap >= 2;
    const isVeryStrongMatch =
      strongestMatch.score >= 0.32 ||
      strongestMatch.overlap >= 4 ||
      (strongestMatch.overlap >= 2 && strongestMatch.tagOverlap >= 2);

    if (
      strongestMatch.status === 'in_progress' &&
      (isVeryStrongMatch ||
        (strongestMatch.overlap >= 3 && strongestMatch.tagOverlap >= 1))
    ) {
      reasons.push(
        'The closest matching ticket is already in progress, so merging avoids duplicate work in the queue.',
      );
      return {
        duplicateRisk: 'high',
        recommendedAction: 'merge_into_existing',
        recommendedActionReasoning: reasons,
        recommendedTargetTicket: target,
      };
    }

    if (
      strongestMatch.status === 'done' &&
      isStrongMatch &&
      this.looksLikeRegression(text)
    ) {
      reasons.push(
        'The closest matching ticket was completed, and the wording suggests the problem has returned after a change or release.',
      );
      return {
        duplicateRisk: 'high',
        recommendedAction: 'reopen_existing',
        recommendedActionReasoning: reasons,
        recommendedTargetTicket: target,
      };
    }

    if (isStrongMatch) {
      reasons.push(
        'The historical match is strong enough that linking to the existing ticket should be reviewed before creating something new.',
      );
      return {
        duplicateRisk: 'high',
        recommendedAction: 'link_existing',
        recommendedActionReasoning: reasons,
        recommendedTargetTicket: target,
      };
    }

    if (strongestMatch.score >= 0.18 || strongestMatch.overlap >= 2) {
      reasons.push(
        'There is some overlap with an older ticket, so the new draft should be treated as a possible duplicate.',
      );
      return {
        duplicateRisk: 'medium',
        recommendedAction: 'link_existing',
        recommendedActionReasoning: reasons,
        recommendedTargetTicket: target,
      };
    }

    return {
      duplicateRisk: 'low',
      recommendedAction: 'create_draft',
      recommendedActionReasoning: [
        'Historical overlap is weak, so creating a fresh draft is still reasonable.',
      ],
      recommendedTargetTicket: target,
    };
  }

  private buildSimilarityReason(
    reportTokens: Set<string>,
    ticketTokens: Set<string>,
    reportTags: Set<DomainTag>,
    ticketTags: Set<DomainTag>,
  ) {
    const sharedTags = [...reportTags].filter((tag) => ticketTags.has(tag));
    if (sharedTags.length > 0) {
      return `Shared ${sharedTags.join(', ')} signals between the report and historical ticket.`;
    }

    const sharedTokens = [...reportTokens]
      .filter((token) => ticketTokens.has(token))
      .filter((token) => token.length > 3)
      .slice(0, 3);

    if (sharedTokens.length > 0) {
      return `Shared terms: ${sharedTokens.join(', ')}.`;
    }

    return 'General text overlap suggests a related issue pattern.';
  }

  private calculateConfidence(
    priorityReasons: string[],
    matchedPastTickets: HistoricalMatch[],
    ownerScore: number,
    effortReasons: string[],
  ) {
    const strongestMatchScore = matchedPastTickets[0]?.score || 0;
    const rawConfidence =
      0.42 +
      Math.min(priorityReasons.length * 0.06, 0.24) +
      Math.min(strongestMatchScore * 0.35, 0.18) +
      Math.min(ownerScore * 0.04, 0.12) +
      Math.min(effortReasons.length * 0.03, 0.06);

    let confidence = Math.min(Math.max(rawConfidence, 0.35), 0.92);

    if (strongestMatchScore < 0.45) {
      confidence = Math.min(confidence, 0.88);
    }

    if (strongestMatchScore < 0.25) {
      confidence = Math.min(confidence, 0.84);
    }

    if (ownerScore < 2) {
      confidence = Math.min(confidence, 0.8);
    }

    return Number(confidence.toFixed(2));
  }

  private extractTags(text: string): Set<DomainTag> {
    const normalized = this.normalize(text);
    const tags = new Set<DomainTag>();

    (Object.keys(DOMAIN_KEYWORDS) as DomainTag[]).forEach((tag) => {
      if (DOMAIN_KEYWORDS[tag].some((keyword) => normalized.includes(keyword))) {
        tags.add(tag);
      }
    });

    return tags;
  }

  private tokenize(text: string) {
    return this.normalize(text)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length > 2);
  }

  private normalize(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private looksLikeRegression(text: string) {
    return [
      /\bagain\b/,
      /\bafter (?:the )?(?:last|latest|recent) (?:deploy|release|update)\b/,
      /\bregression\b/,
      /\breturned\b/,
      /\bback again\b/,
    ].some((pattern) => pattern.test(text));
  }

  private countOverlap(left: Set<string>, right: Set<string>) {
    let total = 0;
    for (const value of left) {
      if (right.has(value)) {
        total += 1;
      }
    }
    return total;
  }

  private countTagOverlap(left: Set<DomainTag>, right: Set<DomainTag>) {
    let total = 0;
    for (const value of left) {
      if (right.has(value)) {
        total += 1;
      }
    }
    return total;
  }

  private uniqueReasons(reasons: string[]) {
    return [...new Set(reasons)];
  }

  private describeHistoricalMatch(match: HistoricalMatch) {
    const signals: string[] = [];

    if (match.overlap >= 4) {
      signals.push('high term overlap');
    } else if (match.overlap >= 2) {
      signals.push('shared issue wording');
    }

    if (match.tagOverlap >= 2) {
      signals.push('matching product/domain signals');
    } else if (match.tagOverlap === 1) {
      signals.push('at least one shared domain signal');
    }

    if (match.score >= 0.32) {
      signals.push('high similarity score');
    }

    if (!signals.length) {
      return 'Historical overlap suggests this may be related to existing work.';
    }

    return `Historical matching found ${signals.join(', ')} with an existing ticket.`;
  }

  private buildHybridReasoningPrompt(
    recommendations: TicketTriageRecommendation[],
    input: AnalyzeTicketTriageDto,
  ) {
    const context = {
      mode: 'hybrid',
      context: input.context ?? null,
      recommendations: recommendations.map((recommendation, index) => ({
        reportIndex: index,
        rawReport: recommendation.rawReport,
        priority: recommendation.priority,
        suggestedOwner: recommendation.suggestedOwner
          ? {
              ...recommendation.suggestedOwner,
              role:
                input.candidateOwners?.find(
                  (owner) => owner.id === recommendation.suggestedOwner?.id,
                )?.role ?? null,
              skills:
                input.candidateOwners?.find(
                  (owner) => owner.id === recommendation.suggestedOwner?.id,
                )?.skills ?? [],
            }
          : null,
        effortEstimate: recommendation.effortEstimate,
        duplicateRisk: recommendation.duplicateRisk,
        recommendedAction: recommendation.recommendedAction,
        recommendedTargetTicket: recommendation.recommendedTargetTicket,
        matchedPastTickets: recommendation.matchedPastTickets,
      })),
    };

    return [
      'You are rewriting triage reasoning for an internal issue decision engine.',
      'Do not change the decisions themselves.',
      'Do not change priority, owner, effort, duplicate risk, action, or target ticket.',
      'Only produce new explanation arrays.',
      'Use concrete details from the raw report and matched tickets.',
      'Avoid generic phrasing such as "aligns with", "provides additional context", "historical matching found", or "appears affected".',
      'Each reasoning array should contain 2 to 4 concise bullets.',
      'The wording should feel case-specific, not templated.',
      'If a matched ticket exists, mention the exact ticket title and status in the action reasoning.',
      'If the report mentions a concrete symptom like "iOS", "internal server error", "login", "checkout", or "save button", use that symptom directly.',
      'Owner reasoning should mention the selected owner by name and explain why their role/skills fit this exact issue.',
      'Priority reasoning should mention the specific blocked flow or user impact from the report.',
      'Effort reasoning should mention the likely subsystem or debugging scope, not just the size label.',
      'Return strict JSON with this shape only:',
      '{"rewrites":[{"reportIndex":0,"priorityReasoning":["..."],"ownerReasoning":["..."],"effortReasoning":["..."],"recommendedActionReasoning":["..."]}]}',
      'Context:',
      JSON.stringify(context),
    ].join('\n');
  }

  private parseReasoningRewriteResponse(
    response: string,
  ): TriageReasoningRewriteResponse {
    const cleanResponse = response
      .trim()
      .replace(/```json/gi, '')
      .replace(/```/g, '');

    const extracted = this.extractJsonObject(cleanResponse) ?? cleanResponse;
    let parsed: any;
    try {
      parsed = JSON.parse(extracted);
    } catch (error) {
      throw new Error('Invalid AI response format: expected triage reasoning JSON');
    }

    if (!parsed || !Array.isArray(parsed.rewrites)) {
      throw new Error('Invalid AI response format: rewrites array missing');
    }

    return {
      rewrites: parsed.rewrites
        .filter((item: any) => Number.isInteger(item?.reportIndex))
        .map((item: any) => ({
          reportIndex: item.reportIndex,
          priorityReasoning: this.normalizeReasoningArray(item.priorityReasoning),
          ownerReasoning: this.normalizeReasoningArray(item.ownerReasoning),
          effortReasoning: this.normalizeReasoningArray(item.effortReasoning),
          recommendedActionReasoning: this.normalizeReasoningArray(
            item.recommendedActionReasoning,
          ),
        })),
    };
  }

  private applyReasoningRewrites(
    recommendations: TicketTriageRecommendation[],
    rewrites: TriageReasoningRewrite[],
  ) {
    const rewriteMap = new Map(rewrites.map((rewrite) => [rewrite.reportIndex, rewrite]));

    return recommendations.map((recommendation, index) => {
      const rewrite = rewriteMap.get(index);
      if (!rewrite) {
        return recommendation;
      }

      return {
        ...recommendation,
        priorityReasoning:
          rewrite.priorityReasoning?.length
            ? this.uniqueReasons(rewrite.priorityReasoning)
            : recommendation.priorityReasoning,
        ownerReasoning:
          rewrite.ownerReasoning?.length
            ? this.uniqueReasons(rewrite.ownerReasoning)
            : recommendation.ownerReasoning,
        effortReasoning:
          rewrite.effortReasoning?.length
            ? this.uniqueReasons(rewrite.effortReasoning)
            : recommendation.effortReasoning,
        recommendedActionReasoning:
          rewrite.recommendedActionReasoning?.length
            ? this.uniqueReasons(rewrite.recommendedActionReasoning)
            : recommendation.recommendedActionReasoning,
      };
    });
  }

  private normalizeReasoningArray(input: unknown): string[] | undefined {
    if (!Array.isArray(input)) {
      return undefined;
    }

    const normalized = input
      .filter((value) => typeof value === 'string')
      .map((value: string) => value.trim())
      .filter(Boolean)
      .slice(0, 4);

    return normalized.length ? normalized : undefined;
  }

  private extractJsonObject(input: string) {
    const start = input.indexOf('{');
    const end = input.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }
    return input.slice(start, end + 1);
  }

  private async resolvePastTickets(
    input: AnalyzeTicketTriageDto,
    organizationId?: string,
  ): Promise<NonNullable<AnalyzeTicketTriageDto['pastTickets']>> {
    if (input.pastTickets?.length) {
      return input.pastTickets;
    }

    if (!organizationId) {
      return [];
    }

    const tickets = await this.ticketRepository.find({
      where: { organizationId },
      order: { updatedAt: 'DESC' },
      take: 25,
      relations: ['assignedTo'],
    });

    return tickets.map((ticket) => ({
      id: String(ticket.id),
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      ownerHint:
        ticket.assignedTo?.email ||
        [
          ticket.assignedTo?.firstName,
          ticket.assignedTo?.lastName,
        ]
          .filter(Boolean)
          .join(' ') ||
        undefined,
    }));
  }
}
