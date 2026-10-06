import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '../mocks/server';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
  // vitest.config.ts doesn't set `test.globals: true`, so Testing Library's
  // own auto-cleanup (which looks for a global `afterEach`) never registers
  // — without this, a component rendered in one test stays mounted into the
  // next test in the same file.
  cleanup();
});

afterAll(() => {
  server.close();
});
