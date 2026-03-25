import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddOrganizationsAndOrgScopes20260131000100
  implements MigrationInterface
{
  name = 'AddOrganizationsAndOrgScopes20260131000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasOrganization = await queryRunner.hasTable('organization');
    if (!hasOrganization) {
      await queryRunner.createTable(
        new Table({
          name: 'organization',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'name',
              type: 'varchar',
              length: '120',
              isNullable: false,
            },
            {
              name: 'slug',
              type: 'varchar',
              length: '120',
              isNullable: false,
              isUnique: true,
            },
            {
              name: 'isActive',
              type: 'boolean',
              default: true,
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

    const hasOrgMember = await queryRunner.hasTable('organization_member');
    if (!hasOrgMember) {
      await queryRunner.createTable(
        new Table({
          name: 'organization_member',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'role',
              type: 'enum',
              enum: ['owner', 'admin', 'member', 'viewer'],
              default: `'member'`,
            },
            {
              name: 'organizationId',
              type: 'uuid',
              isNullable: false,
            },
            {
              name: 'userId',
              type: 'uuid',
              isNullable: false,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'now()',
            },
          ],
          indices: [
            new TableIndex({
              name: 'IDX_org_member_unique',
              columnNames: ['organizationId', 'userId'],
              isUnique: true,
            }),
          ],
        }),
      );
    }

    await this.addColumnIfMissing(
      queryRunner,
      'product',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'ticket',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'ticket_draft',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'commit_link',
      new TableColumn({
        name: 'organizationId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await this.addForeignKeyIfMissing(
      queryRunner,
      'product',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organization',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      'ticket',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organization',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      'ticket_draft',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organization',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
    await this.addForeignKeyIfMissing(
      queryRunner,
      'commit_link',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organization',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    if (await queryRunner.hasTable('organization_member')) {
      await this.addForeignKeyIfMissing(
        queryRunner,
        'organization_member',
        new TableForeignKey({
          columnNames: ['organizationId'],
          referencedTableName: 'organization',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
      await this.addForeignKeyIfMissing(
        queryRunner,
        'organization_member',
        new TableForeignKey({
          columnNames: ['userId'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropForeignKeyByColumn(queryRunner, 'commit_link', 'organizationId');
    await this.dropForeignKeyByColumn(queryRunner, 'ticket_draft', 'organizationId');
    await this.dropForeignKeyByColumn(queryRunner, 'ticket', 'organizationId');
    await this.dropForeignKeyByColumn(queryRunner, 'product', 'organizationId');
    await this.dropForeignKeyByColumn(
      queryRunner,
      'organization_member',
      'organizationId',
    );
    await this.dropForeignKeyByColumn(queryRunner, 'organization_member', 'userId');

    await this.dropColumnIfExists(queryRunner, 'commit_link', 'organizationId');
    await this.dropColumnIfExists(queryRunner, 'ticket_draft', 'organizationId');
    await this.dropColumnIfExists(queryRunner, 'ticket', 'organizationId');
    await this.dropColumnIfExists(queryRunner, 'product', 'organizationId');

    if (await queryRunner.hasTable('organization_member')) {
      await queryRunner.dropTable('organization_member');
    }
    if (await queryRunner.hasTable('organization')) {
      await queryRunner.dropTable('organization');
    }

    await queryRunner.query(
      'DROP TYPE IF EXISTS "organization_member_role_enum"',
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
}
