import { searchOverrideFor } from './search-overrides.js';

describe('searchOverrideFor', () => {
  it('returns the recorded context term for a known colliding name, case-insensitively', () => {
    expect(searchOverrideFor('Harvey')).toBe('startup');
    expect(searchOverrideFor('GROQ')).toBe('chip');
  });

  it('returns null for a name with no recorded collision', () => {
    expect(searchOverrideFor('Acme Corp')).toBeNull();
  });
});
