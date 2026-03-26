import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTicketDraftDecisionSnapshot20260326000200
  implements MigrationInterface
{
  name = 'AddTicketDraftDecisionSnapshot20260326000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const ticketDraft = await queryRunner.getTable('ticket_draft');
    const hasDecisionSnapshot =
      ticketDraft?.findColumnByName('decisionSnapshot');

    if (!hasDecisionSnapshot) {
      await queryRunner.addColumn(
        'ticket_draft',
        new TableColumn({
          name: 'decisionSnapshot',
          type: 'jsonb',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ticketDraft = await queryRunner.getTable('ticket_draft');
    const hasDecisionSnapshot =
      ticketDraft?.findColumnByName('decisionSnapshot');

    if (hasDecisionSnapshot) {
      await queryRunner.dropColumn('ticket_draft', 'decisionSnapshot');
    }
  }
}
