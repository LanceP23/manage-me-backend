import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddOrgScopesToIntegrations20260201000100
  implements MigrationInterface
{
  name = 'AddOrgScopesToIntegrations20260201000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumnIfMissing(
      queryRunner,
      'integration_event',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'ticket_external_link',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await this.addForeignKeyIfMissing(
      queryRunner,
      'integration_event',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organization',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await this.addForeignKeyIfMissing(
      queryRunner,
      'ticket_external_link',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organization',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await this.addIndexIfMissing(
      queryRunner,
      'integration_event',
      new TableIndex({
        name: 'IDX_integration_event_org',
        columnNames: ['organizationId'],
      }),
    );

    await this.addIndexIfMissing(
      queryRunner,
      'ticket_external_link',
      new TableIndex({
        name: 'IDX_ticket_external_link_org',
        columnNames: ['organizationId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropIndexIfExists(
      queryRunner,
      'ticket_external_link',
      'IDX_ticket_external_link_org',
    );
    await this.dropIndexIfExists(
      queryRunner,
      'integration_event',
      'IDX_integration_event_org',
    );

    await this.dropForeignKeyByColumn(
      queryRunner,
      'ticket_external_link',
      'organizationId',
    );
    await this.dropForeignKeyByColumn(
      queryRunner,
      'integration_event',
      'organizationId',
    );

    await this.dropColumnIfExists(
      queryRunner,
      'ticket_external_link',
      'organizationId',
    );
    await this.dropColumnIfExists(
      queryRunner,
      'integration_event',
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
