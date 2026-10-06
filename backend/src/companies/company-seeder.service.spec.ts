import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration.js';
import { CompanySeeder } from './company-seeder.service.js';
import { InMemoryCompanyRepository } from './in-memory-company.repository.js';
import { InvalidCompanyListError } from './parse-company-list.js';

function configServiceFor(companiesFile: string): ConfigService<AppConfig, true> {
  const fake: Pick<ConfigService<AppConfig, true>, 'get'> = {
    get: (key: keyof AppConfig) => {
      if (key !== 'companiesFile') {
        throw new Error(`Unexpected config key requested in test: ${key}`);
      }
      return companiesFile as never;
    },
  };
  return fake as ConfigService<AppConfig, true>;
}

describe('CompanySeeder', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'company-seeder-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('parses the configured file and upserts every entry', async () => {
    const path = join(dir, 'companies.txt');
    writeFileSync(path, 'Stripe\nLambda (lambda.ai)\nLudeo (formerly Edge)\n');
    const repository = new InMemoryCompanyRepository();
    const seeder = new CompanySeeder(repository, configServiceFor(path));

    const count = await seeder.seed();

    expect(count).toBe(3);
    const companies = await repository.findAll();
    expect(companies).toHaveLength(3);
    expect(companies.find((company) => company.slug === 'ludeo')).toMatchObject({
      formerNames: ['Edge'],
    });
  });

  it('re-seeding the same file twice leaves the same row count', async () => {
    const path = join(dir, 'companies.txt');
    writeFileSync(path, 'Stripe\nAnthropic\n');
    const repository = new InMemoryCompanyRepository();
    const seeder = new CompanySeeder(repository, configServiceFor(path));

    await seeder.seed();
    await seeder.seed();

    await expect(repository.findAll()).resolves.toHaveLength(2);
  });

  it('fails loudly, naming the path, when the file does not exist', async () => {
    const path = join(dir, 'does-not-exist.txt');
    const repository = new InMemoryCompanyRepository();
    const seeder = new CompanySeeder(repository, configServiceFor(path));

    await expect(seeder.seed()).rejects.toThrow(new RegExp(path.replace(/\\/g, '\\\\')));
  });

  it('propagates a malformed company list as InvalidCompanyListError without writing anything', async () => {
    const path = join(dir, 'companies.txt');
    writeFileSync(path, 'Stripe\nStripe\n');
    const repository = new InMemoryCompanyRepository();
    const seeder = new CompanySeeder(repository, configServiceFor(path));

    await expect(seeder.seed()).rejects.toThrow(InvalidCompanyListError);
    await expect(repository.findAll()).resolves.toEqual([]);
  });
});
