// Named, hierarchical query-key factories, one namespace per entity. Each
// namespace exposes an `all()` key that is a prefix of its own more specific
// keys, so invalidating `all()` invalidates every query for that entity.
// Adding a hook for a new entity means adding a new namespace here, never
// editing an existing one.
export const queryKeys = {
  companies: {
    all: () => ['companies'] as const,
    detail: (slug: string) => ['companies', slug] as const,
  },
  runs: {
    all: () => ['runs'] as const,
    list: (limit: number) => ['runs', limit] as const,
  },
};
