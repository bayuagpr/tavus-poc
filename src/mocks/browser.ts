import { setupWorker } from 'msw/browser';
import { createTutorMockHandlers } from './handlers';
import { createTutorMockStore } from './scenarios';
import type { TutorMockStore } from './scenarios';

export interface TutorMockWorkerOptions {
  store?: TutorMockStore;
}

/**
 * Builds a browser worker around a specific scenario store. Useful when a
 * test harness or Storybook-like environment needs isolated mock state.
 */
export function createTutorMockWorker(options: TutorMockWorkerOptions = {}) {
  const store = options.store ?? createTutorMockStore();
  return {
    worker: setupWorker(...createTutorMockHandlers({ store })),
    store,
  };
}

/** Shared browser worker and scenario store for the development app. */
export const tutorMockStore = createTutorMockStore();
export const tutorMockWorker = setupWorker(
  ...createTutorMockHandlers({ store: tutorMockStore })
);

export interface StartTutorMocksOptions {
  /** Defaults to the application's `/mockServiceWorker.js`. */
  serviceWorkerUrl?: string;
  quiet?: boolean;
  /** Uses an isolated worker/store instead of the shared browser instance. */
  store?: TutorMockStore;
}

/**
 * Opt-in browser bootstrap. Call and await this before rendering when mock
 * mode is enabled; it is intentionally not referenced by `main.tsx`.
 *
 * Unhandled requests are bypassed so provider, media and asset traffic never
 * get intercepted.
 */
export async function startTutorMocks(
  options: StartTutorMocksOptions = {}
) {
  const target = options.store
    ? createTutorMockWorker({ store: options.store })
    : { worker: tutorMockWorker, store: tutorMockStore };

  await target.worker.start({
    onUnhandledRequest: 'bypass',
    quiet: options.quiet ?? false,
    serviceWorker: {
      url: options.serviceWorkerUrl ?? '/mockServiceWorker.js',
    },
  });

  return target;
}

export function stopTutorMocks(
  worker: ReturnType<typeof setupWorker> = tutorMockWorker
): void {
  worker.stop();
}
