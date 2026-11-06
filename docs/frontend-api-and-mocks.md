# Tutor API client, React Query hooks, and MSW mocks

Status: implemented (Plan 1). Screens, the session controller, and media
integration remain out of scope. Providers and opt-in development MSW are now mounted for the mock session flow; see Current wiring below.

Contract source: [SSE Service OpenAPI](https://api.dev.adroit-lms.com/doc/sse-service/v3/api-docs),
reviewed 2026-11-06. The service does **not** expose a GET endpoint for a
booking's session details; do not add one on the client.

## What is included

- `src/api/tutor.ts` — typed client for start, end, and feedback mutations.
- `src/hooks/tutor/` — TanStack Query mutation hooks, scoped keys, and the API
  client provider.
- `src/mocks/` — deterministic MSW fixtures, scenarios, handlers, and opt-in
  browser/Node bootstraps.
- `public/mockServiceWorker.js` — generated MSW worker (browser mock mode only).
- API tests (`src/api/tutor.test.ts`) and hook tests
  (`src/hooks/tutor/use-tutor-mutations.test.tsx`).

## API client

```ts
import {
  createTutorApiClient,
  isTutorApiError,
} from '@/api/tutor';

const tutorApi = createTutorApiClient({
  // Same origin by default. Point this at the gateway in a real deployment.
  baseUrl: import.meta.env.VITE_SSE_API_BASE_URL ?? '',
  // Called for every request so the host LMS can refresh tokens.
  auth: async () => {
    const hostSession = await getHostLmsSession(); // host-owned integration
    return {
      accessToken: hostSession.accessToken,
      idToken: hostSession.idToken,
      tenantDomain: hostSession.tenantDomain, // optional
    };
  },
});
```

The auth provider supplies raw tokens. The client adds `Authorization: Bearer
<accessToken>`, `X-Id-Token: <idToken>`, and (when present)
`X-Tenant-Domain: <tenantDomain>`. It never stores, logs, or hard-codes
credentials. Omit the provider in mock mode.

```ts
const session = await tutorApi.startSession(bookingId);

await tutorApi.endSession(bookingId, {
  outcome: 'COMPLETED', // or 'INTERRUPTED'
  description: 'Optional context, up to 2000 characters.',
});

const feedback = await tutorApi.submitFeedback(bookingId, {
  rating: 5, // integer 1–5
  feedback: 'Optional comment, up to 2000 characters.',
});
```

Client-side validation rejects invalid booking IDs, outcomes, descriptions,
ratings, and over-long feedback before any request is sent. Network errors and
HTTP errors are normalized into `TutorApiError`:

```ts
try {
  await tutorApi.startSession(bookingId);
} catch (error) {
  if (isTutorApiError(error)) {
    // kind: 'http' | 'network' | 'aborted' | 'validation' | 'auth' | 'invalid-response'
    // status: number | null
    // code: provider code when present
    // details: parsed error payload
  }
}
```

Abort support is passed through to `fetch` and surfaces as a normalized
`aborted` error:

```ts
const controller = new AbortController();
const pending = tutorApi.startSession(bookingId, {
  signal: controller.signal,
});
controller.abort();
```

The client checks for a JSON object response but intentionally does not
re-implement full OpenAPI schema validation. Non-JSON or non-object success
bodies become `invalid-response` errors.

## React Query hooks

Files:

- `src/hooks/tutor/query-keys.ts` — stable keys and mutation keys.
- `src/hooks/tutor/tutor-api-context.ts` — context and accessor hooks.
- `src/hooks/tutor/tutor-api-provider.tsx` — `TutorApiProvider`.
- `src/hooks/tutor/use-tutor-mutations.ts` — start, end, and feedback hooks.

Future wiring (not applied to the current app):

```tsx
const queryClient = new QueryClient();
const tutorApi = createTutorApiClient({
  baseUrl: import.meta.env.VITE_SSE_API_BASE_URL ?? '',
  auth: hostAuthProvider,
});

<QueryClientProvider client={queryClient}>
  <TutorApiProvider client={tutorApi}>
    <SessionFlow />
  </TutorApiProvider>
</QueryClientProvider>;
```

Inside a component or controller:

```tsx
const start = useStartTutorSession();
const end = useEndTutorSession();
const submitFeedback = useSubmitTutorFeedback();

const session = await start.mutateAsync({ bookingId });
const ended = await end.mutateAsync({
  bookingId,
  outcome: 'COMPLETED',
});
await submitFeedback.mutateAsync({ bookingId, rating: 5 });
```

Each hook also accepts a `client` option, so an isolated test or controller can
bypass the provider. Passing a signal in the mutation variables cancels the
request; late responses are not cached.

Cache behavior:

- `tutorQueryKeys.session(bookingId)` is seeded from successful start and end
  responses.
- `tutorQueryKeys.feedback(bookingId)` is seeded from a successful feedback
  response.
- These are cache slots, not fetchers. There is no GET session endpoint and no
  `useQuery` wrapper pretending one exists.
- Mutation keys are stable for devtools and future invalidation.

Retry semantics:

- **Start:** automatically retries only HTTP 409 ("conversation creation in
  progress"), at most two retries. The service documents that repeated starts
  reuse the same conversation.
- **End:** no automatic retries. A failure stays visible so leaving can be
  retried deliberately.
- **Feedback:** no automatic retries. The service accepts feedback once, so
  retrying a response of unknown outcome could create a duplicate-submission
  error.

## Duplicate and retry scope

These hooks do **not** deduplicate concurrent mutations. TanStack Query runs
each `mutate`/`mutateAsync` call it receives; two concurrent start clicks can
therefore issue two requests (the backend reuses the conversation). The test
suite documents this behavior explicitly.

Click/debounce/idempotency guards, stale-response rejection, and the decision to
retry an end request belong to the Plan 2 `useTutorSession` controller, not to
this reusable API layer. The MSW store still enforces one successful feedback
submission and returns `409 FEEDBACK_ALREADY_SUBMITTED` on a second one.

## MSW browser mock mode (opt-in)

In development, `main.tsx` awaits the worker before rendering when the URL has
`?mock=1` or the env flag is set:

```tsx
const mocks = import.meta.env.DEV &&
  (new URLSearchParams(window.location.search).get('mock') === '1' ||
    import.meta.env.VITE_ENABLE_TUTOR_MOCKS === 'true');
if (mocks) {
  const { startTutorMocks } = await import('./mocks/browser');
  await startTutorMocks();
}
```

Set the flag in an untracked `.env.local`:

```sh
VITE_ENABLE_TUTOR_MOCKS=true
# In mock mode the app uses baseUrl ''; handlers match tutor paths on any origin.
```

`startTutorMocks()` awaits service-worker registration, bypasses unhandled
requests, and intercepts only the supported tutor paths. It does not touch
Daily/Tavus provider or media traffic. `stopTutorMocks()` is available for
teardown.

`createTutorMockWorker({ store })` and `startTutorMocks({ store })` allow an
isolated scenario store. `tutorMockStore` is the shared browser store.

Scenario controls:

```ts
import { tutorMockStore } from '@/mocks/browser';

tutorMockStore.setScenario({ start: 'slow-success', slowDelayMs: 300 });
tutorMockStore.reset(); // back to the initial scenario, fresh counters
tutorMockStore.snapshot(); // scenario + attempts + ended/submitted state
```

| Endpoint | Scenarios |
| --- | --- |
| Start | `success`, `slow-success`, `conflict-then-success` (one 409, then success), `not-found` (404), `outside-window` (422), `unavailable` (503), `network-error` |
| End | `success`, `fail-once` (503 on the first attempt, success on retry), `unavailable` (503) |
| Feedback | `success` (after an ended session; second submission gets 409), `validation-error` (400), `duplicate` (409) |

Feedback success requires an ended session. Call the end endpoint first, or use
`store.markEnded()` in a focused test. A reset starts active and unrated.

Fixtures use a fixed default clock (`2027-03-20T05:00:00.000Z`), a ten-minute
window, a synthetic meeting token, and a `mock-media.invalid` URL. That URL is
not a Daily room and must never be joined. No fake Daily joins are attempted.

## MSW in Node tests

```ts
import { createTutorMockServer } from '@/mocks/node';

const { server, store } = createTutorMockServer({
  baseUrl: 'https://sse.test',
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => store.reset());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

The test suite uses Vitest with jsdom and `@testing-library/react` for
`renderHook`. Hook tests render under `QueryClientProvider` plus
`TutorApiProvider`.

Tooling note: the project uses MSW 2.15 because MSW 3 requires TypeScript
>= 5.9 while this repository pins TypeScript 5.8. The handler and worker APIs
used here follow the MSW 2 documentation.

## Commands

```sh
npm test           # Vitest, MSW Node, Testing Library
npm run test:watch
npm run lint
npm run build      # TypeScript project build + Vite production bundle
```

## Deferred

- Plan 2 session controller: duplicate-request prevention, retry limits across
  a full flow, stale-response handling, and media integration.
- Mock media adapter and any Daily/Tavus join behavior.
- Screen mounting, provider wiring in `main.tsx`, and UI state.
- Browser end-to-end coverage of mock mode (the bootstrap is provided but not
  mounted).
- Full OpenAPI schema validation and automatic token refresh (the host owns
  refresh through the provider).

## Booking reads and cancellation (follow-up)

Implemented without mounting providers or connecting screens:

- `client.getCurrentBooking(month, { signal })`: GET current monthly booking; 404 means `null`, other errors remain errors.
- `client.getAvailability(month, { signal })`: GET monthly availability, normalized to an array. The published schema shows a singleton while its description says list; both shapes are accepted and malformed rows rejected.
- `client.cancelBooking(bookingId, { signal })`: DELETE booking; no automatic retry.
- `useCurrentTutorBooking(month, { client?, enabled? })` and `useTutorAvailability(month, options)` use cancellable React Query reads with retries disabled.
- `useCancelTutorBooking({ client? })` updates the returned booking's monthly cache and invalidates availability. A cancelled booking remains the monthly entitlement record.

Use a fresh QueryClient per authenticated tenant/user session and clear it on identity changes; keys are scoped by month/booking within that client, not globally by authenticated identity.

MSW adds `booking`: success/empty/unavailable/network-error; `availability`: success/empty/unavailable; `cancel`: success/cutoff/not-found/unavailable. The injected store clock enforces the 24-hour cancellation cutoff (exactly 24 hours is allowed). Set the clock to before the cutoff for cancellation-success tests. Reset clears cancellation state. Existing lifecycle scenarios remain available.

Shared synthetic fixture: `src/fixtures/tutor.ts`. Screen date metadata and MSW defaults now use 20 March 2027, 05:00–05:10 UTC (1:00–1:10 PM SGT). The second ready card is a visual scenario override, not a second real monthly entitlement. Explicit session fixture clock overrides remain supported. Do not compare the fixed mock clock to the real wall clock to infer eligibility.

No learner-history endpoint or GET session-by-ID endpoint is invented. Completed history remains local sample data. Calendar graphics and labels are presentation; future integration must format API dates dynamically. Backend enrollment/auth checks remain authoritative.

## Current wiring

The dedicated ready route uses `useTutorSession` when `?mock=1` is present in development (or VITE_ENABLE_TUTOR_MOCKS=true). main.tsx awaits MSW then mounts QueryClientProvider and TutorApiProvider. The controller handles duplicate joins, stale preparation responses, mock-media joining, local disconnect, and backend end with manual recovery. It does not yet consume real provider lifecycle events.

Confirmed Leave waits for mocked end success, then navigates in-app to homepage feedback carrying booking ID and duration. Feedback submits actual rating/comments through useSubmitTutorFeedback. Failure retains the form; success closes it and shows the toast. Early leave currently maps to COMPLETED plus an early-exit description; final product/backend mapping needs agreement.

No real backend authentication or media adapter is connected to the dedicated session route. No timeout enforcement or automatic completed/interrupted transition is implemented. Dashboard reads/cancellation are still local UI behavior. Other opt-in bootstrap and deferred notes above describe the API layer before this wiring and should be read with this section.
