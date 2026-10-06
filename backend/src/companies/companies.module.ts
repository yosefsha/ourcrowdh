import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyEntity } from './company.entity.js';
import { COMPANY_REPOSITORY } from './company.repository.js';
import { CompanySeeder } from './company-seeder.service.js';
import { PostgresCompanyRepository } from './repositories/postgres-company.repository.js';

/**
 * Binds `COMPANY_REPOSITORY` (`company.repository.js`) to the Postgres
 * implementation and provides `CompanySeeder`. Imported by `AppModule` (so
 * the HTTP app's DI graph has the token available, even though nothing
 * HTTP-facing resolves it yet) and by `CompaniesCliModule` (so `cli seed`
 * can run `CompanySeeder`).
 *
 * `SeedCommand` deliberately lives in `CompaniesCliModule`, not here:
 * `nest-commander` is a CommonJS package that `require()`s `@nestjs/common`
 * directly, which only resolves under plain Node (which supports
 * `require(esm)` natively) — not under Jest's `--experimental-vm-modules`
 * runner. Keeping it out of `CompaniesModule` keeps `nest-commander` out of
 * `AppModule`'s import graph, so the HTTP app and its e2e specs never load it.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CompanyEntity])],
  providers: [{ provide: COMPANY_REPOSITORY, useClass: PostgresCompanyRepository }, CompanySeeder],
  exports: [COMPANY_REPOSITORY, CompanySeeder],
})
export class CompaniesModule {}
