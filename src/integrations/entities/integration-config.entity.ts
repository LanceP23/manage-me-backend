import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('integration_config')
@Index('IDX_integration_config_org', ['organizationId'])
@Index('IDX_integration_config_provider', ['provider'])
@Index('IDX_integration_config_repo_id', ['repoId'])
@Index('IDX_integration_config_repo_full_name', ['repoFullName'])
@Index('UQ_integration_config_org_provider_repo_id', ['organizationId', 'provider', 'repoId'], {
  unique: true,
})
@Index(
  'UQ_integration_config_org_provider_repo_full_name',
  ['organizationId', 'provider', 'repoFullName'],
  { unique: true },
)
@Index(
  'UQ_integration_config_org_provider_product',
  ['organizationId', 'provider', 'productId'],
  { unique: true },
)
export class IntegrationConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  provider: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'int', nullable: true })
  productId: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  repoId: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  repoFullName: string | null;

  @Column({ type: 'varchar', length: 512 })
  webhookSecret: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
