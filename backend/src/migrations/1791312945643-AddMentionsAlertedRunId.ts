import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMentionsAlertedRunId1791312945643 implements MigrationInterface {
  name = 'AddMentionsAlertedRunId1791312945643';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "mentions" ADD "alerted_run_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_mentions_unalerted_article" ON "mentions" ("article_id") WHERE relevant AND alerted_run_id IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "mentions" ADD CONSTRAINT "FK_0ab3e46ccbff001c2d08c9e619f" FOREIGN KEY ("alerted_run_id") REFERENCES "runs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mentions" DROP CONSTRAINT "FK_0ab3e46ccbff001c2d08c9e619f"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_mentions_unalerted_article"`);
    await queryRunner.query(`ALTER TABLE "mentions" DROP COLUMN "alerted_run_id"`);
  }
}
