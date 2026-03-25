import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddOrgToAiEvaluationLog20260201000200
  implements MigrationInterface
{
  name = 'AddOrgToAiEvaluationLog20260201000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumnIfMissing(
      queryRunner,
      'ai_evaluation_log',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await this.addForeignKeyIfMissing(
      queryRunner,
      'ai_evaluation_log',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organization',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await this.addIndexIfMissing(
      queryRunner,
      'ai_evaluation_log',
      new TableIndex({
        name: 'IDX_ai_evaluation_log_org',
        columnNames: ['organizationId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropIndexIfExists(
      queryRunner,
      'ai_evaluation_log',
      'IDX_ai_evaluation_log_org',
    );

    await this.dropForeignKeyByColumn(
      queryRunner,
      'ai_evaluation_log',
      'organizationId',
    );

    await this.dropColumnIfExists(
      queryRunner,
      'ai_evaluation_log',
      'organizationId',
    );
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    column: TableColumn,
  ) {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return;
    }
    const exists = table.columns.find((col) => col.name === column.name);
    if (!exists) {
      await queryRunner.addColumn(tableName, column);
    }
  }

  private async dropColumnIfExists(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ) {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return;
    }
    const exists = table.columns.find((col) => col.name === columnName);
    if (exists) {
      await queryRunner.dropColumn(tableName, columnName);
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
}
