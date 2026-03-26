import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TicketService } from './ticket.service';
import { Ticket } from './entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { Product } from '../product/entities/Product.entity';
import { Organization } from '../organization/entities/organization.entity';

const createRepositoryMock = () => ({
  createQueryBuilder: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  save: jest.fn(),
});

describe('TicketService', () => {
  let service: TicketService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketService,
        {
          provide: getRepositoryToken(Ticket),
          useFactory: createRepositoryMock,
        },
        {
          provide: getRepositoryToken(User),
          useFactory: createRepositoryMock,
        },
        {
          provide: getRepositoryToken(Product),
          useFactory: createRepositoryMock,
        },
        {
          provide: getRepositoryToken(Organization),
          useFactory: createRepositoryMock,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TicketService>(TicketService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
