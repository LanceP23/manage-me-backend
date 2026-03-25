import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { Ticket } from './ticket.entity';
import { Organization } from '../../organization/entities/organization.entity';

@Entity()
@Unique(['commitSha', 'ticket'])
export class CommitLink {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 64 })
  commitSha: string;

  @Column({ type: 'text' })
  commitMessage: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  repoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  diffSummary: string | null;

  @Column({ type: 'float' })
  confidence: number;

  @Column({ type: 'text', nullable: true })
  rationale: string | null;

  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Ticket, { nullable: false })
  ticket: Ticket;

  @ManyToOne(() => Organization, { nullable: true })
  organization: Organization | null;
}
