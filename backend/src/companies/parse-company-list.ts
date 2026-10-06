import { SeedEntry } from './company.js';

/**
 * Raised by `parseCompanyList` when the company list itself is malformed —
 * a duplicate slug/name, or a line that parses to an empty name. Thrown
 * synchronously, before anything is written, so a bad file never partially
 * seeds the database.
 */
export class InvalidCompanyListError extends Error {}

// Matches the two patterns the issue names: "(formerly X)" and
// "(formerly known as X)" — case-insensitive, whatever is left of the
// trailing paren becomes the one former name.
const FORMERLY_PATTERN = /^formerly(?:\s+known\s+as)?\s+(.+)$/i;

// A trailing " (...)" group, captured separately from the name that
// precedes it. `[^()]*` keeps this from matching across nested parens,
// which the company list never has, rather than over-matching greedily.
const TRAILING_PARENTHETICAL = /^(.*\S)\s+\(([^()]*)\)$/;

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface ParsedLine {
  readonly name: string;
  readonly formerNames: readonly string[];
  readonly disambiguator: string | null;
}

function parseLine(line: string): ParsedLine {
  const match = TRAILING_PARENTHETICAL.exec(line);
  if (!match) {
    return { name: line, formerNames: [], disambiguator: null };
  }

  const [, baseName, inner] = match;
  const formerly = FORMERLY_PATTERN.exec(inner.trim());
  if (formerly) {
    return { name: baseName.trim(), formerNames: [formerly[1].trim()], disambiguator: null };
  }

  return { name: baseName.trim(), formerNames: [], disambiguator: inner.trim() };
}

/**
 * Parses the company list (`COMPANIES_FILE` / `backend/seed/companies.txt`,
 * one company per line) into `SeedEntry[]` — the shape `CompanyRepository.upsertAll`
 * expects. Pure: no file I/O, no database access, so every pattern below is
 * covered by a plain unit test.
 *
 * - Strips a leading UTF-8 BOM and normalizes CRLF/CR/LF line endings.
 * - Trims each line and ignores blank ones.
 * - `Name (formerly X)` / `Name (formerly known as X)` → `formerNames: ['X']`.
 * - Any other trailing parenthetical (`Lambda (lambda.ai)`,
 *   `SSI (Safe Superintelligence)`) → `disambiguator`.
 * - `slug` is the kebab-case of the name. A duplicate slug or a duplicate
 *   name anywhere in the file throws `InvalidCompanyListError` naming the
 *   line — the caller must not silently drop or merge either case.
 */
export function parseCompanyList(text: string): SeedEntry[] {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = withoutBom.split(/\r\n|\r|\n/);

  const entries: SeedEntry[] = [];
  const slugLines = new Map<string, number>();
  const nameLines = new Map<string, number>();

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line.length === 0) {
      return;
    }

    const lineNumber = index + 1;
    const { name, formerNames, disambiguator } = parseLine(line);
    const slug = toSlug(name);

    if (slug.length === 0) {
      throw new InvalidCompanyListError(
        `Line ${lineNumber}: company name is empty after parsing ("${rawLine}")`,
      );
    }

    const nameKey = name.toLowerCase();
    const firstSlugLine = slugLines.get(slug);
    if (firstSlugLine !== undefined) {
      throw new InvalidCompanyListError(
        `Line ${lineNumber}: duplicate company slug "${slug}" (first seen on line ${firstSlugLine})`,
      );
    }
    const firstNameLine = nameLines.get(nameKey);
    if (firstNameLine !== undefined) {
      throw new InvalidCompanyListError(
        `Line ${lineNumber}: duplicate company name "${name}" (first seen on line ${firstNameLine})`,
      );
    }
    slugLines.set(slug, lineNumber);
    nameLines.set(nameKey, lineNumber);

    entries.push({ slug, name, formerNames, disambiguator });
  });

  return entries;
}
