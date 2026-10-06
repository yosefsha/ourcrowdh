/**
 * Context terms added to the Google News query (`query-builder.ts`) for
 * Tracked Company names that collide with a common word or a better-known
 * entity. Used only when the company has no `disambiguator` of its own —
 * see `buildGoogleNewsQuery`. Keyed by name, lowercased, so the lookup is
 * case-insensitive the way a name match naturally is.
 */
const SEARCH_OVERRIDES: ReadonlyMap<string, string> = new Map<string, string>([
  // Hurricane Harvey and other Harvey-named storms dominate plain results.
  ['harvey', 'startup'],
  // "Island" collides with geography, travel and real-estate coverage.
  ['island', 'startup'],
  // "Silo" collides with grain-storage reporting and the Apple TV+ series.
  ['silo', 'startup'],
  // "Bites" collides with food and restaurant-review coverage.
  ['bites', 'startup'],
  // "Rewire" collides with generic electrical and home-renovation articles.
  ['rewire', 'startup'],
  // "Glean" collides with agricultural/harvesting usage of the word.
  ['glean', 'startup'],
  // "Groq" is frequently confused with "Grok", xAI's chatbot.
  ['groq', 'chip'],
  // "Ukko" collides with the Finnish mythological sky god.
  ['ukko', 'startup'],
  // "Lambda" collides with the Greek letter, AWS Lambda and math notation.
  ['lambda', 'startup'],
  // "SSI" collides with Social Security Income and other acronym usage.
  ['ssi', 'startup'],
]);

/**
 * The context term to add to a Google News query for a colliding company
 * name, or `null` when the name has no recorded collision.
 */
export function searchOverrideFor(name: string): string | null {
  return SEARCH_OVERRIDES.get(name.toLowerCase()) ?? null;
}
