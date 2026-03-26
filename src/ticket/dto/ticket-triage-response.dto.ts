import {
  AnalyzeTicketTriageDto,
  TriageCandidateOwnerDto,
  TriagePastTicketDto,
} from './analyze-ticket-triage.dto';

export type TriagePriority = 'low' | 'medium' | 'high';
export type TriageEffort = 'small' | 'medium' | 'large';
export type TriageDuplicateRisk = 'low' | 'medium' | 'high';
export type TriageRecommendedAction =
  | 'create_draft'
  | 'link_existing'
  | 'merge_into_existing'
  | 'reopen_existing';

export type TicketTriageSuggestedOwner = Pick<
  TriageCandidateOwnerDto,
  'id' | 'name'
> | null;

export type TicketTriageMatchedPastTicket = Pick<
  TriagePastTicketDto,
  'id' | 'title' | 'status'
> & {
  similarityReason: string;
};

export type TicketTriageActionTarget = Pick<
  TriagePastTicketDto,
  'id' | 'title' | 'status'
> | null;

export type TicketTriageRecommendation = {
  rawReport: string;
  priority: TriagePriority;
  priorityReasoning: string[];
  suggestedOwner: TicketTriageSuggestedOwner;
  ownerReasoning: string[];
  effortEstimate: TriageEffort;
  effortReasoning: string[];
  duplicateRisk: TriageDuplicateRisk;
  recommendedAction: TriageRecommendedAction;
  recommendedActionReasoning: string[];
  recommendedTargetTicket: TicketTriageActionTarget;
  matchedPastTickets: TicketTriageMatchedPastTicket[];
  confidence: number;
};

export type TicketTriageAnalysisResponseDto = {
  summary: {
    reportCount: number;
    highestPriority: TriagePriority;
  };
  recommendations: TicketTriageRecommendation[];
};

export type TicketTriageAnalysisInput = AnalyzeTicketTriageDto;
