import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Ticket } from './entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { Product } from '../product/entities/Product.entity';
import { ConfigService } from '@nestjs/config';
import { EscalateSlaDto } from './dto/escalate-sla.dto';
import { Organization } from '../organization/entities/organization.entity';
import { KnowledgeService } from '../knowledge/knowledge.service';

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket)
    private ticketRepository: Repository<Ticket>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private readonly configService: ConfigService,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  async create(createTicketDto: CreateTicketDto, organizationId?: string) {
    const ticket = new Ticket();
    ticket.title = createTicketDto.title;
    ticket.description = createTicketDto.description;
    ticket.status = createTicketDto.status || 'todo';
    ticket.priority = createTicketDto.priority || 'medium';

    if (organizationId) {
      const organization = await this.organizationRepository.findOne({
        where: { id: organizationId },
      });
      if (!organization) {
        throw new NotFoundException(
          `Organization with ID ${organizationId} not found`,
        );
      }
      ticket.organization = organization;
      ticket.organizationId = organization.id;
    }

    const product = await this.productRepository.findOne({
      where: { id: createTicketDto.productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${createTicketDto.productId} not found`);
    }
    if (organizationId && product.organizationId !== organizationId) {
      throw new BadRequestException('Product does not belong to this organization');
    }
    ticket.product = product;

    if (createTicketDto.assignedToId) {
      const user = await this.userRepository.findOne({
        where: { id: createTicketDto.assignedToId },
      });
      if (user) {
        ticket.assignedTo = user;
      }
    }

    const savedTicket = await this.ticketRepository.save(ticket);
    await this.knowledgeService.indexTicketById(savedTicket.id, organizationId);
    return savedTicket;
  }

  async findAll(organizationId?: string) {
    const where = organizationId ? { organizationId } : {};
    return await this.ticketRepository.find({
      where,
      relations: ['assignedTo', 'product', 'organization'],
    });
  }

  async findOne(id: number, organizationId?: string) {
    const ticket = await this.ticketRepository.findOne({
      where: organizationId ? { id, organizationId } : { id },
      relations: ['assignedTo', 'product', 'organization'],
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }
    return ticket;
  }

  async update(id: number, updateTicketDto: UpdateTicketDto, organizationId?: string) {
    const ticket = await this.ticketRepository.findOne({
      where: organizationId ? { id, organizationId } : { id },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    // Check if any updates are provided
    const hasUpdates = Object.keys(updateTicketDto).length > 0;
    
    if (!hasUpdates) {
      // No updates provided, return the ticket as is
      return ticket;
    }

    if (updateTicketDto.title !== undefined) {
      ticket.title = updateTicketDto.title;
    }
    if (updateTicketDto.description !== undefined) {
      ticket.description = updateTicketDto.description;
    }
    if (updateTicketDto.status !== undefined) {
      ticket.status = updateTicketDto.status;
    }
    if (updateTicketDto.priority !== undefined) {
      ticket.priority = updateTicketDto.priority;
    }

    if (updateTicketDto.productId !== undefined) {
      if (updateTicketDto.productId === null) {
        ticket.product = null;
      } else {
        const product = await this.productRepository.findOne({
          where: { id: updateTicketDto.productId },
        });
        if (product) {
          if (organizationId && product.organizationId !== organizationId) {
            throw new BadRequestException('Product does not belong to this organization');
          }
          ticket.product = product;
        }
      }
    }

    if (updateTicketDto.assignedToId !== undefined) {
      if (updateTicketDto.assignedToId === null) {
        ticket.assignedTo = null;
      } else {
        const user = await this.userRepository.findOne({
          where: { id: updateTicketDto.assignedToId },
        });
        if (user) {
          ticket.assignedTo = user;
        }
      }
    }

    const savedTicket = await this.ticketRepository.save(ticket);
    await this.knowledgeService.indexTicketById(savedTicket.id, organizationId);
    return savedTicket;
  }

  async remove(id: number, organizationId?: string) {
    const ticket = await this.ticketRepository.findOne({
      where: organizationId ? { id, organizationId } : { id },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }
    await this.knowledgeService.removeTicketById(ticket.id, ticket.organizationId || organizationId);
    return await this.ticketRepository.remove(ticket);
  }

  async escalateStaleTickets(input: EscalateSlaDto, organizationId?: string) {
    const days = this.normalizeDays(input.days);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const statusOverride =
      input.status || this.configService.get<string>('SLA_ESCALATE_STATUS') || null;
    const priorityOverride =
      input.priority ||
      this.configService.get<string>('SLA_ESCALATE_PRIORITY') ||
      null;
    const staleStatuses = this.getStaleStatuses();

    if (!statusOverride && !priorityOverride) {
      return {
        updated: 0,
        message: 'No SLA escalation action configured',
        cutoff,
      };
    }

    const update: Partial<Ticket> & { updatedAt?: any } = {};
    if (statusOverride) {
      update.status = statusOverride;
    }
    if (priorityOverride) {
      update.priority = priorityOverride;
    }
    update.updatedAt = () => 'CURRENT_TIMESTAMP';

    const query = this.ticketRepository
      .createQueryBuilder()
      .update(Ticket)
      .set(update)
      .where('status IN (:...statuses)', { statuses: staleStatuses })
      .andWhere('updatedAt < :cutoff', { cutoff });

    if (organizationId) {
      query.andWhere('organizationId = :organizationId', { organizationId });
    }

    const result = await query.execute();

    return {
      updated: result.affected || 0,
      cutoff,
      status: statusOverride,
      priority: priorityOverride,
      staleStatuses,
      organizationId: organizationId || null,
    };
  }

  private normalizeDays(input?: number): number {
    if (Number.isFinite(input) && (input as number) >= 1) {
      return Math.floor(input as number);
    }
    const raw = this.configService.get<string>('SLA_STALE_DAYS');
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed) && parsed >= 1) {
      return Math.floor(parsed);
    }
    return 7;
  }

  private getStaleStatuses(): string[] {
    const raw =
      this.configService.get<string>('SLA_STALE_STATUSES') ||
      'todo,in_progress';
    const normalized = raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    return normalized.length ? normalized : ['todo', 'in_progress'];
  }
}
