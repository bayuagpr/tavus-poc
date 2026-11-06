import { createBookingFixture } from '@/fixtures/tutor';
import { delay, http, HttpResponse } from 'msw';
import type { EndTutorSessionInput, TutorFeedbackInput } from '@/api/tutor';
import { TUTOR_END_DESCRIPTION_MAX_LENGTH, TUTOR_FEEDBACK_MAX_LENGTH } from '@/api/tutor';
import {
  createTutorFeedbackFixture,
  createTutorSessionFixture,
} from './fixtures';
import { createTutorMockStore } from './scenarios';
import type { TutorMockStore } from './scenarios';

interface BookingPathParams {
  bookingId: string;
}

export interface TutorMockHandlerOptions {
  store?: TutorMockStore;
  /**
   * Origin to intercept. Defaults to `*` so mock mode works regardless of the
   * configured API base URL. Pass an exact origin in tests when useful.
   */
  baseUrl?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return HttpResponse.json(
    { code, message, ...details },
    { status }
  );
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; field: string; message: string };

function validateEndInput(body: unknown): ValidationResult<EndTutorSessionInput> {
  if (!isRecord(body)) {
    return { ok: false, field: 'body', message: 'A JSON request body is required.' };
  }
  if (body.outcome !== 'COMPLETED' && body.outcome !== 'INTERRUPTED') {
    return {
      ok: false,
      field: 'outcome',
      message: 'Outcome must be COMPLETED or INTERRUPTED.',
    };
  }
  if (
    body.description !== undefined &&
    (typeof body.description !== 'string' ||
      body.description.length > TUTOR_END_DESCRIPTION_MAX_LENGTH)
  ) {
    return {
      ok: false,
      field: 'description',
      message: `Description must be at most ${TUTOR_END_DESCRIPTION_MAX_LENGTH} characters.`,
    };
  }

  const value: EndTutorSessionInput = { outcome: body.outcome };
  if (typeof body.description === 'string') {
    value.description = body.description;
  }
  return { ok: true, value };
}

function validateFeedbackInput(
  body: unknown
): ValidationResult<TutorFeedbackInput> {
  if (!isRecord(body)) {
    return { ok: false, field: 'body', message: 'A JSON request body is required.' };
  }
  if (
    typeof body.rating !== 'number' ||
    !Number.isInteger(body.rating) ||
    body.rating < 1 ||
    body.rating > 5
  ) {
    return {
      ok: false,
      field: 'rating',
      message: 'Rating must be an integer from 1 to 5.',
    };
  }
  if (
    body.feedback !== undefined &&
    (typeof body.feedback !== 'string' ||
      body.feedback.length > TUTOR_FEEDBACK_MAX_LENGTH)
  ) {
    return {
      ok: false,
      field: 'feedback',
      message: `Feedback must be at most ${TUTOR_FEEDBACK_MAX_LENGTH} characters.`,
    };
  }

  const value: TutorFeedbackInput = { rating: body.rating };
  if (typeof body.feedback === 'string') {
    value.feedback = body.feedback;
  }
  return { ok: true, value };
}

/**
 * MSW handlers for the three Tutor mutations. Only exact tutor paths are
 * intercepted; everything else (including Daily/Tavus media traffic) is left
 * to the network. Handlers are stateful through the supplied scenario store.
 */
export function createTutorMockHandlers(
  options: TutorMockHandlerOptions = {}
) {
  const store = options.store ?? createTutorMockStore();
  const origin = options.baseUrl
    ? options.baseUrl.replace(/\/+$/, '')
    : '*';

  return [
    http.get(`${origin}/sse/v1/tutor/bookings/current`, ({ request }) => {
      const month = new URL(request.url).searchParams.get('month') ?? '';
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return errorResponse(400, 'INVALID_MONTH', 'Invalid month.');
      const mode = store.getScenario().booking;
      if (mode === 'network-error') return HttpResponse.error();
      if (mode === 'unavailable') return errorResponse(500, 'LOOKUP_FAILED', 'Booking lookup failed.');
      const booking = createBookingFixture();
      if (mode === 'empty' || month !== booking.month) return errorResponse(404, 'BOOKING_NOT_FOUND', 'No booking this month.');
      return HttpResponse.json(store.isBookingCancelled(booking.id) ? { ...booking, status: 'CANCELLED', cancelledAt: store.now().toISOString() } : booking);
    }),
    http.get(`${origin}/sse/v1/tutor/availability`, ({ request }) => {
      const month = new URL(request.url).searchParams.get('month') ?? '';
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return errorResponse(400, 'INVALID_MONTH', 'Invalid month.');
      const mode = store.getScenario().availability;
      if (mode === 'unavailable') return errorResponse(500, 'LOOKUP_FAILED', 'Availability lookup failed.');
      if (mode === 'empty') return HttpResponse.json([]);
      const booking = createBookingFixture();
      if (month !== booking.month) return HttpResponse.json([]);
      const used = store.getScenario().booking !== 'empty';
      return HttpResponse.json([{ slotId: booking.slotId, startsAt: booking.startsAt, endsAt: booking.endsAt, status: used && !store.isBookingCancelled(booking.id) ? 'BOOKED' : 'AVAILABLE', eligible: !used }]);
    }),
    http.delete<BookingPathParams>(`${origin}/sse/v1/tutor/bookings/:bookingId`, ({ params }) => {
      const booking = createBookingFixture({ id: params.bookingId });
      const mode = store.getScenario().cancel;
      if (mode === 'not-found') return errorResponse(404, 'BOOKING_NOT_FOUND', 'Booking not found.');
      if (mode === 'unavailable') return errorResponse(500, 'CANCEL_FAILED', 'Cancellation failed.');
      if (!store.isBookingCancelled(booking.id) && (mode === 'cutoff' || store.now().getTime() > Date.parse(booking.startsAt) - 86400000)) return errorResponse(400, 'CANCELLATION_CUTOFF', 'Cancellation cutoff has passed.');
      store.cancelBooking(booking.id);
      return HttpResponse.json({ ...booking, status: 'CANCELLED', cancelledAt: store.now().toISOString() });
    }),
    http.post<BookingPathParams>(
      `${origin}/sse/v1/tutor/bookings/:bookingId/session`,
      async ({ params }) => {
        const { bookingId } = params;
        const scenario = store.getScenario();
        const attempt = store.nextStartAttempt();

        switch (scenario.start) {
          case 'not-found':
            return errorResponse(
              404,
              'BOOKING_NOT_FOUND',
              'No booking was found for this learner.'
            );
          case 'outside-window':
            return errorResponse(
              422,
              'OUTSIDE_BOOKING_WINDOW',
              'The booked session is outside its allowed time window.'
            );
          case 'unavailable':
            return errorResponse(
              503,
              'TAVUS_UNAVAILABLE',
              'The conversation provider is unavailable.'
            );
          case 'network-error':
            return HttpResponse.error();
          case 'slow-success':
            await delay(scenario.slowDelayMs);
            return HttpResponse.json(
              createTutorSessionFixture({
                bookingId,
                now: store.now(),
                status: 'active',
              })
            );
          case 'conflict-then-success':
            if (attempt === 1) {
              return errorResponse(
                409,
                'CONVERSATION_IN_PROGRESS',
                'Conversation creation is already in progress.'
              );
            }
            return HttpResponse.json(
              createTutorSessionFixture({
                bookingId,
                now: store.now(),
                status: 'active',
              })
            );
          case 'success':
          default:
            return HttpResponse.json(
              createTutorSessionFixture({
                bookingId,
                now: store.now(),
                status: 'active',
              })
            );
        }
      }
    ),

    http.post<BookingPathParams>(
      `${origin}/sse/v1/tutor/bookings/:bookingId/session/end`,
      async ({ params, request }) => {
        const { bookingId } = params;
        const body = await readJsonBody(request);
        const input = validateEndInput(body);
        if (!input.ok) {
          return errorResponse(400, 'VALIDATION_ERROR', input.message, {
            field: input.field,
          });
        }

        const scenario = store.getScenario();
        const attempt = store.nextEndAttempt();

        if (scenario.end === 'unavailable') {
          return errorResponse(
            503,
            'TAVUS_UNAVAILABLE',
            'The conversation provider is unavailable.'
          );
        }
        if (scenario.end === 'fail-once' && attempt === 1) {
          return errorResponse(
            503,
            'END_TEMPORARILY_FAILED',
            'Ending the conversation failed. Retry the request.'
          );
        }

        store.markEnded();
        return HttpResponse.json(
          createTutorSessionFixture({
            bookingId,
            now: store.now(),
            status: 'ended',
          })
        );
      }
    ),

    http.post<BookingPathParams>(
      `${origin}/sse/v1/tutor/bookings/:bookingId/feedback`,
      async ({ params, request }) => {
        const { bookingId } = params;
        const body = await readJsonBody(request);
        const input = validateFeedbackInput(body);
        if (!input.ok) {
          return errorResponse(400, 'VALIDATION_ERROR', input.message, {
            field: input.field,
          });
        }

        store.nextFeedbackAttempt();
        const scenario = store.getScenario();

        if (scenario.feedback === 'validation-error') {
          return errorResponse(
            400,
            'VALIDATION_ERROR',
            'Feedback did not pass server validation.',
            { field: 'rating' }
          );
        }
        if (scenario.feedback === 'duplicate') {
          return errorResponse(
            409,
            'FEEDBACK_ALREADY_SUBMITTED',
            'Feedback has already been submitted for this booking.'
          );
        }
        if (!store.isSessionEnded()) {
          return errorResponse(
            409,
            'SESSION_NOT_ENDED',
            'Feedback can only be submitted after the session ends.'
          );
        }
        if (store.isFeedbackSubmitted()) {
          return errorResponse(
            409,
            'FEEDBACK_ALREADY_SUBMITTED',
            'Feedback has already been submitted for this booking.'
          );
        }

        store.markFeedbackSubmitted();
        return HttpResponse.json(
          createTutorFeedbackFixture({
            bookingId,
            rating: input.value.rating,
            feedback: input.value.feedback,
            now: store.now(),
          }),
          { status: 201 }
        );
      }
    ),
  ];
}
