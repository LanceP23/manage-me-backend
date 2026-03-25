import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity()
@Index(['organizationId', 'monthKey'], { unique: true })
export class UsageMonthly {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: 7 })
  monthKey: string;

  @Column({ type: 'int', default: 0 })
  aiPrompts: number;

  @Column({ type: 'int', default: 0 })
  ticketDrafts: number;

  @Column({ type: 'int', default: 0 })
  agentActions: number;

  @Column({ type: 'int', default: 0 })
  commitLinks: number;

  @Column({ type: 'int', default: 0 })
  integrationDrafts: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
