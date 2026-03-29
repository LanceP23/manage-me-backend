import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from '../../product/entities/Product.entity';
import { KnowledgeChunk } from './knowledge-chunk.entity';

@Entity()
@Unique('UQ_knowledge_document_org_source', [
  'organizationId',
  'sourceType',
  'sourceKey',
])
export class KnowledgeDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  organizationId: string | null;

  @Column({ nullable: true })
  @Index()
  productId: number | null;

  @ManyToOne(() => Product, { nullable: true })
  product: Product | null;

  @Column()
  sourceType: string;

  @Column()
  sourceKey: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ length: 64 })
  contentHash: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => KnowledgeChunk, (chunk) => chunk.document, {
    cascade: ['insert', 'update'],
  })
  chunks: KnowledgeChunk[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
