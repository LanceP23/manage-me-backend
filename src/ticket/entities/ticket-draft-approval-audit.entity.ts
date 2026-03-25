import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { TicketDraft } from './ticket-draft.entity';
import { Ticket } from './ticket.entity';
import { User } from '../../users/entities/user.entity';

@Entity()
export class TicketDraftApprovalAudit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: ['approved', 'auto_approved', 'rejected'],
  })
  action: string;

  @Column({ type: 'jsonb', nullable: true })
  overrides: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @ManyToOne(() => TicketDraft, { onDelete: 'CASCADE' })
  draft: TicketDraft;

  @ManyToOne(() => Ticket, { nullable: true, onDelete: 'SET NULL' })
  approvedTicket: Ticket | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  actor: User | null;

  @CreateDateColumn()
  createdAt: Date;
}
