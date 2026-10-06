// Mirrors docs/PLAN.md#http-api verbatim. All dates are ISO-8601 strings.

export type Sentiment = 'positive' | 'negative' | 'neutral';

// ≤7d, ≤30d, ≤90d, >90d, never
export type StatusBand = 'fresh' | 'recent' | 'quiet' | 'dormant' | 'none';

export interface MentionStatusDto {
  lastMentionedAt: string | null;
  daysSinceLastMention: number | null;
  band: StatusBand;
}

export interface SentimentCountsDto {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
}

export interface CompanySummaryDto {
  slug: string;
  name: string;
  formerNames: string[];
  status: MentionStatusDto;
  quarter: SentimentCountsDto;
}

export interface QuarterDto {
  from: string;
  to: string;
}

export interface MentionDto {
  id: string;
  title: string;
  url: string;
  outlet: string;
  publishedAt: string;
  sentiment: Sentiment;
  confidence: number;
  rationale: string;
}

export type RunTrigger = 'schedule' | 'manual' | 'cli';
export type RunStatus = 'running' | 'succeeded' | 'failed';

export interface RunDto {
  id: string;
  trigger: RunTrigger;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  articlesFetched: number;
  mentionsDiscovered: number;
  mentionsClassified: number;
  classificationFailures: number;
  newMentions: number;
  error: string | null;
}

// Response envelopes — one named type per endpoint, so callers never inline
// the shape themselves.

/** GET /api/companies */
export interface CompaniesResponseDto {
  quarter: QuarterDto;
  companies: CompanySummaryDto[];
}

/** GET /api/companies/:slug */
export interface CompanyDetailResponseDto {
  quarter: QuarterDto;
  company: CompanySummaryDto;
  mentions: MentionDto[];
}

/** GET /api/runs?limit= */
export interface RunsResponseDto {
  runs: RunDto[];
}

/** GET /health */
export interface HealthResponseDto {
  status: 'ok';
}
