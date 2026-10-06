import { http, HttpResponse } from 'msw';
import {
  companiesFixture,
  companyDetailFixture,
  runsFixture,
  startedRunFixture,
} from './fixtures';

/** The default handler set — every endpoint in docs/PLAN.md#http-api on its success path. */
export const handlers = [
  http.get('/api/companies', () => HttpResponse.json(companiesFixture)),

  http.get('/api/companies/:slug', ({ params }) => {
    if (params.slug === companyDetailFixture.company.slug) {
      return HttpResponse.json(companyDetailFixture);
    }
    return HttpResponse.json(
      { message: `No tracked company with slug "${String(params.slug)}"` },
      { status: 404 },
    );
  }),

  http.get('/api/runs', () => HttpResponse.json(runsFixture)),

  http.post('/api/runs', () => HttpResponse.json(startedRunFixture, { status: 202 })),
];

/**
 * Test-only override for `POST /api/runs` that simulates a Run already
 * holding the lock. Apply with `server.use(runAlreadyInProgressHandler)` in
 * a specific test rather than making it a default handler.
 */
export const runAlreadyInProgressHandler = http.post('/api/runs', () =>
  HttpResponse.json({ message: 'A run is already in progress' }, { status: 409 }),
);
