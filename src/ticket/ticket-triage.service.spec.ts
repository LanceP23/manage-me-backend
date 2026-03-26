import { TicketTriageService } from './ticket-triage.service';

describe('TicketTriageService', () => {
  let service: TicketTriageService;

  beforeEach(() => {
    service = new TicketTriageService();
  });

  it('marks a production checkout failure as high priority with a backend owner suggestion', () => {
    const result = service.analyze({
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

  it('keeps cosmetic reports low priority and small effort', () => {
    const result = service.analyze({
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

  it('recommends merging when a strong matching ticket is already in progress', () => {
    const result = service.analyze({
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
});
