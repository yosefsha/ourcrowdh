import { Module } from '@nestjs/common';

/**
 * Intentionally empty. `COMPANY_REPOSITORY` (`company.repository.js`) has no
 * provider bound yet — the Seed loader issue adds
 * `{ provide: COMPANY_REPOSITORY, useClass: PostgresCompanyRepository }` to
 * `providers` and re-exports the token. Imported by `AppModule` now so the
 * module graph is already shaped the way every later issue expects.
 */
@Module({})
export class CompaniesModule {}
