import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddIntegrationConfig20260208000100 implements MigrationInterface {
  name = 'AddIntegrationConfig20260208000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('integration_config');
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: 'integration_config',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'provider',
              type: 'varchar',
              length: '32',
            },
            {
              name: 'organizationId',
              type: 'uuid',
            },
            {
              name: 'productId',
              type: 'int',
              isNullable: true,
            },
            {
              name: 'repoId',
              type: 'varchar',
              length: '64',
              isNullable: true,
            },
            {
              name: 'repoFullName',
              type: 'varchar',
              length: '256',
              isNullable: true,
            },
            {
              name: 'webhookSecret',
              type: 'varchar',
              length: '512',
            },
            {
              name: 'metadata',
              type: 'jsonb',
              isNullable: true,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'now()',
            },
            {
              name: 'updatedAt',
              type: 'timestamp',
              default: 'now()',
            },
          ],
        }),
      );
    }

    await this.addForeignKeyIfMissing(
      queryRunner,
      'integration_config',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organization',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await this.addForeignKeyIfMissing(
      queryRunner,
      'integration_config',
      new TableForeignKey({
        columnNames: ['productId'],
        referencedTableName: 'product',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await this.addIndexIfMissing(
      queryRunner,
      'integration_config',
      new TableIndex({
        name: 'IDX_integration_config_org',
        columnNames: ['organizationId'],
      }),
    );

    await this.addIndexIfMissing(
      queryRunner,
      'integration_config',
      new TableIndex({
        name: 'IDX_integration_config_provider',
        columnNames: ['provider'],
      }),
    );

    await this.addIndexIfMissing(
      queryRunner,
      'integration_config',
      new TableIndex({
        name: 'IDX_integration_config_repo_id',
        columnNames: ['repoId'],
      }),
    );

    await this.addIndexIfMissing(
      queryRunner,
      'integration_config',
      new TableIndex({
        name: 'IDX_integration_config_repo_full_name',
        columnNames: ['repoFullName'],
      }),
    );

    await this.addIndexIfMissing(
      queryRunner,
      'integration_config',
      new TableIndex({
        name: 'UQ_integration_config_org_provider_repo_id',
        columnNames: ['organizationId', 'provider', 'repoId'],
        isUnique: true,
      }),
    );

    await this.addIndexIfMissing(
      queryRunner,
      'integration_config',
      new TableIndex({
        name: 'UQ_integration_config_org_provider_repo_full_name',
        columnNames: ['organizationId', 'provider', 'repoFullName'],
        isUnique: true,
      }),
    );

    await this.addIndexIfMissing(
      queryRunner,
      'integration_config',
      new TableIndex({
        name: 'UQ_integration_config_org_provider_product',
        columnNames: ['organizationId', 'provider', 'productId'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropIndexIfExists(
      queryRunner,
      'integration_config',
      'UQ_integration_config_org_provider_product',
    );
    await this.dropIndexIfExists(
      queryRunner,
      'integration_config',
      'UQ_integration_config_org_provider_repo_full_name',
    );
    await this.dropIndexIfExists(
      queryRunner,
      'integration_config',
      'UQ_integration_config_org_provider_repo_id',
    );
    await this.dropIndexIfExists(
      queryRunner,
      'integration_config',
      'IDX_integration_config_repo_full_name',
    );
    await this.dropIndexIfExists(
      queryRunner,
      'integration_config',
      'IDX_integration_config_repo_id',
    );
    await this.dropIndexIfExists(
      queryRunner,
      'integration_config',
      'IDX_integration_config_provider',
    );
    await this.dropIndexIfExists(
      queryRunner,
      'integration_config',
      'IDX_integration_config_org',
    );

    await this.dropForeignKeyByColumn(
      queryRunner,
      'integration_config',
      'productId',
    );
    await this.dropForeignKeyByColumn(
      queryRunner,
      'integration_config',
      'organizationId',
    );

    const table = await queryRunner.getTable('integration_config');
    if (table) {
      await queryRunner.dropTable('integration_config');
    }
  }

  private async addForeignKeyIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    foreignKey: TableForeignKey,
  ) {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return;
    }
    const exists = table.foreignKeys.find((fk) => {
      return (
        fk.columnNames.join(',') === foreignKey.columnNames.join(',') &&
        fk.referencedTableName === foreignKey.referencedTableName
      );
    });
    if (!exists) {
      await queryRunner.createForeignKey(tableName, foreignKey);
    }
  }

  private async addIndexIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    index: TableIndex,
  ) {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return;
    }
    const exists = table.indices.find((idx) => idx.name === index.name);
    if (!exists) {
      await queryRunner.createIndex(tableName, index);
    }
  }

  private async dropIndexIfExists(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ) {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return;
    }
    const exists = table.indices.find((idx) => idx.name === indexName);
    if (exists) {
      await queryRunner.dropIndex(tableName, indexName);
    }
  }

  private async dropForeignKeyByColumn(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ) {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return;
    }
    const fk = table.foreignKeys.find((key) =>
      key.columnNames.includes(columnName),
    );
    if (fk) {
      await queryRunner.dropForeignKey(tableName, fk);
    }
  }
}
