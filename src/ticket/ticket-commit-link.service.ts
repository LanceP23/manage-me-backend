import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CommitLink } from './entities/commit-link.entity';
import { Ticket } from './entities/ticket.entity';
import { SaveCommitLinkDto } from './dto/save-commit-link.dto';

@Injectable()
export class TicketCommitLinkService {
  constructor(
    @InjectRepository(CommitLink)
    private readonly commitLinkRepository: Repository<CommitLink>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async createLink(input: SaveCommitLinkDto, organizationId?: string) {
    return this.dataSource.transaction(async (manager) => {
      const ticket = await manager.findOne(Ticket, {
        where: organizationId
          ? { id: input.ticketId, organizationId }
          : { id: input.ticketId },
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${input.ticketId} not found`);
      }

      const existing = await manager.findOne(CommitLink, {
        where: { commitSha: input.commitSha, ticket: { id: input.ticketId } },
        relations: ['ticket'],
      });

      if (existing) {
        throw new BadRequestException(
          `Commit ${input.commitSha} is already linked to ticket ${input.ticketId}`,
        );
      }

      if (input.updateTicketStatus) {
        ticket.status = input.updateTicketStatus;
        await manager.save(Ticket, ticket);
      }

      const link = new CommitLink();
      link.commitSha = input.commitSha;
      link.commitMessage = input.commitMessage;
      link.repoUrl = input.repoUrl || null;
      link.diffSummary = input.diffSummary || null;
      link.confidence = input.confidence;
      link.rationale = input.rationale || null;
      link.organizationId = ticket.organizationId || null;
      link.ticket = ticket;

      return manager.save(CommitLink, link);
    });
  }

  async findByTicketId(ticketId: number) {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
    }

    return this.commitLinkRepository.find({
      where: { ticket: { id: ticketId } },
      relations: ['ticket'],
      order: { createdAt: 'DESC' },
    });
  }
}
