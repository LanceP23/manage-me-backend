import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class AddKnowledgeBase20260330000100 implements MigrationInterface {
  name = 'AddKnowledgeBase20260330000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'knowledge_document',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'organizationId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'productId',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'sourceType',
            type: 'varchar',
          },
          {
            name: 'sourceKey',
            type: 'varchar',
          },
          {
            name: 'title',
            type: 'varchar',
          },
          {
            name: 'content',
            type: 'text',
          },
          {
            name: 'contentHash',
            type: 'varchar',
            length: '64',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'knowledge_document',
      new TableForeignKey({
        columnNames: ['productId'],
        referencedTableName: 'product',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createUniqueConstraint(
      'knowledge_document',
      new TableUnique({
        name: 'UQ_knowledge_document_org_source',
        columnNames: ['organizationId', 'sourceType', 'sourceKey'],
      }),
    );

    await queryRunner.createIndex(
      'knowledge_document',
      new TableIndex({
        name: 'IDX_knowledge_document_org',
        columnNames: ['organizationId'],
      }),
    );

    await queryRunner.createIndex(
      'knowledge_document',
      new TableIndex({
        name: 'IDX_knowledge_document_product',
        columnNames: ['productId'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'knowledge_chunk',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'documentId',
            type: 'integer',
          },
          {
            name: 'organizationId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'productId',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'chunkIndex',
            type: 'integer',
          },
          {
            name: 'content',
            type: 'text',
          },
          {
            name: 'charCount',
            type: 'integer',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'knowledge_chunk',
      new TableForeignKey({
        columnNames: ['documentId'],
        referencedTableName: 'knowledge_document',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'knowledge_chunk',
      new TableForeignKey({
        columnNames: ['productId'],
        referencedTableName: 'product',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createUniqueConstraint(
      'knowledge_chunk',
      new TableUnique({
        name: 'UQ_knowledge_chunk_document_index',
        columnNames: ['documentId', 'chunkIndex'],
      }),
    );

    await queryRunner.createIndex(
      'knowledge_chunk',
      new TableIndex({
        name: 'IDX_knowledge_chunk_org',
        columnNames: ['organizationId'],
      }),
    );

    await queryRunner.createIndex(
      'knowledge_chunk',
      new TableIndex({
        name: 'IDX_knowledge_chunk_product',
        columnNames: ['productId'],
      }),
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_chunk_content_tsv" ON "knowledge_chunk" USING GIN (to_tsvector('simple', content))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_chunk_content_tsv"`);
    await queryRunner.dropTable('knowledge_chunk', true);
    await queryRunner.dropTable('knowledge_document', true);
  }
}
