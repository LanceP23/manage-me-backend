import { Injectable } from '@nestjs/common';
import { AnalyzeTicketTriageDto } from './dto/analyze-ticket-triage.dto';
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
  analyze(
    input: AnalyzeTicketTriageDto,
    _organizationId?: string,
  ): TicketTriageAnalysisResponseDto {
    const recommendations = input.rawReports.map((rawReport) =>
      this.analyzeReport(rawReport, input),
    );

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
      },
      recommendations,
    };
  }

  private analyzeReport(
    rawReport: string,
    input: AnalyzeTicketTriageDto,
  ): TicketTriageRecommendation {
    const report = rawReport.trim();
    const contextText = this.buildContextText(input);
    const enrichedText = `${report} ${contextText}`.trim();
    const reportTags = this.extractTags(enrichedText);
    const matchedPastTickets = this.matchPastTickets(
      enrichedText,
      input.pastTickets || [],
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
      strongestMatch.score >= 0.5
        ? 'A strong historical match suggests the team may already be tracking the same issue.'
        : 'A moderate historical match suggests this issue may overlap with existing work.',
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
}
