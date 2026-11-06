/**
 * Typed client for the LMS Tutor booking API.
 *
 * Contract source (reviewed 2026-11-06):
 * https://api.dev.adroit-lms.com/doc/sse-service/v3/api-docs
 *
 * This module deliberately implements booking reads, cancellation, and mutations used by the
 * session flow. The service does not expose a GET endpoint for a booking's
 * session details, so none is invented here.
 */

export interface TutorBooking {
 id: string; tenant: string; learnerId: string; courseId: string; slotId: string;
 month: string; startsAt: string; endsAt: string; status: 'BOOKED' | 'CANCELLED';
 createdAt: string; cancelledAt: string | null;
}
export interface TutorAvailability {
 slotId: string; startsAt: string; endsAt: string; status: 'AVAILABLE' | 'BOOKED'; eligible: boolean;
}
function assertMonth(month: string): void {
 if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw validationError('Month must use YYYY-MM.', 'month');
}
function parseBooking(payload: unknown, status: number): TutorBooking {
 if (!isRecord(payload) || typeof payload.id !== 'string' || typeof payload.month !== 'string' || !['BOOKED','CANCELLED'].includes(String(payload.status))) throw invalidResponseError(status, 'Unexpected booking response.', payload);
 return payload as unknown as TutorBooking;
}
export interface TutorSessionDetails {
  bookingId: string;
  conversationId: string;
  conversationName: string;
  conversationUrl: string;
  status: string;
  meetingToken: string;
  startsAt: string;
  endsAt: string;
}

export type TutorEndOutcome = 'COMPLETED' | 'INTERRUPTED';

export interface EndTutorSessionInput {
  outcome: TutorEndOutcome;
  /** Optional written context. The service accepts at most 2000 characters. */
  description?: string;
}

export interface TutorFeedbackInput {
  /** Overall experience rating from 1 (Very poor) to 5 (Excellent). */
  rating: number;
  /** Optional written feedback. The service accepts at most 2000 characters. */
  feedback?: string;
}

export interface TutorSessionFeedback {
  id: string;
  bookingId: string;
  tenant: string;
  learnerId: string;
  rating: number;
  feedback?: string;
  submittedAt: string;
}

export const TUTOR_END_DESCRIPTION_MAX_LENGTH = 2000;
export const TUTOR_FEEDBACK_MAX_LENGTH = 2000;

/**
 * Credentials supplied by the host LMS. The client never persists or logs
 * these values; the provider is called for every request so tokens can be
 * refreshed between calls.
 */
export interface TutorAuthCredentials {
  /** Raw Cognito access token. The client adds the `Bearer ` prefix. */
  accessToken: string;
  /** Cognito ID token sent as `X-Id-Token`. */
  idToken: string;
  /** Optional tenant domain sent as `X-Tenant-Domain`. */
  tenantDomain?: string;
}

export type TutorAuthProvider = () =>
  | TutorAuthCredentials
  | Promise<TutorAuthCredentials>;

export type TutorApiErrorKind =
  | 'http'
  | 'network'
  | 'aborted'
  | 'validation'
  | 'auth'
  | 'invalid-response';

export interface TutorApiErrorInit {
  kind: TutorApiErrorKind;
  message: string;
  status?: number | null;
  code?: string | null;
  details?: unknown;
  cause?: unknown;
}

/**
 * Normalized error for every path through the client. Callers can branch on
 * `kind` and `status` instead of parsing provider-specific payloads.
 */
export class TutorApiError extends Error {
  readonly kind: TutorApiErrorKind;
  readonly status: number | null;
  readonly code: string | null;
  readonly details: unknown;

  constructor(init: TutorApiErrorInit) {
    super(
      init.message,
      init.cause === undefined ? undefined : { cause: init.cause }
    );
    this.name = 'TutorApiError';
    this.kind = init.kind;
    this.status = init.status ?? null;
    this.code = init.code ?? null;
    this.details = init.details;
  }
}

export function isTutorApiError(error: unknown): error is TutorApiError {
  return error instanceof TutorApiError;
}

/** The service documents 409 while a conversation is still being created. */
export function isRetryableTutorStartError(error: unknown): boolean {
  return (
    isTutorApiError(error) &&
    error.kind === 'http' &&
    error.status === 409
  );
}

export interface TutorRequestOptions {
  /** Cancels the request; resolves as a normalized `aborted` error. */
  signal?: AbortSignal;
}

export interface TutorApiClient {
  readonly baseUrl: string;
  getCurrentBooking(month: string, options?: TutorRequestOptions): Promise<TutorBooking | null>;
  getAvailability(month: string, options?: TutorRequestOptions): Promise<TutorAvailability[]>;
  cancelBooking(bookingId: string, options?: TutorRequestOptions): Promise<TutorBooking>;
  startSession(
    bookingId: string,
    options?: TutorRequestOptions
  ): Promise<TutorSessionDetails>;
  endSession(
    bookingId: string,
    input: EndTutorSessionInput,
    options?: TutorRequestOptions
  ): Promise<TutorSessionDetails>;
  submitFeedback(
    bookingId: string,
    input: TutorFeedbackInput,
    options?: TutorRequestOptions
  ): Promise<TutorSessionFeedback>;
}

export interface TutorApiClientConfig {
  /**
   * Origin and optional path prefix for the SSE service. Defaults to an empty
   * string, which sends requests to the current origin (the usual gateway
   * deployment). Trailing slashes are removed.
   */
  baseUrl?: string;
  /** Optional host-supplied credentials. Omit in mock/local mode. */
  auth?: TutorAuthProvider;
  /** Injectable fetch implementation, primarily for tests. */
  fetchImpl?: typeof fetch;
}

type JsonObject = Record<string, unknown>;

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validationError(message: string, field: string): TutorApiError {
  return new TutorApiError({
    kind: 'validation',
    code: 'INVALID_REQUEST',
    message,
    details: { field },
  });
}

function abortError(cause?: unknown): TutorApiError {
  return new TutorApiError({
    kind: 'aborted',
    code: 'ABORTED',
    message: 'The tutor API request was aborted.',
    cause,
  });
}

function networkError(cause: unknown): TutorApiError {
  return new TutorApiError({
    kind: 'network',
    code: 'NETWORK_ERROR',
    message: 'Could not reach the tutor API. Check the connection and retry.',
    cause,
  });
}

function invalidResponseError(
  status: number,
  message: string,
  details: unknown
): TutorApiError {
  return new TutorApiError({
    kind: 'invalid-response',
    code: 'INVALID_RESPONSE',
    status,
    message,
    details,
  });
}

function isAbortCause(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) {
    return true;
  }
  return error instanceof Error && error.name === 'AbortError';
}

function defaultHttpErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'The tutor API rejected the request.';
    case 401:
      return 'The tutor API requires valid credentials.';
    case 403:
      return 'You do not have access to this tutor session.';
    case 404:
      return 'The booking or session was not found.';
    case 409:
      return 'The session is not ready for this action.';
    case 422:
      return 'The session is outside the booked time window.';
    case 503:
      return 'The tutor service is temporarily unavailable.';
    default:
      return `The tutor API request failed with HTTP ${status}.`;
  }
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim() !== '') {
    return payload;
  }
  if (!isRecord(payload)) {
    return null;
  }
  for (const key of ['message', 'error', 'detail', 'title'] as const) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return null;
}

function extractErrorCode(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }
  for (const key of ['code', 'errorCode'] as const) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }
  return null;
}

function httpError(status: number, payload: unknown): TutorApiError {
  return new TutorApiError({
    kind: 'http',
    status,
    code: extractErrorCode(payload),
    message: extractErrorMessage(payload) ?? defaultHttpErrorMessage(status),
    details: payload,
  });
}

function assertBookingId(bookingId: string): void {
  if (typeof bookingId !== 'string' || bookingId.trim() === '') {
    throw validationError('A non-empty booking ID is required.', 'bookingId');
  }
}

function assertEndInput(input: EndTutorSessionInput): void {
  if (
    !input ||
    (input.outcome !== 'COMPLETED' && input.outcome !== 'INTERRUPTED')
  ) {
    throw validationError(
      'Outcome must be COMPLETED or INTERRUPTED.',
      'outcome'
    );
  }
  if (
    input.description !== undefined &&
    (typeof input.description !== 'string' ||
      input.description.length > TUTOR_END_DESCRIPTION_MAX_LENGTH)
  ) {
    throw validationError(
      `Description must be a string of at most ${TUTOR_END_DESCRIPTION_MAX_LENGTH} characters.`,
      'description'
    );
  }
}

function assertFeedbackInput(input: TutorFeedbackInput): void {
  if (
    !input ||
    typeof input.rating !== 'number' ||
    !Number.isInteger(input.rating) ||
    input.rating < 1 ||
    input.rating > 5
  ) {
    throw validationError('Rating must be an integer from 1 to 5.', 'rating');
  }
  if (
    input.feedback !== undefined &&
    (typeof input.feedback !== 'string' ||
      input.feedback.length > TUTOR_FEEDBACK_MAX_LENGTH)
  ) {
    throw validationError(
      `Feedback must be a string of at most ${TUTOR_FEEDBACK_MAX_LENGTH} characters.`,
      'feedback'
    );
  }
}

async function resolveAuth(
  provider?: TutorAuthProvider
): Promise<TutorAuthCredentials | null> {
  if (!provider) {
    return null;
  }

  let credentials: TutorAuthCredentials;
  try {
    credentials = await provider();
  } catch (cause) {
    throw new TutorApiError({
      kind: 'auth',
      code: 'AUTH_PROVIDER_FAILED',
      message: 'Could not obtain tutor API credentials.',
      cause,
    });
  }

  if (
    !credentials ||
    typeof credentials.accessToken !== 'string' ||
    credentials.accessToken.trim() === '' ||
    typeof credentials.idToken !== 'string' ||
    credentials.idToken.trim() === ''
  ) {
    throw new TutorApiError({
      kind: 'auth',
      code: 'AUTH_CREDENTIALS_MISSING',
      message: 'The tutor auth provider must supply access and ID tokens.',
    });
  }
  if (
    credentials.tenantDomain !== undefined &&
    typeof credentials.tenantDomain !== 'string'
  ) {
    throw new TutorApiError({
      kind: 'auth',
      code: 'AUTH_CREDENTIALS_INVALID',
      message: 'The tutor tenant domain must be a string when provided.',
    });
  }

  return credentials;
}

function parseSessionDetails(payload: unknown, status: number): TutorSessionDetails {
  if (!isRecord(payload) || typeof payload.bookingId !== 'string') {
    throw invalidResponseError(
      status,
      'The tutor API returned an unexpected session response.',
      payload
    );
  }
  return payload as unknown as TutorSessionDetails;
}

function parseFeedback(
  payload: unknown,
  status: number
): TutorSessionFeedback {
  if (
    !isRecord(payload) ||
    typeof payload.bookingId !== 'string' ||
    typeof payload.rating !== 'number'
  ) {
    throw invalidResponseError(
      status,
      'The tutor API returned an unexpected feedback response.',
      payload
    );
  }
  return payload as unknown as TutorSessionFeedback;
}

export function createTutorApiClient(
  config: TutorApiClientConfig = {}
): TutorApiClient {
  const baseUrl = (config.baseUrl ?? '').trim().replace(/\/+$/, '');

  async function postJson(
    path: string,
    body: unknown,
    options?: TutorRequestOptions,
    method: 'POST' | 'GET' | 'DELETE' = 'POST'
  ): Promise<{ payload: unknown; status: number }> {
    if (options?.signal?.aborted) {
      throw abortError(options.signal.reason);
    }

    const headers = new Headers({ Accept: 'application/json' });
    if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    const credentials = await resolveAuth(config.auth);
    if (credentials) {
      headers.set('Authorization', `Bearer ${credentials.accessToken}`);
      headers.set('X-Id-Token', credentials.idToken);
      if (
        credentials.tenantDomain !== undefined &&
        credentials.tenantDomain.trim() !== ''
      ) {
        headers.set('X-Tenant-Domain', credentials.tenantDomain);
      }
    }

    let response: Response;
    try {
      // Resolve fetch per request so test interception (MSW) and host-provided
      // wrappers are not frozen at client construction time.
      const fetchImpl = config.fetchImpl ?? globalThis.fetch;
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: options?.signal,
      });
    } catch (cause) {
      throw isAbortCause(cause, options?.signal)
        ? abortError(cause)
        : networkError(cause);
    }

    let text: string;
    try {
      text = await response.text();
    } catch (cause) {
      throw isAbortCause(cause, options?.signal)
        ? abortError(cause)
        : networkError(cause);
    }

    let payload: unknown;
    if (text.trim() !== '') {
      try {
        payload = JSON.parse(text);
      } catch (cause) {
        if (!response.ok) {
          throw new TutorApiError({
            kind: 'http',
            status: response.status,
            code: null,
            message: defaultHttpErrorMessage(response.status),
            details: text,
            cause,
          });
        }
        throw invalidResponseError(
          response.status,
          'The tutor API returned a response that is not valid JSON.',
          text.slice(0, 500)
        );
      }
    }

    if (!response.ok) {
      throw httpError(response.status, payload);
    }

    return { payload, status: response.status };
  }

  return {
    baseUrl,

    async getCurrentBooking(month, options) {
      assertMonth(month);
      try { const result = await postJson(`/sse/v1/tutor/bookings/current?month=${encodeURIComponent(month)}`, undefined, options, 'GET'); return parseBooking(result.payload, result.status); }
      catch (error) { if (isTutorApiError(error) && error.kind === 'http' && error.status === 404) return null; throw error; }
    },
    async getAvailability(month, options) {
      assertMonth(month);
      const result = await postJson(`/sse/v1/tutor/availability?month=${encodeURIComponent(month)}`, undefined, options, 'GET');
      // Swagger describes a list but types 200 as one object. Accept either documented shape.
      const rows = Array.isArray(result.payload) ? result.payload : [result.payload];
      if (!rows.every(row => isRecord(row) && typeof row.slotId === 'string' && typeof row.startsAt === 'string' && typeof row.endsAt === 'string' && typeof row.eligible === 'boolean' && ['AVAILABLE','BOOKED'].includes(String(row.status)))) throw invalidResponseError(result.status, 'Unexpected availability response.', result.payload);
      return rows as TutorAvailability[];
    },
    async cancelBooking(bookingId, options) {
      assertBookingId(bookingId);
      const result = await postJson(`/sse/v1/tutor/bookings/${encodeURIComponent(bookingId)}`, undefined, options, 'DELETE');
      return parseBooking(result.payload, result.status);
    },
    async startSession(bookingId, options) {
      assertBookingId(bookingId);
      const result = await postJson(
        `/sse/v1/tutor/bookings/${encodeURIComponent(bookingId)}/session`,
        undefined,
        options
      );
      return parseSessionDetails(result.payload, result.status);
    },

    async endSession(bookingId, input, options) {
      assertBookingId(bookingId);
      assertEndInput(input);
      const body: EndTutorSessionInput = { outcome: input.outcome };
      if (input.description !== undefined) {
        body.description = input.description;
      }
      const result = await postJson(
        `/sse/v1/tutor/bookings/${encodeURIComponent(bookingId)}/session/end`,
        body,
        options
      );
      return parseSessionDetails(result.payload, result.status);
    },

    async submitFeedback(bookingId, input, options) {
      assertBookingId(bookingId);
      assertFeedbackInput(input);
      const body: TutorFeedbackInput = { rating: input.rating };
      if (input.feedback !== undefined) {
        body.feedback = input.feedback;
      }
      const result = await postJson(
        `/sse/v1/tutor/bookings/${encodeURIComponent(bookingId)}/feedback`,
        body,
        options
      );
      return parseFeedback(result.payload, result.status);
    },
  };
}
