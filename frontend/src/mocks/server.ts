import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** The MSW server used by the Vitest suite — started/reset/closed in src/test/setup.ts. */
export const server = setupServer(...handlers);
