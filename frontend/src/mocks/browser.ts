import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/** The MSW worker started in the browser by `npm run dev:mock`. */
export const worker = setupWorker(...handlers);
