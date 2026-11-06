import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTutorApiClient } from '@/api/tutor';
import type { TutorSessionDetails } from '@/api/tutor';
import { createTutorMockServer } from '@/mocks/node';
import { createTutorMockStore } from '@/mocks/scenarios';
import {
  tutorQueryKeys,
  TutorApiProvider,
  useEndTutorSession,
  useStartTutorSession,
  useSubmitTutorFeedback,
} from '@/hooks/tutor';

const API_BASE = 'https://sse.hooks.mock.test';
const store = createTutorMockStore();
const { server } = createTutorMockServer({ store, baseUrl: API_BASE });
const client = createTutorApiClient({ baseUrl: API_BASE });

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

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TutorApiProvider client={client}>{children}</TutorApiProvider>
      </QueryClientProvider>
    );
  };
}

describe('tutor mutation hooks', () => {
  it('starts a session and seeds the scoped session cache', async () => {
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useStartTutorSession({ retryDelay: 0 }),
      { wrapper: createWrapper(queryClient) }
    );

    let session: TutorSessionDetails | undefined;
    await act(async () => {
      session = await result.current.mutateAsync({
        bookingId: 'booking-hook-success',
      });
    });

    expect(session).toMatchObject({
      bookingId: 'booking-hook-success',
      status: 'active',
    });
    expect(
      queryClient.getQueryData(
        tutorQueryKeys.session('booking-hook-success')
      )
    ).toEqual(session);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('automatically retries only the documented 409 start conflict', async () => {
    store.reset({ start: 'conflict-then-success' });
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useStartTutorSession({ retryDelay: 0 }),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'booking-hook-retry' });
    });

    expect(store.snapshot().startAttempts).toBe(2);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('does not retry a non-409 start failure', async () => {
    store.reset({ start: 'not-found' });
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useStartTutorSession({ retryDelay: 0 }),
      { wrapper: createWrapper(queryClient) }
    );

    await act(async () => {
      await expect(
        result.current.mutateAsync({ bookingId: 'booking-hook-404' })
      ).rejects.toMatchObject({ kind: 'http', status: 404 });
    });

    expect(store.snapshot().startAttempts).toBe(1);
    expect(
      queryClient.getQueryData(tutorQueryKeys.session('booking-hook-404'))
    ).toBeUndefined();
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('does not dedupe concurrent mutations; the controller owns that guard', async () => {
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useStartTutorSession({ retryDelay: 0 }),
      { wrapper: createWrapper(queryClient) }
    );

    let sessions: TutorSessionDetails[] = [];
    await act(async () => {
      sessions = await Promise.all([
        result.current.mutateAsync({ bookingId: 'booking-hook-concurrent' }),
        result.current.mutateAsync({ bookingId: 'booking-hook-concurrent' }),
      ]);
    });

    expect(sessions).toHaveLength(2);
    expect(store.snapshot().startAttempts).toBe(2);
  });

  it('surfaces an end failure without retrying, then succeeds on manual retry', async () => {
    store.reset({ end: 'fail-once' });
    const queryClient = createQueryClient();
    const { result } = renderHook(() => useEndTutorSession(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          bookingId: 'booking-hook-end',
          outcome: 'COMPLETED',
        })
      ).rejects.toMatchObject({
        kind: 'http',
        status: 503,
        code: 'END_TEMPORARILY_FAILED',
      });
    });
    expect(store.snapshot().endAttempts).toBe(1);
    expect(
      queryClient.getQueryData(tutorQueryKeys.session('booking-hook-end'))
    ).toBeUndefined();

    let ended: TutorSessionDetails | undefined;
    await act(async () => {
      ended = await result.current.mutateAsync({
        bookingId: 'booking-hook-end',
        outcome: 'COMPLETED',
        description: 'Retried after a provider error.',
      });
    });

    expect(ended?.status).toBe('ended');
    expect(store.snapshot().endAttempts).toBe(2);
    expect(
      queryClient.getQueryData(tutorQueryKeys.session('booking-hook-end'))
    ).toMatchObject({ bookingId: 'booking-hook-end', status: 'ended' });
  });

  it('seeds feedback cache and rejects a duplicate submission', async () => {
    store.markEnded();
    const queryClient = createQueryClient();
    const { result } = renderHook(() => useSubmitTutorFeedback(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        bookingId: 'booking-hook-feedback',
        rating: 5,
        feedback: 'Helpful session.',
      });
    });

    expect(
      queryClient.getQueryData(
        tutorQueryKeys.feedback('booking-hook-feedback')
      )
    ).toMatchObject({ bookingId: 'booking-hook-feedback', rating: 5 });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          bookingId: 'booking-hook-feedback',
          rating: 4,
        })
      ).rejects.toMatchObject({
        kind: 'http',
        status: 409,
        code: 'FEEDBACK_ALREADY_SUBMITTED',
      });
    });

    expect(store.snapshot().feedbackAttempts).toBe(2);
  });

  it('surfaces a server-side feedback validation failure', async () => {
    store.reset({ feedback: 'validation-error' });
    store.markEnded();
    const queryClient = createQueryClient();
    const { result } = renderHook(() => useSubmitTutorFeedback(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          bookingId: 'booking-hook-server-validation',
          rating: 4,
        })
      ).rejects.toMatchObject({
        kind: 'http',
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    expect(store.snapshot().feedbackAttempts).toBe(1);
    expect(
      queryClient.getQueryData(
        tutorQueryKeys.feedback('booking-hook-server-validation')
      )
    ).toBeUndefined();
  });

  it('validates feedback locally without issuing a request', async () => {
    store.markEnded();
    const queryClient = createQueryClient();
    const { result } = renderHook(() => useSubmitTutorFeedback(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          bookingId: 'booking-hook-local-validation',
          rating: 6,
        })
      ).rejects.toMatchObject({
        kind: 'validation',
        code: 'INVALID_REQUEST',
      });
    });

    expect(store.snapshot().feedbackAttempts).toBe(0);
    expect(
      queryClient.getQueryData(
        tutorQueryKeys.feedback('booking-hook-local-validation')
      )
    ).toBeUndefined();
  });

  it('does not cache an aborted start response', async () => {
    store.reset({ start: 'slow-success', slowDelayMs: 100 });
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useStartTutorSession({ retryDelay: 0 }),
      { wrapper: createWrapper(queryClient) }
    );
    const controller = new AbortController();

    await act(async () => {
      const request = result.current.mutateAsync({
        bookingId: 'booking-hook-abort',
        signal: controller.signal,
      });
      controller.abort();
      await expect(request).rejects.toMatchObject({
        kind: 'aborted',
        code: 'ABORTED',
      });
    });

    expect(
      queryClient.getQueryData(tutorQueryKeys.session('booking-hook-abort'))
    ).toBeUndefined();
  });

  it('reports a clear error when no client is configured', async () => {
    const queryClient = createQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useStartTutorSession(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ bookingId: 'booking-hook-no-client' })
      ).rejects.toMatchObject({
        kind: 'validation',
        code: 'CLIENT_NOT_CONFIGURED',
      });
    });

    expect(store.snapshot().startAttempts).toBe(0);
  });
});
