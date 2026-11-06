import { setupServer } from 'msw/node';
import { createTutorMockHandlers } from './handlers';
import { createTutorMockStore } from './scenarios';
import type { TutorMockStore } from './scenarios';

export interface TutorMockServerOptions {
  store?: TutorMockStore;
  /** Exact origin used by the client under test. */
  baseUrl?: string;
}

/**
 * Node server used by Vitest. Returns the scenario store alongside the server
 * so tests can reset state and assert attempt counts.
 */
export function createTutorMockServer(options: TutorMockServerOptions = {}) {
  const store = options.store ?? createTutorMockStore();
  const server = setupServer(
    ...createTutorMockHandlers({ store, baseUrl: options.baseUrl })
  );
  return { server, store };
}
