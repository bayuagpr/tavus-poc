import { HttpResponse, http } from 'msw';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTutorApiClient,
  isTutorApiError,
  TUTOR_END_DESCRIPTION_MAX_LENGTH,
  TUTOR_FEEDBACK_MAX_LENGTH,
} from './tutor';
import type { TutorApiClientConfig } from './tutor';
import { createTutorSessionFixture } from '@/mocks/fixtures';
import { createTutorMockHandlers } from '@/mocks/handlers';
import { createTutorMockServer } from '@/mocks/node';
import { createTutorMockStore } from '@/mocks/scenarios';

const API_BASE = 'https://sse.mock.test';
const store = createTutorMockStore();
const { server } = createTutorMockServer({ store, baseUrl: API_BASE });

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  store.reset();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

function createClient(config: Omit<TutorApiClientConfig, 'baseUrl'> = {}) {
  return createTutorApiClient({ baseUrl: API_BASE, ...config });
}

describe('createTutorApiClient', () => {
  it('starts a session and returns the typed contract fields', async () => {
    const session = await createClient().startSession('booking-api-1');

    expect(session).toMatchObject({
      bookingId: 'booking-api-1',
      conversationId: 'conversation-booking-api-1',
      conversationName: 'Ask Loka synthetic session',
      status: 'active',
      meetingToken: 'mock-meeting-token-booking-api-1',
    });
    expect(session.conversationUrl).toContain('mock-media.invalid');
    expect(
      new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime()
    ).toBe(10 * 60 * 1000);
  });

  it('sends host-supplied auth and tenant headers without persisting them', async () => {
    let captured: Request | undefined;
    server.use(
      http.post(
        `${API_BASE}/sse/v1/tutor/bookings/:bookingId/session`,
        ({ request }) => {
          captured = request;
          return HttpResponse.json(
            createTutorSessionFixture({ bookingId: 'booking-auth' })
          );
        }
      )
    );

    await createClient({
      auth: async () => ({
        accessToken: 'synthetic-access-token',
        idToken: 'synthetic-id-token',
        tenantDomain: 'tenant.example.test',
      }),
    }).startSession('booking-auth');

    expect(captured).toBeDefined();
    expect(captured?.headers.get('authorization')).toBe(
      'Bearer synthetic-access-token'
    );
    expect(captured?.headers.get('x-id-token')).toBe('synthetic-id-token');
    expect(captured?.headers.get('x-tenant-domain')).toBe(
      'tenant.example.test'
    );
  });

  it('omits auth headers when no provider is configured (mock mode)', async () => {
    let captured: Request | undefined;
    server.use(
      http.post(
        `${API_BASE}/sse/v1/tutor/bookings/:bookingId/session`,
        ({ request }) => {
          captured = request;
          return HttpResponse.json(
            createTutorSessionFixture({ bookingId: 'booking-no-auth' })
          );
        }
      )
    );

    await createClient().startSession('booking-no-auth');

    expect(captured?.headers.get('authorization')).toBeNull();
    expect(captured?.headers.get('x-id-token')).toBeNull();
    expect(captured?.headers.get('x-tenant-domain')).toBeNull();
  });

  it('intercepts tutor paths on any origin with the default wildcard handlers', async () => {
    const wildcardStore = createTutorMockStore();
    server.use(
      ...createTutorMockHandlers({ store: wildcardStore })
    );

    const session = await createTutorApiClient({
      baseUrl: 'https://another-origin.mock.test',
    }).startSession('booking-wildcard');

    expect(session.bookingId).toBe('booking-wildcard');
    expect(wildcardStore.snapshot().startAttempts).toBe(1);
  });

  it('normalizes a 404 booking error', async () => {
    store.reset({ start: 'not-found' });

    await expect(
      createClient().startSession('booking-missing')
    ).rejects.toMatchObject({
      name: 'TutorApiError',
      kind: 'http',
      status: 404,
      code: 'BOOKING_NOT_FOUND',
      message: 'No booking was found for this learner.',
    });
  });

  it.each([
    ['outside-window', 422, 'OUTSIDE_BOOKING_WINDOW'],
    ['unavailable', 503, 'TAVUS_UNAVAILABLE'],
  ] as const)(
    'normalizes the %s start scenario as HTTP %i',
    async (start, status, code) => {
      store.reset({ start });

      await expect(
        createClient().startSession('booking-scenario')
      ).rejects.toMatchObject({ kind: 'http', status, code });
    }
  );

  it('normalizes a network failure', async () => {
    store.reset({ start: 'network-error' });

    await expect(
      createClient().startSession('booking-network')
    ).rejects.toMatchObject({
      kind: 'network',
      status: null,
      code: 'NETWORK_ERROR',
    });
  });

  it('normalizes a non-JSON success response', async () => {
    server.use(
      http.post(
        `${API_BASE}/sse/v1/tutor/bookings/:bookingId/session`,
        () => HttpResponse.text('not json')
      )
    );

    await expect(
      createClient().startSession('booking-invalid')
    ).rejects.toMatchObject({
      kind: 'invalid-response',
      status: 200,
      code: 'INVALID_RESPONSE',
    });
  });

  it('supports aborting an in-flight start request', async () => {
    store.reset({ start: 'slow-success', slowDelayMs: 200 });
    const controller = new AbortController();

    const request = createClient().startSession('booking-abort', {
      signal: controller.signal,
    });
    controller.abort();

    await expect(request).rejects.toMatchObject({
      kind: 'aborted',
      code: 'ABORTED',
    });
  });

  it('sends the end outcome and optional description', async () => {
    let body: unknown;
    server.use(
      http.post(
        `${API_BASE}/sse/v1/tutor/bookings/:bookingId/session/end`,
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json(
            createTutorSessionFixture({
              bookingId: 'booking-end',
              status: 'ended',
            })
          );
        }
      )
    );

    const session = await createClient().endSession('booking-end', {
      outcome: 'COMPLETED',
      description: 'Finished the lesson.',
    });

    expect(body).toEqual({
      outcome: 'COMPLETED',
      description: 'Finished the lesson.',
    });
    expect(session.status).toBe('ended');
  });

  it('omits an absent end description from the request body', async () => {
    let body: unknown;
    server.use(
      http.post(
        `${API_BASE}/sse/v1/tutor/bookings/:bookingId/session/end`,
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json(
            createTutorSessionFixture({ bookingId: 'booking-end-min' })
          );
        }
      )
    );

    await createClient().endSession('booking-end-min', {
      outcome: 'INTERRUPTED',
    });

    expect(body).toEqual({ outcome: 'INTERRUPTED' });
  });

  it('rejects an over-long end description before sending it', async () => {
    await expect(
      createClient().endSession('booking-validation', {
        outcome: 'COMPLETED',
        description: 'x'.repeat(TUTOR_END_DESCRIPTION_MAX_LENGTH + 1),
      })
    ).rejects.toMatchObject({
      kind: 'validation',
      code: 'INVALID_REQUEST',
      details: { field: 'description' },
    });

    expect(store.snapshot().endAttempts).toBe(0);
  });

  it('submits feedback after an ended session and parses the 201 body', async () => {
    store.markEnded();

    const feedback = await createClient().submitFeedback('booking-feedback', {
      rating: 5,
      feedback: 'Clear and useful session.',
    });

    expect(feedback).toMatchObject({
      bookingId: 'booking-feedback',
      rating: 5,
      feedback: 'Clear and useful session.',
      learnerId: 'learner-demo',
    });
  });

  it.each([
    ['rating above five', { rating: 6 }],
    ['rating below one', { rating: 0 }],
    ['non-integer rating', { rating: 3.5 }],
    [
      'feedback over the limit',
      { rating: 4, feedback: 'x'.repeat(TUTOR_FEEDBACK_MAX_LENGTH + 1) },
    ],
  ])('rejects invalid feedback (%s) before sending', async (_label, input) => {
    await expect(
      createClient().submitFeedback('booking-invalid-feedback', input)
    ).rejects.toMatchObject({
      kind: 'validation',
      code: 'INVALID_REQUEST',
    });

    expect(store.snapshot().feedbackAttempts).toBe(0);
  });

  it('surfaces a duplicate feedback conflict', async () => {
    store.reset({ feedback: 'duplicate' });

    await expect(
      createClient().submitFeedback('booking-duplicate', { rating: 4 })
    ).rejects.toMatchObject({
      kind: 'http',
      status: 409,
      code: 'FEEDBACK_ALREADY_SUBMITTED',
    });
  });

  it('surfaces server-side feedback validation failures', async () => {
    store.reset({ feedback: 'validation-error' });

    await expect(
      createClient().submitFeedback('booking-server-validation', { rating: 4 })
    ).rejects.toMatchObject({
      kind: 'http',
      status: 400,
      code: 'VALIDATION_ERROR',
      details: { field: 'rating' },
    });
  });

  it('wraps auth-provider failures as typed auth errors', async () => {
    const client = createClient({
      auth: () => {
        throw new Error('token store unavailable');
      },
    });

    try {
      await client.startSession('booking-auth-error');
      throw new Error('Expected the request to fail.');
    } catch (error) {
      expect(isTutorApiError(error)).toBe(true);
      expect(error).toMatchObject({
        kind: 'auth',
        code: 'AUTH_PROVIDER_FAILED',
      });
    }
  });
});
