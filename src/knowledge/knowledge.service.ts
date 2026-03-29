import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { Answer } from '../answer/entities/answer.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { KnowledgeChunk } from './entities/knowledge-chunk.entity';
import { KnowledgeDocument } from './entities/knowledge-document.entity';
import { RetrieveKnowledgeDto } from './dto/retrieve-knowledge.dto';

type KnowledgeSourceType = 'ticket' | 'product_answer';

type SourceDocumentInput = {
  organizationId?: string | null;
  productId?: number | null;
  sourceType: KnowledgeSourceType;
  sourceKey: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown> | null;
};

type ChunkResult = {
  chunkIndex: number;
  content: string;
  charCount: number;
};

@Injectable()
export class KnowledgeService {
  constructor(
    @InjectRepository(KnowledgeDocument)
    private readonly knowledgeDocumentRepository: Repository<KnowledgeDocument>,
    @InjectRepository(KnowledgeChunk)
    private readonly knowledgeChunkRepository: Repository<KnowledgeChunk>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(Answer)
    private readonly answerRepository: Repository<Answer>,
  ) {}

  async backfillOrganizationKnowledge(
    organizationId: string,
    productId?: number,
  ): Promise<{
    ticketsIndexed: number;
    answersIndexed: number;
    chunksIndexed: number;
  }> {
    const where = productId ? { organizationId, product: { id: productId } } : { organizationId };
    const tickets = await this.ticketRepository.find({
      where,
      relations: ['product'],
      order: { id: 'ASC' },
    });

    const answerQuery = this.answerRepository
      .createQueryBuilder('answer')
      .leftJoinAndSelect('answer.productQuestion', 'productQuestion')
      .leftJoinAndSelect('answer.productContext', 'productContext')
      .leftJoinAndSelect('productContext.product', 'product')
      .where('product.organizationId = :organizationId', { organizationId })
      .orderBy('answer.id', 'ASC');

    if (productId) {
      answerQuery.andWhere('product.id = :productId', { productId });
    }

    const answers = await answerQuery.getMany();

    let chunkCount = 0;

    for (const ticket of tickets) {
      const result = await this.indexTicket(ticket);
      chunkCount += result.chunkCount;
    }

    for (const answer of answers) {
      const result = await this.indexAnswer(answer);
      chunkCount += result.chunkCount;
    }

    return {
      ticketsIndexed: tickets.length,
      answersIndexed: answers.length,
      chunksIndexed: chunkCount,
    };
  }

  async indexTicketById(ticketId: number, organizationId?: string): Promise<void> {
    const ticket = await this.ticketRepository.findOne({
      where: organizationId ? { id: ticketId, organizationId } : { id: ticketId },
      relations: ['product'],
    });

    if (!ticket) {
      return;
    }

    await this.indexTicket(ticket);
  }

  async indexAnswerById(answerId: number): Promise<void> {
    const answer = await this.answerRepository
      .createQueryBuilder('answer')
      .leftJoinAndSelect('answer.productQuestion', 'productQuestion')
      .leftJoinAndSelect('answer.productContext', 'productContext')
      .leftJoinAndSelect('productContext.product', 'product')
      .where('answer.id = :answerId', { answerId })
      .getOne();

    if (!answer) {
      return;
    }

    await this.indexAnswer(answer);
  }

  async removeTicketById(
    ticketId: number,
    organizationId?: string | null,
  ): Promise<void> {
    await this.removeDocumentBySource(
      organizationId ?? null,
      'ticket',
      String(ticketId),
    );
  }

  async removeAnswerById(
    answerId: number,
    organizationId?: string | null,
  ): Promise<void> {
    await this.removeDocumentBySource(
      organizationId ?? null,
      'product_answer',
      String(answerId),
    );
  }

  async retrieve(
    organizationId: string,
    input: RetrieveKnowledgeDto,
  ): Promise<{
    query: string;
    results: Array<{
      chunkId: number;
      documentId: number;
      title: string;
      sourceType: string;
      sourceKey: string;
      productId: number | null;
      score: number;
      content: string;
      metadata: Record<string, unknown> | null;
    }>;
  }> {
    const limit = this.normalizeLimit(input.limit);
    const query = input.query.trim();

    if (!query) {
      return { query, results: [] };
    }

    const documentAlias = 'document';
    const chunkAlias = 'chunk';

    const queryBuilder = this.knowledgeChunkRepository
      .createQueryBuilder(chunkAlias)
      .innerJoin(`${chunkAlias}.document`, documentAlias)
      .where(`${chunkAlias}.organizationId = :organizationId`, { organizationId });

    if (input.productId) {
      queryBuilder.andWhere(
        `(${chunkAlias}.productId = :productId OR ${chunkAlias}.productId IS NULL)`,
        { productId: input.productId },
      );
    }

    if (input.sourceTypes?.length) {
      queryBuilder.andWhere(`${documentAlias}.sourceType IN (:...sourceTypes)`, {
        sourceTypes: input.sourceTypes,
      });
    }

    queryBuilder
      .select([
        `${chunkAlias}.id AS "chunkId"`,
        `${chunkAlias}.documentId AS "documentId"`,
        `${documentAlias}.title AS "title"`,
        `${documentAlias}.sourceType AS "sourceType"`,
        `${documentAlias}.sourceKey AS "sourceKey"`,
        `${chunkAlias}.productId AS "productId"`,
        `${chunkAlias}.content AS "content"`,
        `${chunkAlias}.metadata AS "metadata"`,
      ])
      .addSelect(
        `ts_rank_cd(to_tsvector('simple', ${chunkAlias}.content), plainto_tsquery('simple', :query))`,
        'score',
      )
      .andWhere(
        `to_tsvector('simple', ${chunkAlias}.content) @@ plainto_tsquery('simple', :query)`,
        { query },
      )
      .orderBy('score', 'DESC')
      .addOrderBy(`${chunkAlias}.id`, 'ASC')
      .limit(limit);

    const rows = await queryBuilder.getRawMany<{
      chunkId: number;
      documentId: number;
      title: string;
      sourceType: string;
      sourceKey: string;
      productId: number | null;
      score: string | number;
      content: string;
      metadata: Record<string, unknown> | string | null;
    }>();

    const results = rows.map((row) => ({
      chunkId: Number(row.chunkId),
      documentId: Number(row.documentId),
      title: row.title,
      sourceType: row.sourceType,
      sourceKey: row.sourceKey,
      productId: row.productId === null ? null : Number(row.productId),
      score: Number(row.score || 0),
      content: row.content,
      metadata:
        typeof row.metadata === 'string'
          ? (JSON.parse(row.metadata) as Record<string, unknown>)
          : row.metadata,
    }));

    return {
      query,
      results,
    };
  }

  splitIntoChunks(
    text: string,
    options?: { maxChars?: number; overlapChars?: number },
  ): ChunkResult[] {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return [];
    }

    const maxChars = options?.maxChars ?? 700;
    const overlapChars = Math.min(options?.overlapChars ?? 120, maxChars / 2);
    const chunks: ChunkResult[] = [];

    let start = 0;
    let chunkIndex = 0;

    while (start < normalized.length) {
      let end = Math.min(start + maxChars, normalized.length);

      if (end < normalized.length) {
        const sentenceBreak = normalized.lastIndexOf('. ', end);
        const lineBreak = normalized.lastIndexOf(' ', end);
        const bestBreak = Math.max(sentenceBreak + 1, lineBreak);
        if (bestBreak > start + Math.floor(maxChars * 0.6)) {
          end = bestBreak;
        }
      }

      const content = normalized.slice(start, end).trim();
      if (content) {
        chunks.push({
          chunkIndex,
          content,
          charCount: content.length,
        });
        chunkIndex += 1;
      }

      if (end >= normalized.length) {
        break;
      }

      start = Math.max(end - overlapChars, start + 1);
    }

    return chunks;
  }

  private async indexTicket(
    ticket: Ticket,
  ): Promise<{ documentId: number; chunkCount: number }> {
    const title = ticket.title.trim();
    const parts = [
      `Ticket Title: ${title}`,
      `Status: ${ticket.status}`,
      `Priority: ${ticket.priority}`,
      `Description:\n${ticket.description.trim()}`,
    ];

    const document = await this.upsertSourceDocument({
      organizationId: ticket.organizationId,
      productId: ticket.product?.id ?? null,
      sourceType: 'ticket',
      sourceKey: String(ticket.id),
      title,
      content: parts.join('\n\n'),
      metadata: {
        ticketId: ticket.id,
        status: ticket.status,
        priority: ticket.priority,
      },
    });

    return {
      documentId: document.id,
      chunkCount: document.chunks.length,
    };
  }

  private async indexAnswer(
    answer: Answer,
  ): Promise<{ documentId: number; chunkCount: number }> {
    const product = answer.productContext?.product ?? null;
    const questionText = answer.productQuestion?.questionText?.trim() || 'Product question';
    const answerText = answer.answerText.trim();

    const title = product
      ? `${product.name}: ${questionText}`
      : questionText;

    const content = [`Question: ${questionText}`, `Answer:\n${answerText}`].join(
      '\n\n',
    );

    const document = await this.upsertSourceDocument({
      organizationId: product?.organizationId ?? null,
      productId: product?.id ?? null,
      sourceType: 'product_answer',
      sourceKey: String(answer.id),
      title,
      content,
      metadata: {
        answerId: answer.id,
        productContextId: answer.productContext?.id ?? null,
        productQuestionId: answer.productQuestion?.id ?? null,
      },
    });

    return {
      documentId: document.id,
      chunkCount: document.chunks.length,
    };
  }

  private async upsertSourceDocument(
    input: SourceDocumentInput,
  ): Promise<KnowledgeDocument> {
    const content = input.content.trim();
    const title = input.title.trim();
    const contentHash = createHash('sha256')
      .update(`${title}\n${content}`)
      .digest('hex');

    let document = await this.knowledgeDocumentRepository.findOne({
      where: {
        organizationId: input.organizationId ?? IsNull(),
        sourceType: input.sourceType,
        sourceKey: input.sourceKey,
      },
      relations: ['chunks'],
    });

    if (!document) {
      document = this.knowledgeDocumentRepository.create({
        organizationId: input.organizationId ?? null,
        productId: input.productId ?? null,
        sourceType: input.sourceType,
        sourceKey: input.sourceKey,
        title,
        content,
        contentHash,
        metadata: input.metadata ?? null,
      });
    } else if (document.contentHash === contentHash) {
      return document;
    } else {
      document.title = title;
      document.content = content;
      document.contentHash = contentHash;
      document.productId = input.productId ?? null;
      document.metadata = input.metadata ?? null;
    }

    document = await this.knowledgeDocumentRepository.save(document);

    await this.knowledgeChunkRepository.delete({
      documentId: document.id,
    });

    const chunks = this.splitIntoChunks(content).map((chunk) =>
      this.knowledgeChunkRepository.create({
        documentId: document.id,
        organizationId: input.organizationId ?? null,
        productId: input.productId ?? null,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        charCount: chunk.charCount,
        metadata: input.metadata ?? null,
      }),
    );

    document.chunks = chunks.length
      ? await this.knowledgeChunkRepository.save(chunks)
      : [];

    return document;
  }

  private async removeDocumentBySource(
    organizationId: string | null,
    sourceType: KnowledgeSourceType,
    sourceKey: string,
  ): Promise<void> {
    const document = await this.knowledgeDocumentRepository.findOne({
      where: {
        organizationId: organizationId ?? IsNull(),
        sourceType,
        sourceKey,
      },
    });

    if (!document) {
      return;
    }

    await this.knowledgeDocumentRepository.remove(document);
  }

  private normalizeLimit(limit?: number): number {
    if (!Number.isFinite(limit)) {
      return 5;
    }

    return Math.min(Math.max(Math.floor(limit as number), 1), 20);
  }
}
