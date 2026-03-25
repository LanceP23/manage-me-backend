import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddAgentActionLog20260201000300 implements MigrationInterface {
  name = 'AddAgentActionLog20260201000300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('agent_action_log');
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: 'agent_action_log',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'actionType',
              type: 'varchar',
              length: '64',
            },
            {
              name: 'status',
              type: 'enum',
              enum: ['received', 'executed', 'skipped', 'failed'],
            },
            {
              name: 'dryRun',
              type: 'boolean',
              default: false,
            },
            {
              name: 'input',
              type: 'jsonb',
            },
            {
              name: 'result',
              type: 'jsonb',
              isNullable: true,
            },
            {
              name: 'errorMessage',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'decision',
              type: 'jsonb',
              isNullable: true,
            },
            {
              name: 'organizationId',
              type: 'uuid',
              isNullable: true,
            },
            {
              name: 'userId',
              type: 'uuid',
              isNullable: true,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'now()'
            },
          ],
        }),
      );
    }

    await this.addForeignKeyIfMissing(
      queryRunner,
      'agent_action_log',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organization',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await this.addIndexIfMissing(
      queryRunner,
      'agent_action_log',
      new TableIndex({
        name: 'IDX_agent_action_log_org',
        columnNames: ['organizationId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropIndexIfExists(
      queryRunner,
      'agent_action_log',
      'IDX_agent_action_log_org',
    );

    await this.dropForeignKeyByColumn(
      queryRunner,
      'agent_action_log',
      'organizationId',
    );

    const table = await queryRunner.getTable('agent_action_log');
    if (table) {
      await queryRunner.dropTable('agent_action_log');
    }

    await queryRunner.query(
      'DROP TYPE IF EXISTS "agent_action_log_status_enum"',
    );
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
