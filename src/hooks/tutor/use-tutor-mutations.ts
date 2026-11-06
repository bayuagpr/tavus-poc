import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  EndTutorSessionInput,
  TutorApiClient,
  TutorFeedbackInput,
  TutorSessionDetails,
  TutorSessionFeedback,
} from '@/api/tutor';
import {
  isRetryableTutorStartError,
  TutorApiError,
} from '@/api/tutor';
import { tutorMutationKeys, tutorQueryKeys } from './query-keys';
import { useOptionalTutorApiClient } from './tutor-api-context';

export type TutorMutationRetry =
  | boolean
  | number
  | ((failureCount: number, error: TutorApiError) => boolean);

export type TutorMutationRetryDelay =
  | number
  | ((failureCount: number, error: TutorApiError) => number);

export interface TutorMutationHookOptions {
  /** Overrides the client supplied by <TutorApiProvider>. */
  client?: TutorApiClient;
  /**
   * Mutation retries. Defaults are intentionally conservative:
   * start retries only the documented 409, end and feedback never retry.
   */
  retry?: TutorMutationRetry;
  retryDelay?: TutorMutationRetryDelay;
}

export interface StartTutorSessionVariables {
  bookingId: string;
  signal?: AbortSignal;
}

export interface EndTutorSessionVariables extends EndTutorSessionInput {
  bookingId: string;
  signal?: AbortSignal;
}

export interface SubmitTutorFeedbackVariables extends TutorFeedbackInput {
  bookingId: string;
  signal?: AbortSignal;
}

/**
 * A start request may return 409 while Tavus is still creating the
 * conversation. The service reuses the same conversation on repeated starts,
 * so a small, bounded retry is safe. Every other start failure is surfaced
 * immediately.
 */
export const START_SESSION_MAX_RETRIES = 2;

export const shouldRetryTutorStartSession: TutorMutationRetry = (
  failureCount,
  error
) =>
  failureCount < START_SESSION_MAX_RETRIES &&
  isRetryableTutorStartError(error);

function requireClient(
  client: TutorApiClient | null | undefined
): TutorApiClient {
  if (!client) {
    throw new TutorApiError({
      kind: 'validation',
      code: 'CLIENT_NOT_CONFIGURED',
      message:
        'No Tutor API client is configured. Pass a client to the hook or wrap the tree in <TutorApiProvider>.',
    });
  }
  return client;
}

export function useStartTutorSession(options: TutorMutationHookOptions = {}) {
  const contextClient = useOptionalTutorApiClient();
  const client = options.client ?? contextClient;
  const queryClient = useQueryClient();

  return useMutation<
    TutorSessionDetails,
    TutorApiError,
    StartTutorSessionVariables
  >({
    mutationKey: tutorMutationKeys.start,
    mutationFn: (variables) =>
      requireClient(client).startSession(variables.bookingId, {
        signal: variables.signal,
      }),
    retry: options.retry ?? shouldRetryTutorStartSession,
    retryDelay: options.retryDelay,
    onSuccess: (session) => {
      queryClient.setQueryData(
        tutorQueryKeys.session(session.bookingId),
        session
      );
    },
  });
}

export function useEndTutorSession(options: TutorMutationHookOptions = {}) {
  const contextClient = useOptionalTutorApiClient();
  const client = options.client ?? contextClient;
  const queryClient = useQueryClient();

  return useMutation<
    TutorSessionDetails,
    TutorApiError,
    EndTutorSessionVariables
  >({
    mutationKey: tutorMutationKeys.end,
    mutationFn: (variables) =>
      requireClient(client).endSession(
        variables.bookingId,
        {
          outcome: variables.outcome,
          description: variables.description,
        },
        { signal: variables.signal }
      ),
    // Ending a live conversation is not retried automatically. A failed end
    // must remain visible so the user can explicitly retry or recover.
    retry: options.retry ?? false,
    retryDelay: options.retryDelay,
    onSuccess: (session) => {
      queryClient.setQueryData(
        tutorQueryKeys.session(session.bookingId),
        session
      );
    },
  });
}

export function useSubmitTutorFeedback(
  options: TutorMutationHookOptions = {}
) {
  const contextClient = useOptionalTutorApiClient();
  const client = options.client ?? contextClient;
  const queryClient = useQueryClient();

  return useMutation<
    TutorSessionFeedback,
    TutorApiError,
    SubmitTutorFeedbackVariables
  >({
    mutationKey: tutorMutationKeys.feedback,
    mutationFn: (variables) =>
      requireClient(client).submitFeedback(
        variables.bookingId,
        {
          rating: variables.rating,
          feedback: variables.feedback,
        },
        { signal: variables.signal }
      ),
    // Feedback is accepted only once. Automatic retries could turn a
    // transient response into a duplicate submission, so they are disabled.
    retry: options.retry ?? false,
    retryDelay: options.retryDelay,
    onSuccess: (feedback) => {
      queryClient.setQueryData(
        tutorQueryKeys.feedback(feedback.bookingId),
        feedback
      );
    },
  });
}
