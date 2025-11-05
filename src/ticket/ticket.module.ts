// src/ticket/ticket.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { Ticket } from './entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { Product } from '../product/entities/Product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, User, Product])],
  controllers: [TicketController],
  providers: [TicketService],
})
export class TicketModule {}