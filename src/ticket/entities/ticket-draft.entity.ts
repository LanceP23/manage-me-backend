import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../product/entities/Product.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity()
export class TicketDraft {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: ['todo', 'in_progress', 'done', 'cancelled'],
    default: 'todo',
  })
  status: string;

  @Column({
    type: 'enum',
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  })
  priority: string;

  @Column({
    type: 'enum',
    enum: ['draft', 'approved', 'rejected'],
    default: 'draft',
  })
  approvalStatus: string;

  @Column({ type: 'varchar', length: 32 })
  source: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  aiProvider: string | null;

  @Column({ type: 'float', nullable: true })
  confidence: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  rawInputHash: string | null;

  @Column({ type: 'jsonb', nullable: true })
  decisionSnapshot: Record<string, unknown> | null;

  @Column({ type: 'int', nullable: true })
  approvedTicketId: number | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date | null;

  @ManyToOne(() => User, { nullable: true })
  approvedBy: User | null;

  @ManyToOne(() => User, { nullable: true })
  rejectedBy: User | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  assignedTo: User | null;

  @ManyToOne(() => Product, { nullable: true })
  product: Product | null;

  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null;

  @ManyToOne(() => Organization, { nullable: true })
  organization: Organization | null;
}
