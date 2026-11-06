import { MOCK_NOW } from './fixtures';

export const START_SCENARIOS = [
  'success',
  'slow-success',
  'conflict-then-success',
  'not-found',
  'outside-window',
  'unavailable',
  'network-error',
] as const;

export const END_SCENARIOS = ['success', 'fail-once', 'unavailable'] as const;

export const FEEDBACK_SCENARIOS = [
  'success',
  'validation-error',
  'duplicate',
] as const;

export type StartScenario = (typeof START_SCENARIOS)[number];
export type EndScenario = (typeof END_SCENARIOS)[number];
export type FeedbackScenario = (typeof FEEDBACK_SCENARIOS)[number];

export interface TutorMockScenario {
  start: StartScenario;
  end: EndScenario;
  feedback: FeedbackScenario;
  /** Artificial preparation delay used by `slow-success`. */
  slowDelayMs: number;
}

export const DEFAULT_TUTOR_MOCK_SCENARIO: TutorMockScenario = {
  start: 'success',
  end: 'success',
  feedback: 'success',
  slowDelayMs: 800,
};

export type TutorMockClock = Date | string | number | (() => Date);

export interface TutorMockStoreOptions {
  scenario?: Partial<TutorMockScenario>;
  /** Defaults to the fixed `MOCK_NOW` instant. */
  clock?: TutorMockClock;
}

export interface TutorMockState {
  scenario: TutorMockScenario;
  startAttempts: number;
  endAttempts: number;
  feedbackAttempts: number;
  sessionEnded: boolean;
  feedbackSubmitted: boolean;
}

export interface TutorMockStore {
  getScenario(): Readonly<TutorMockScenario>;
  setScenario(patch: Partial<TutorMockScenario>): void;
  /** Resets counters and derived state, optionally applying a one-off scenario. */
  reset(scenario?: Partial<TutorMockScenario>): void;
  now(): Date;
  nextStartAttempt(): number;
  nextEndAttempt(): number;
  nextFeedbackAttempt(): number;
  markEnded(): void;
  markFeedbackSubmitted(): void;
  isSessionEnded(): boolean;
  isFeedbackSubmitted(): boolean;
  snapshot(): TutorMockState;
}

function mergeScenario(
  patch?: Partial<TutorMockScenario>
): TutorMockScenario {
  return { ...DEFAULT_TUTOR_MOCK_SCENARIO, ...patch };
}

function resolveClock(clock?: TutorMockClock): () => Date {
  if (typeof clock === 'function') {
    return () => {
      const value = clock();
      if (Number.isNaN(value.getTime())) {
        throw new Error('The tutor mock clock returned an invalid date.');
      }
      return value;
    };
  }

  const fixed = new Date(clock ?? MOCK_NOW);
  if (Number.isNaN(fixed.getTime())) {
    throw new Error('The tutor mock clock must be a valid date.');
  }
  return () => new Date(fixed.getTime());
}

/**
 * Deterministic, resettable scenario state shared by MSW handlers. A reset
 * starts with an active, unrated session. Feedback success therefore requires
 * calling the end endpoint first (or `markEnded()` in a focused test); a second
 * successful submission is rejected with 409.
 */
export function createTutorMockStore(
  options: TutorMockStoreOptions = {}
): TutorMockStore {
  const now = resolveClock(options.clock);
  const initialScenario = mergeScenario(options.scenario);
  let scenario = { ...initialScenario };
  let startAttempts = 0;
  let endAttempts = 0;
  let feedbackAttempts = 0;
  let sessionEnded = false;
  let feedbackSubmitted = false;

  const seed = () => {
    startAttempts = 0;
    endAttempts = 0;
    feedbackAttempts = 0;
    sessionEnded = false;
    feedbackSubmitted = false;
  };

  seed();

  return {
    getScenario() {
      return { ...scenario };
    },

    setScenario(patch) {
      scenario = { ...scenario, ...patch };
      seed();
    },

    reset(next) {
      scenario = mergeScenario(next ?? initialScenario);
      seed();
    },

    now,

    nextStartAttempt() {
      startAttempts += 1;
      return startAttempts;
    },

    nextEndAttempt() {
      endAttempts += 1;
      return endAttempts;
    },

    nextFeedbackAttempt() {
      feedbackAttempts += 1;
      return feedbackAttempts;
    },

    markEnded() {
      sessionEnded = true;
    },

    markFeedbackSubmitted() {
      feedbackSubmitted = true;
    },

    isSessionEnded() {
      return sessionEnded;
    },

    isFeedbackSubmitted() {
      return feedbackSubmitted;
    },

    snapshot() {
      return {
        scenario: { ...scenario },
        startAttempts,
        endAttempts,
        feedbackAttempts,
        sessionEnded,
        feedbackSubmitted,
      };
    },
  };
}
