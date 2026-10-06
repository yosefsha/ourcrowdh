import type {
  CompaniesResponseDto,
  CompanyDetailResponseDto,
  CompanySummaryDto,
  RunDto,
  RunsResponseDto,
} from '../types';

const quarter = { from: '2026-07-08T00:00:00.000Z', to: '2026-10-06T00:00:00.000Z' };

export const lifewardCompany: CompanySummaryDto = {
  slug: 'lifeward',
  name: 'Lifeward',
  formerNames: ['ReWalk'],
  status: {
    lastMentionedAt: '2026-10-01T09:00:00.000Z',
    daysSinceLastMention: 5,
    band: 'fresh',
  },
  quarter: { total: 12, positive: 7, negative: 2, neutral: 3 },
};

export const uncoveredCompany: CompanySummaryDto = {
  slug: 'quiet-co',
  name: 'Quiet Co',
  formerNames: [],
  status: { lastMentionedAt: null, daysSinceLastMention: null, band: 'none' },
  quarter: { total: 0, positive: 0, negative: 0, neutral: 0 },
};

export const companiesFixture: CompaniesResponseDto = {
  quarter,
  companies: [lifewardCompany, uncoveredCompany],
};

export const companyDetailFixture: CompanyDetailResponseDto = {
  quarter,
  company: lifewardCompany,
  mentions: [
    {
      id: 'mention-1',
      title: 'Lifeward unveils next-generation exoskeleton',
      url: 'https://example.com/lifeward-exoskeleton',
      outlet: 'TechCrunch',
      publishedAt: '2026-10-01T09:00:00.000Z',
      sentiment: 'positive',
      confidence: 0.92,
      rationale: "Announces a positive product milestone for Lifeward specifically.",
    },
  ],
};

const finishedRun: RunDto = {
  id: 'run-0',
  trigger: 'schedule',
  status: 'succeeded',
  startedAt: '2026-10-05T06:00:00.000Z',
  finishedAt: '2026-10-05T06:04:00.000Z',
  articlesFetched: 42,
  mentionsDiscovered: 9,
  mentionsClassified: 9,
  classificationFailures: 0,
  newMentions: 2,
  error: null,
};

export const startedRunFixture: RunDto = {
  id: 'run-1',
  trigger: 'manual',
  status: 'running',
  startedAt: '2026-10-06T08:00:00.000Z',
  finishedAt: null,
  articlesFetched: 0,
  mentionsDiscovered: 0,
  mentionsClassified: 0,
  classificationFailures: 0,
  newMentions: 0,
  error: null,
};

export const runsFixture: RunsResponseDto = { runs: [finishedRun, startedRunFixture] };
