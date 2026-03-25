import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AgentActionService } from './agent-action.service';
import { AgentActionLog } from './entities/agent-action-log.entity';
import { TicketService } from '../ticket/ticket.service';
import { IntegrationsService } from '../integrations/integrations.service';

const createRepositoryMock = () => ({
  save: jest.fn(),
});

describe('AgentActionService', () => {
  let service: AgentActionService;
  let repo: Repository<AgentActionLog>;
  let ticketService: TicketService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentActionService,
        {
          provide: getRepositoryToken(AgentActionLog),
          useFactory: createRepositoryMock,
        },
        {
          provide: TicketService,
          useValue: {
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: IntegrationsService,
          useValue: {
            handleSlackOutbound: jest.fn(),
            handleMattermostOutbound: jest.fn(),
            handleOpenProjectOutbound: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AgentActionService);
    repo = moduleRef.get(getRepositoryToken(AgentActionLog));
    ticketService = moduleRef.get(TicketService);
  });

  it('returns dry-run results without executing handlers', async () => {
    (repo.save as jest.Mock)
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 1 });

    const response = await service.executeActions(
      {
        dryRun: true,
        actions: [
          {
            type: 'create_ticket',
            payload: { title: 'Test', description: 'Desc' },
          },
        ],
      },
      'user-1',
      'org-1',
    );

    expect(response.dryRun).toBe(true);
    expect(response.results[0].status).toBe('executed');
    expect((ticketService.create as jest.Mock).mock.calls.length).toBe(0);
  });
});
