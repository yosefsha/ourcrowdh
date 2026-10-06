import { InMemoryCompanyRepository } from './in-memory-company.repository.js';

describe('InMemoryCompanyRepository', () => {
  it('upserts new seed entries and assigns each an id', async () => {
    const repository = new InMemoryCompanyRepository();

    await repository.upsertAll([
      { slug: 'lifeward', name: 'Lifeward', formerNames: ['ReWalk'], disambiguator: null },
      { slug: 'lambda', name: 'Lambda', formerNames: [], disambiguator: 'lambda.ai' },
    ]);

    const companies = await repository.findAll();

    expect(companies).toHaveLength(2);
    const lifeward = companies.find((company) => company.slug === 'lifeward');
    expect(lifeward).toMatchObject({
      slug: 'lifeward',
      name: 'Lifeward',
      formerNames: ['ReWalk'],
      disambiguator: null,
    });
    expect(typeof lifeward?.id).toBe('string');
    expect(lifeward?.id.length).toBeGreaterThan(0);
  });

  it('re-seeding the same slug updates the record in place and keeps its id', async () => {
    const repository = new InMemoryCompanyRepository();

    await repository.upsertAll([
      { slug: 'lambda', name: 'Lambda', formerNames: [], disambiguator: 'lambda.ai' },
    ]);
    const [firstPass] = await repository.findAll();

    await repository.upsertAll([
      { slug: 'lambda', name: 'Lambda Labs', formerNames: ['Lambda'], disambiguator: 'lambda.ai' },
    ]);
    const companies = await repository.findAll();

    expect(companies).toHaveLength(1);
    expect(companies[0]).toMatchObject({
      id: firstPass.id,
      name: 'Lambda Labs',
      formerNames: ['Lambda'],
    });
  });

  it('findAll on an empty repository returns an empty list, not an error', async () => {
    const repository = new InMemoryCompanyRepository();

    await expect(repository.findAll()).resolves.toEqual([]);
  });
});
