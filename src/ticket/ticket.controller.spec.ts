import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { AiTicketService } from './ai-ticket.service';
import { TicketDraftService } from './ticket-draft.service';
import { TicketCommitLinkService } from './ticket-commit-link.service';
import { TicketIngestService } from './ticket-ingest.service';
import { UsageService } from '../usage/usage.service';
import { TicketTriageService } from './ticket-triage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgGuard } from '../organization/guards/org.guard';

describe('TicketController', () => {
  let controller: TicketController;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [TicketController],
      providers: [
        {
          provide: TicketService,
          useValue: {},
        },
        {
          provide: AiTicketService,
          useValue: {},
        },
        {
          provide: TicketDraftService,
          useValue: {},
        },
        {
          provide: TicketCommitLinkService,
          useValue: {},
        },
        {
          provide: TicketIngestService,
          useValue: {},
        },
        {
          provide: TicketTriageService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: {},
        },
        {
          provide: UsageService,
          useValue: {},
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(OrgGuard)
      .useValue({ canActivate: jest.fn(() => true) });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<TicketController>(TicketController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
