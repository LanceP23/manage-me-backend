import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Product } from '../../product/entities/Product.entity';
import { KnowledgeDocument } from './knowledge-document.entity';

@Entity()
@Unique('UQ_knowledge_chunk_document_index', ['documentId', 'chunkIndex'])
export class KnowledgeChunk {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  documentId: number;

  @ManyToOne(() => KnowledgeDocument, (document) => document.chunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'documentId' })
  document: KnowledgeDocument;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  organizationId: string | null;

  @Column({ nullable: true })
  @Index()
  productId: number | null;

  @ManyToOne(() => Product, { nullable: true })
  product: Product | null;

  @Column()
  chunkIndex: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'int' })
  charCount: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
