/**
 * Stable cache keys for tutor session data.
 *
 * The SSE service has no GET session endpoint, so these keys are populated by
 * mutation responses. Keeping them centralized lets a future controller or
 * screen read the same cache entries without refetching.
 */
const tutorRoot = ['tutor'] as const;
const tutorSessions = [...tutorRoot, 'session'] as const;

export const tutorQueryKeys = {
  all: tutorRoot,
  sessions: () => tutorSessions,
  session: (bookingId: string) =>
    [...tutorSessions, bookingId] as const,
  feedback: (bookingId: string) =>
    [...tutorRoot, 'feedback', bookingId] as const,
} as const;

export const tutorMutationKeys = {
  start: [...tutorRoot, 'start-session'] as const,
  end: [...tutorRoot, 'end-session'] as const,
  feedback: [...tutorRoot, 'submit-feedback'] as const,
} as const;
