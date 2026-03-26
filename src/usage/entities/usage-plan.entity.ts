import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity()
@Index(['slug'], { unique: true })
export class UsagePlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'json' })
  limits: {
    aiPrompts?: number;
    ticketDrafts?: number;
    agentActions?: number;
    commitLinks?: number;
    integrationDrafts?: number;
    triageAnalyses?: number;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
