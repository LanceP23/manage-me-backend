import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type UsageEventKind =
  | 'ai_prompt'
  | 'ticket_draft'
  | 'agent_action'
  | 'commit_link'
  | 'integration_draft'
  | 'triage_analysis';

@Entity()
@Index(['organizationId', 'kind', 'createdAt'])
export class UsageEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({
    type: 'enum',
    enum: [
      'ai_prompt',
      'ticket_draft',
      'agent_action',
      'commit_link',
      'integration_draft',
      'triage_analysis',
    ],
  })
  kind: UsageEventKind;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}
