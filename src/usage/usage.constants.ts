export const USAGE_PLAN_SLUGS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
};

export type UsageLimitKey =
  | 'aiPrompts'
  | 'ticketDrafts'
  | 'agentActions'
  | 'commitLinks'
  | 'integrationDrafts'
  | 'triageAnalyses';

export const DEFAULT_USAGE_LIMITS: Record<
  string,
  Partial<Record<UsageLimitKey, number>>
> = {
  [USAGE_PLAN_SLUGS.FREE]: {
    aiPrompts: 200,
    ticketDrafts: 200,
    agentActions: 50,
    commitLinks: 200,
    integrationDrafts: 200,
    triageAnalyses: 100,
  },
  [USAGE_PLAN_SLUGS.PRO]: {
    aiPrompts: 2000,
    ticketDrafts: 2000,
    agentActions: 500,
    commitLinks: 2000,
    integrationDrafts: 2000,
    triageAnalyses: 1000,
  },
  [USAGE_PLAN_SLUGS.ENTERPRISE]: {
    aiPrompts: 0,
    ticketDrafts: 0,
    agentActions: 0,
    commitLinks: 0,
    integrationDrafts: 0,
    triageAnalyses: 0,
  },
};
