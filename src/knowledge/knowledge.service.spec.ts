import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Answer } from '../answer/entities/answer.entity';
import { Product } from '../product/entities/Product.entity';
import { ProductContext } from '../product-context/entities/ProductContext.entity';
import { ProductQuestion } from '../product-question/entities/product-question.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { KnowledgeChunk } from './entities/knowledge-chunk.entity';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { KnowledgeService } from './knowledge.service';

const createRepositoryMock = () => ({
  create: jest.fn((input) => input),
  delete: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let knowledgeChunkRepository: Repository<KnowledgeChunk>;
  let answerRepository: Repository<Answer>;
  let ticketRepository: Repository<Ticket>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        {
          provide: getRepositoryToken(KnowledgeDocument),
          useFactory: createRepositoryMock,
        },
        {
          provide: getRepositoryToken(KnowledgeChunk),
          useFactory: createRepositoryMock,
        },
        {
          provide: getRepositoryToken(Ticket),
          useFactory: createRepositoryMock,
        },
        {
          provide: getRepositoryToken(Answer),
          useFactory: createRepositoryMock,
        },
        {
          provide: getRepositoryToken(ProductContext),
          useFactory: createRepositoryMock,
        },
        {
          provide: getRepositoryToken(ProductQuestion),
          useFactory: createRepositoryMock,
        },
        {
          provide: getRepositoryToken(Product),
          useFactory: createRepositoryMock,
        },
      ],
    }).compile();

    service = moduleRef.get(KnowledgeService);
    knowledgeChunkRepository = moduleRef.get(getRepositoryToken(KnowledgeChunk));
    answerRepository = moduleRef.get(getRepositoryToken(Answer));
    ticketRepository = moduleRef.get(getRepositoryToken(Ticket));
  });

  it('splits long text into ordered overlapping chunks', () => {
    const text = Array.from({ length: 50 }, (_, index) => `Sentence ${index}.`).join(' ');

    const chunks = service.splitIntoChunks(text, {
      maxChars: 120,
      overlapChars: 20,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks.at(-1)?.chunkIndex).toBe(chunks.length - 1);
    expect(chunks.every((chunk) => chunk.content.length <= 120)).toBe(true);
  });

  it('returns no retrieval results for blank queries', async () => {
    const result = await service.retrieve('org-1', {
      query: '   ',
      limit: 10,
    });

    expect(result.results).toEqual([]);
    expect(knowledgeChunkRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('backfills tickets and answers for one organization', async () => {
    (ticketRepository.find as jest.Mock).mockResolvedValue([
      { id: 1, organizationId: 'org-1', product: { id: 10 } },
    ]);

    const answerQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 2 }]),
    };
    (answerRepository.createQueryBuilder as jest.Mock).mockReturnValue(
      answerQueryBuilder,
    );

    jest
      .spyOn<any, any>(service as any, 'indexTicket')
      .mockResolvedValue({ documentId: 11, chunkCount: 2 });
    jest
      .spyOn<any, any>(service as any, 'indexAnswer')
      .mockResolvedValue({ documentId: 12, chunkCount: 3 });

    const result = await service.backfillOrganizationKnowledge('org-1');

    expect(result).toEqual({
      ticketsIndexed: 1,
      answersIndexed: 1,
      chunksIndexed: 5,
    });
    expect(ticketRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1' },
      }),
    );
    expect(answerRepository.createQueryBuilder).toHaveBeenCalledWith('answer');
  });
});
