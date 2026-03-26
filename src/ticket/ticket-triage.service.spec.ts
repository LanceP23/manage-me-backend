import { TicketTriageService } from './ticket-triage.service';

describe('TicketTriageService', () => {
  let service: TicketTriageService;
  let ticketRepository: { find: jest.Mock };
  let aiProviderService: { getProvider: jest.Mock };
  let aiEvaluationLogService: { logSuccess: jest.Mock; logFailure: jest.Mock };
  let aiAgent: { providerName: string; context: string; generateResponse: jest.Mock };

  beforeEach(() => {
    ticketRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    aiAgent = {
      providerName: 'test-provider',
      context: 'test-context',
      generateResponse: jest.fn(),
    };
    aiProviderService = {
      getProvider: jest.fn().mockReturnValue(aiAgent),
    };
    aiEvaluationLogService = {
      logSuccess: jest.fn().mockResolvedValue(undefined),
      logFailure: jest.fn().mockResolvedValue(undefined),
    };
    service = new TicketTriageService(
      ticketRepository as any,
      aiProviderService as any,
      aiEvaluationLogService as any,
    );
  });

  it('marks a production checkout failure as high priority with a backend owner suggestion', async () => {
    const result = await service.analyze({
      rawReports: [
        'Customers cannot complete checkout in production because payment fails after card entry.',
      ],
      pastTickets: [
        {
          id: '101',
          title: 'Stripe timeout during checkout',
          description: 'Intermittent payment failures in production',
          priority: 'high',
          ownerHint: 'backend',
        },
      ],
      candidateOwners: [
        {
          id: 'user-1',
          name: 'Alice',
          role: 'backend',
          skills: ['payments', 'api'],
        },
        {
          id: 'user-2',
          name: 'Mark',
          role: 'frontend',
          skills: ['ui', 'copy'],
        },
      ],
      context: {
        productArea: 'checkout',
        environment: 'production',
      },
    });

    expect(result.summary.highestPriority).toBe('high');
    expect(result.recommendations[0].priority).toBe('high');
    expect(result.recommendations[0].matchedPastTickets).toHaveLength(1);
    expect(result.recommendations[0].suggestedOwner).toEqual({
      id: 'user-1',
      name: 'Alice',
    });
    expect(result.recommendations[0].effortEstimate).toBe('large');
    expect(result.recommendations[0].recommendedAction).toBe('link_existing');
    expect(result.recommendations[0].duplicateRisk).toBe('high');
  });

  it('keeps cosmetic reports low priority and small effort', async () => {
    const result = await service.analyze({
      rawReports: ['There is a typo in the dashboard header text on the profile page.'],
      candidateOwners: [
        {
          id: 'user-2',
          name: 'Mark',
          role: 'frontend',
          skills: ['ui', 'copy'],
        },
      ],
    });

    expect(result.recommendations[0].priority).toBe('low');
    expect(result.recommendations[0].effortEstimate).toBe('small');
    expect(result.recommendations[0].matchedPastTickets).toHaveLength(0);
    expect(result.recommendations[0].recommendedAction).toBe('create_draft');
  });

  it('recommends merging when a strong matching ticket is already in progress', async () => {
    const result = await service.analyze({
      rawReports: ['Login is failing again in production with the same internal server error for multiple users.'],
      pastTickets: [
        {
          id: '44',
          title: 'Login not working',
          description: 'login gives error message internal server error.',
          priority: 'high',
          status: 'in_progress',
          ownerHint: 'backend',
        },
      ],
      candidateOwners: [
        {
          id: 'user-1',
          name: 'Alice',
          role: 'backend',
          skills: ['auth', 'api'],
        },
      ],
      context: {
        productArea: 'authentication',
        environment: 'production',
      },
    });

    expect(result.recommendations[0].recommendedAction).toBe('merge_into_existing');
    expect(result.recommendations[0].duplicateRisk).toBe('high');
    expect(result.recommendations[0].recommendedTargetTicket).toEqual({
      id: '44',
      title: 'Login not working',
      status: 'in_progress',
    });
  });

  it('uses recent org tickets automatically when request history is omitted', async () => {
    ticketRepository.find.mockResolvedValue([
      {
        id: 44,
        title: 'Login not working',
        description: 'login gives error message internal server error.',
        priority: 'high',
        status: 'in_progress',
        assignedTo: null,
      },
    ]);

    const result = await service.analyze(
      {
        rawReports: ['Login is failing again in production with the same internal server error for multiple users.'],
        candidateOwners: [
          {
            id: 'user-1',
            name: 'Alice',
            role: 'backend',
            skills: ['auth', 'api'],
          },
        ],
        context: {
          productArea: 'authentication',
          environment: 'production',
        },
      },
      'org-1',
    );

    expect(ticketRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
        take: 25,
      }),
    );
    expect(result.recommendations[0].matchedPastTickets[0]?.id).toBe('44');
  });

  it('rewrites reasoning in hybrid mode when the AI provider succeeds', async () => {
    aiAgent.generateResponse.mockResolvedValue(
      JSON.stringify({
        rewrites: [
          {
            reportIndex: 0,
            priorityReasoning: [
              'Login failures in production block account access for active users.',
            ],
            ownerReasoning: [
              'The issue points to authentication and backend handling, which aligns with Alice.',
            ],
            effortReasoning: [
              'This likely needs backend debugging across auth flow and production behavior.',
            ],
            recommendedActionReasoning: [
              'The wording and production symptoms closely match the in-progress login incident.',
            ],
          },
        ],
      }),
    );

    const result = await service.analyze({
      mode: 'hybrid',
      rawReports: ['Login is failing again in production with the same internal server error for multiple users.'],
      pastTickets: [
        {
          id: '44',
          title: 'Login not working',
          description: 'login gives error message internal server error.',
          priority: 'high',
          status: 'in_progress',
          ownerHint: 'backend',
        },
      ],
      candidateOwners: [
        {
          id: 'user-1',
          name: 'Alice',
          role: 'backend',
          skills: ['auth', 'api'],
        },
      ],
      context: {
        productArea: 'authentication',
        environment: 'production',
      },
    });

    expect(result.summary.mode).toBe('hybrid');
    expect(result.summary.reasoningSource).toBe('llm_rewritten');
    expect(result.recommendations[0].priorityReasoning[0]).toContain(
      'block account access',
    );
    expect(aiEvaluationLogService.logSuccess).toHaveBeenCalled();
  });

  it('falls back to heuristic reasoning in hybrid mode if the AI rewrite fails', async () => {
    aiAgent.generateResponse.mockRejectedValue(new Error('provider unavailable'));

    const result = await service.analyze({
      mode: 'hybrid',
      rawReports: ['There is a typo in the dashboard header text on the profile page.'],
      candidateOwners: [
        {
          id: 'user-2',
          name: 'Mark',
          role: 'frontend',
          skills: ['ui', 'copy'],
        },
      ],
    });

    expect(result.summary.mode).toBe('hybrid');
    expect(result.summary.reasoningSource).toBe('heuristic_fallback');
    expect(result.recommendations[0].priorityReasoning[0]).toContain(
      'cosmetic or content-related',
    );
    expect(aiEvaluationLogService.logFailure).toHaveBeenCalled();
  });

  it('uses full AI triage output in ai_only mode when the provider succeeds', async () => {
    aiAgent.generateResponse.mockResolvedValue(
      JSON.stringify({
        recommendations: [
          {
            rawReport:
              'Login is failing again in production with the same internal server error for multiple users.',
            priority: 'high',
            priorityReasoning: [
              'Multiple users cannot sign in, so account access is blocked.',
            ],
            suggestedOwner: {
              id: 'user-1',
              name: 'Alice',
            },
            ownerReasoning: [
              'Alice owns backend auth work and the report points to server-side login failures.',
            ],
            effortEstimate: 'large',
            effortReasoning: [
              'This likely requires production auth debugging across API and login flow behavior.',
            ],
            duplicateRisk: 'high',
            recommendedAction: 'merge_into_existing',
            recommendedActionReasoning: [
              'The in-progress login ticket matches the same internal server error pattern.',
            ],
            recommendedTargetTicket: {
              id: '44',
              title: 'Login not working',
              status: 'in_progress',
            },
            matchedPastTickets: [
              {
                id: '44',
                title: 'Login not working',
                status: 'in_progress',
                similarityReason:
                  'Both reports describe the same internal server error during login.',
              },
            ],
            confidence: 0.91,
          },
        ],
      }),
    );

    const result = await service.analyze({
      mode: 'ai_only',
      rawReports: ['Login is failing again in production with the same internal server error for multiple users.'],
      pastTickets: [
        {
          id: '44',
          title: 'Login not working',
          description: 'login gives error message internal server error.',
          priority: 'high',
          status: 'in_progress',
          ownerHint: 'backend',
        },
      ],
      candidateOwners: [
        {
          id: 'user-1',
          name: 'Alice',
          role: 'backend',
          skills: ['auth', 'api'],
        },
      ],
      context: {
        productArea: 'authentication',
        environment: 'production',
      },
    });

    expect(result.summary.mode).toBe('ai_only');
    expect(result.summary.reasoningSource).toBe('ai_full');
    expect(result.recommendations[0].recommendedAction).toBe('merge_into_existing');
    expect(result.recommendations[0].ownerReasoning[0]).toContain('Alice');
    expect(aiEvaluationLogService.logSuccess).toHaveBeenCalled();
  });
});
