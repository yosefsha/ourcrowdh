import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1791301974385 implements MigrationInterface {
  name = 'InitialSchema1791301974385';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."run_trigger" AS ENUM('schedule', 'manual', 'cli')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."run_status" AS ENUM('running', 'succeeded', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trigger" "public"."run_trigger" NOT NULL, "status" "public"."run_status" NOT NULL DEFAULT 'running', "started_at" TIMESTAMP WITH TIME ZONE NOT NULL, "finished_at" TIMESTAMP WITH TIME ZONE, "articles_fetched" integer NOT NULL DEFAULT '0', "mentions_discovered" integer NOT NULL DEFAULT '0', "mentions_classified" integer NOT NULL DEFAULT '0', "classification_failures" integer NOT NULL DEFAULT '0', "new_mentions" integer NOT NULL DEFAULT '0', "error" text, CONSTRAINT "PK_46d6a1e257c38ba58f1a3c30836" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "companies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" text NOT NULL, "name" text NOT NULL, "former_names" text array NOT NULL DEFAULT '{}', "disambiguator" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_b28b07d25e4324eee577de5496d" UNIQUE ("slug"), CONSTRAINT "PK_d4bc3e82a314fa9e29f652c2c22" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "articles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "url" text NOT NULL, "title" text NOT NULL, "outlet" text NOT NULL, "source" text NOT NULL, "published_at" TIMESTAMP WITH TIME ZONE NOT NULL, "first_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "UQ_143e4ae40220e82a7829dee20e7" UNIQUE ("url"), CONSTRAINT "PK_0a6e2c450d83e0b6052c2793334" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6f7a13d016a867d93e90bcb1b6" ON "articles" ("published_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."mention_classification_status" AS ENUM('pending', 'classified', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."mention_sentiment" AS ENUM('positive', 'negative', 'neutral')`,
    );
    await queryRunner.query(
      `CREATE TABLE "mentions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "article_id" uuid NOT NULL, "company_id" uuid NOT NULL, "first_seen_run_id" uuid NOT NULL, "classification_status" "public"."mention_classification_status" NOT NULL DEFAULT 'pending', "relevant" boolean, "sentiment" "public"."mention_sentiment", "confidence" real, "rationale" text, "model" text, "classified_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_af17b9badbaf4d012bffda1c9df" UNIQUE ("article_id", "company_id"), CONSTRAINT "CHK_8e2ae226f4ba590e70def46f97" CHECK ((COALESCE(relevant, false) = (sentiment IS NOT NULL))), CONSTRAINT "CHK_52998de8fe78dc0b9d9f84189c" CHECK ((classification_status = 'classified') = (relevant IS NOT NULL)), CONSTRAINT "PK_2c728c4685beaa7be19e11eae42" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b597a8be6d53d7836f176b50b2" ON "mentions" ("article_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0509437da40a3130ec0af6f529" ON "mentions" ("company_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "mentions" ADD CONSTRAINT "FK_b597a8be6d53d7836f176b50b29" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "mentions" ADD CONSTRAINT "FK_0509437da40a3130ec0af6f5299" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "mentions" ADD CONSTRAINT "FK_196d07f3c0c95a07e957aa14c66" FOREIGN KEY ("first_seen_run_id") REFERENCES "runs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "mentions" DROP CONSTRAINT "FK_196d07f3c0c95a07e957aa14c66"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mentions" DROP CONSTRAINT "FK_0509437da40a3130ec0af6f5299"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mentions" DROP CONSTRAINT "FK_b597a8be6d53d7836f176b50b29"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_0509437da40a3130ec0af6f529"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b597a8be6d53d7836f176b50b2"`);
    await queryRunner.query(`DROP TABLE "mentions"`);
    await queryRunner.query(`DROP TYPE "public"."mention_sentiment"`);
    await queryRunner.query(`DROP TYPE "public"."mention_classification_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_6f7a13d016a867d93e90bcb1b6"`);
    await queryRunner.query(`DROP TABLE "articles"`);
    await queryRunner.query(`DROP TABLE "companies"`);
    await queryRunner.query(`DROP TABLE "runs"`);
    await queryRunner.query(`DROP TYPE "public"."run_status"`);
    await queryRunner.query(`DROP TYPE "public"."run_trigger"`);
  }
}
