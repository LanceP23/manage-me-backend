import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTriageUsage20260326000100 implements MigrationInterface {
  name = 'AddTriageUsage20260326000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "usage_event_kind_enum" ADD VALUE IF NOT EXISTS 'triage_analysis'`,
    );

    const usageMonthly = await queryRunner.getTable('usage_monthly');
    const hasTriageAnalyses = usageMonthly?.findColumnByName('triageAnalyses');
    if (!hasTriageAnalyses) {
      await queryRunner.addColumn(
        'usage_monthly',
        new TableColumn({
          name: 'triageAnalyses',
          type: 'int',
          default: 0,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const usageMonthly = await queryRunner.getTable('usage_monthly');
    const hasTriageAnalyses = usageMonthly?.findColumnByName('triageAnalyses');
    if (hasTriageAnalyses) {
      await queryRunner.dropColumn('usage_monthly', 'triageAnalyses');
    }
  }
}
