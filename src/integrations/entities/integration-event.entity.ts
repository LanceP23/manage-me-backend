import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity()
@Index('IDX_integration_event_org', ['organizationId'])
export class IntegrationEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  provider: string;

  @Column({ type: 'enum', enum: ['inbound', 'outbound'] })
  direction: string;

  @Column({ type: 'varchar', length: 64 })
  eventType: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  externalId: string | null;

  @Column({ type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({ type: 'enum', enum: ['received', 'processed', 'failed'] })
  status: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  normalized: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
