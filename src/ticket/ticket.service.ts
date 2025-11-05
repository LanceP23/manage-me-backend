import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Ticket } from './entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { Product } from '../product/entities/Product.entity';

@Injectable()
export class TicketService {
  constructor(
    @InjectRepository(Ticket)
    private ticketRepository: Repository<Ticket>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async create(createTicketDto: CreateTicketDto) {
    const ticket = new Ticket();
    ticket.title = createTicketDto.title;
    ticket.description = createTicketDto.description;
    ticket.status = createTicketDto.status || 'todo';
    ticket.priority = createTicketDto.priority || 'medium';

    const product = await this.productRepository.findOne({
      where: { id: createTicketDto.productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${createTicketDto.productId} not found`);
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

    return await this.ticketRepository.save(ticket);
  }

  async findAll() {
    return await this.ticketRepository.find({
      relations: ['assignedTo', 'product'],
    });
  }

  async findOne(id: number) {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      relations: ['assignedTo', 'product'],
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }
    return ticket;
  }

  async update(id: number, updateTicketDto: UpdateTicketDto) {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
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

    return await this.ticketRepository.save(ticket);
  }

  async remove(id: number) {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }
    return await this.ticketRepository.remove(ticket);
  }
}