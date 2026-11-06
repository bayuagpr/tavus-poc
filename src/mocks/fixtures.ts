import { tutorSample } from '@/fixtures/tutor';
import type {
  TutorSessionDetails,
  TutorSessionFeedback,
} from '@/api/tutor';

/** Fixed default clock so generated session times are reproducible. */
export const MOCK_NOW = tutorSample.now;
export const MOCK_BOOKING_ID = tutorSample.bookingId;
export const MOCK_TENANT = 'tenant-demo';
export const MOCK_LEARNER_ID = 'learner-demo';
export const MOCK_SESSION_DURATION_MS = 10 * 60 * 1000;

export interface TutorSessionFixtureOptions {
  bookingId?: string;
  now?: Date | string;
  status?: string;
}

/**
 * Synthetic session details. The media URL uses the reserved `.invalid` TLD
 * on purpose: it cannot resolve, so it must never be joined with Daily/Tavus.
 */
export function createTutorSessionFixture(
  options: TutorSessionFixtureOptions = {}
): TutorSessionDetails {
  const bookingId = options.bookingId ?? MOCK_BOOKING_ID;
  const startsAt = new Date(options.now ?? MOCK_NOW);
  const endsAt = new Date(startsAt.getTime() + MOCK_SESSION_DURATION_MS);

  return {
    bookingId,
    conversationId: `conversation-${bookingId}`,
    conversationName: 'Ask Loka synthetic session',
    conversationUrl: `https://mock-media.invalid/tavus/${encodeURIComponent(bookingId)}`,
    status: options.status ?? 'active',
    meetingToken: `mock-meeting-token-${bookingId}`,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

export interface TutorFeedbackFixtureOptions {
  bookingId?: string;
  rating?: number;
  feedback?: string;
  now?: Date | string;
}

export function createTutorFeedbackFixture(
  options: TutorFeedbackFixtureOptions = {}
): TutorSessionFeedback {
  const bookingId = options.bookingId ?? MOCK_BOOKING_ID;
  const feedback: TutorSessionFeedback = {
    id: `feedback-${bookingId}`,
    bookingId,
    tenant: MOCK_TENANT,
    learnerId: MOCK_LEARNER_ID,
    rating: options.rating ?? 5,
    submittedAt: new Date(options.now ?? MOCK_NOW).toISOString(),
  };
  if (options.feedback !== undefined) {
    feedback.feedback = options.feedback;
  }
  return feedback;
}
