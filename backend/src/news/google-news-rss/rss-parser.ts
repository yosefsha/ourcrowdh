import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { FetchedArticle, NewsSourceError } from '../news-source.js';

/** Provenance recorded on every Article this adapter produces. */
const SOURCE_PROVENANCE = 'google-news-rss';

interface RawRssDocument {
  readonly rss?: { readonly channel?: { readonly item?: unknown } };
}

interface RawRssItem {
  readonly title?: unknown;
  readonly link?: unknown;
  readonly pubDate?: unknown;
  readonly source?: unknown;
}

// `parseTagValue: false` keeps every tag as a string — otherwise a title or
// outlet that looks numeric (e.g. "007", "1.50") is coerced to a number and
// silently corrupted when re-stringified.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
});

/**
 * Parses a Google News RSS search response into `FetchedArticle[]`
 * (`docs/PLAN.md#news-source-isolation`). Pure — no I/O. Every failure,
 * whether the XML itself is malformed or an item is missing a field the
 * domain requires, surfaces as `NewsSourceError`; nothing else may cross
 * this boundary.
 */
export function parseGoogleNewsRss(xml: string): readonly FetchedArticle[] {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new NewsSourceError(`Malformed Google News RSS response: ${validation.err.msg}`);
  }

  const document = parser.parse(xml) as RawRssDocument;
  return rawItems(document.rss?.channel?.item).map(parseItem);
}

function rawItems(item: unknown): readonly RawRssItem[] {
  if (Array.isArray(item)) {
    return item as RawRssItem[];
  }
  if (item === undefined || item === null) {
    return [];
  }
  return [item];
}

function parseItem(item: RawRssItem): FetchedArticle {
  const link = textValue(item.link);
  const pubDate = textValue(item.pubDate);
  const outlet = outletValue(item.source);
  const rawTitle = textValue(item.title);

  if (!link || !pubDate || !outlet || !rawTitle) {
    throw new NewsSourceError(
      'Google News RSS item is missing a required field (title, link, pubDate or source)',
    );
  }

  const publishedAt = new Date(pubDate);
  if (Number.isNaN(publishedAt.getTime())) {
    throw new NewsSourceError(`Google News RSS item has an unparsable pubDate: "${pubDate}"`);
  }

  return {
    url: link,
    title: stripOutletSuffix(rawTitle, outlet),
    outlet,
    publishedAt,
    source: SOURCE_PROVENANCE,
  };
}

/** `<title>Headline - Outlet</title>` → `Headline`, once the outlet (from `<source>`) is known. */
function stripOutletSuffix(title: string, outlet: string): string {
  const suffix = ` - ${outlet}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}

function textValue(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
}

/** `<source url="...">Outlet</source>` parses as `{ '#text': 'Outlet', '@_url': '...' }`. */
function outletValue(value: unknown): string | null {
  const direct = textValue(value);
  if (direct) {
    return direct;
  }
  if (typeof value === 'object' && value !== null && '#text' in value) {
    return textValue((value as { '#text'?: unknown })['#text']);
  }
  return null;
}
