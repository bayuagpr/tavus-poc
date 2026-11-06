# Frontend integration plan

Status: Plan 1 implemented 2026-11-06. Plans 2–3 remain deferred. MSW is installed
as a dev dependency, but mock mode is not mounted in the app and no screens were
changed. See [Tutor API client, React Query hooks, and MSW mocks](frontend-api-and-mocks.md)
for usage.

## Approach

Start with Mock Service Worker (MSW) for LMS HTTP requests. Build the complete frontend lifecycle locally before connecting live backend mutations or creating Tavus conversations.

The host LMS is expected to supply authentication, course metadata, learner identity, and a booking ID. Booking, availability, cancellation, and admin screens are outside this phase. Backend implementation is also outside scope.

## Target flow

```text
Device check → Preparing → Joining → Connected → Leaving → Completion → Feedback
                  ↓           ↓          ↓           ↓
              Recoverable errors and explicit retry/reconnect states
```

Track backend session status separately from the Daily connection. A disconnected browser does not prove that the backend conversation ended.

## Plan 1: Typed API client and MSW — implemented

Delivered on 2026-11-06:

- `src/api/tutor.ts`: configurable base URL, per-request auth provider
  (`Authorization`, `X-Id-Token`, optional `X-Tenant-Domain`), normalized
  errors, abort support, and local request validation. No GET session endpoint
  was invented.
- `src/hooks/tutor/`: reusable start/end/feedback mutation hooks, stable
  scoped keys, cache updates, conservative retry semantics, and a
  `TutorApiProvider` plus per-hook client injection. Not mounted by the app.
- `src/mocks/`: deterministic fixtures, stateful scenarios, browser/Node
  bootstraps, and the generated service worker. The browser bootstrap is
  callable but opt-in and not referenced from `main.tsx`.
- `src/api/tutor.test.ts` and `src/hooks/tutor/use-tutor-mutations.test.tsx`:
  MSW Node + Vitest coverage for success, slow/abort, 409 retry, 404/422/503,
  network failure, end retry, feedback validation/duplicate, auth headers, and
  duplicate-mutation scope.
- `npm test`, `npm run lint`, and `npm run build` are the verification
  commands.

The UI, session controller, and media adapter were intentionally left out.
Concurrent mutation calls are not deduplicated; that guard belongs to Plan 2.

### Task 1: Define the API boundary

Proposed file: `src/api/tutor.ts`.

| Operation | Endpoint | Contract |
| --- | --- | --- |
| Start | `POST /sse/v1/tutor/bookings/{bookingId}/session` | Returns booking/conversation IDs, name, URL, meeting token, status, UTC start/end |
| End | `POST /sse/v1/tutor/bookings/{bookingId}/session/end` | Send `outcome`: `COMPLETED` or `INTERRUPTED`, plus optional description |
| Feedback | `POST /sse/v1/tutor/bookings/{bookingId}/feedback` | Rating 1–5, optional feedback up to 2000 characters |

Use a configurable base URL and a host-supplied authentication adapter. The reviewed gateway contract uses `Authorization`, `X-Id-Token`, and conditionally `X-Tenant-Domain`. Mock mode requires no real credentials. Normalize errors rather than assuming error payloads match success schemas.

Contract source: [SSE Service OpenAPI](https://api.dev.adroit-lms.com/doc/sse-service/v3/api-docs), reviewed 2026-11-06. Recheck before implementation.

### Task 2: Add opt-in mock scenarios

Proposed files: `src/mocks/browser.ts`, `handlers.ts`, `fixtures.ts`, and `scenarios.ts`.

Start the development worker before rendering when explicitly enabled. Keep mock startup out of normal production execution. Do not intercept provider/media traffic. Use synthetic identities and fake credentials, and reset scenario state predictably.

Scenarios:

- Start success with token and booking times generated relative to the scenario clock.
- Slow preparation; start `409` followed by success with bounded retries.
- Start `404` booking unavailable, `422` outside window, `503` unavailable, and network failure.
- End success, failure, and retry.
- Feedback success, validation failure, and `409` duplicate/not-ended.

Success: all client response/error paths can be exercised without a backend or real credentials.

## Plan 2: Session controller and media integration

### Task 1: Add `useTutorSession`

Own start/end requests, credentials in memory, loading/errors, duplicate-request prevention, cancellation, and retry limits. Run the device check before creating a backend conversation. Start once on Join. Treat `409` as preparation, not an immediate fatal error. Prevent late responses from joining after cancellation. Respect the backend's documented reuse of a conversation on repeated starts.

### Task 2: Add a media boundary

Extend `useCVICall` to accept both `conversationUrl` and `meetingToken`. Keep manual URL entry as a development path only. Never persist or log join credentials; Tavus API keys remain server-side.

**MSW mocks HTTP, not WebRTC.** Fake room URLs cannot successfully join Daily. Add a separate mock media adapter for joining, connection errors, remote ending, simulated participants, and caption events. It must not attempt provider joins with fake URLs.

| Mode | HTTP | Media |
| --- | --- | --- |
| Existing visual demo | None | Placeholder and optional local preview |
| Mock integration | MSW | Mock media adapter and optional local preview |
| Live integration | Real LMS API | Daily/Tavus |

Success: the full start/join flow works locally, credentials reach the live adapter correctly, and duplicate clicks or stale responses cannot trigger duplicate joins.

## Plan 3: Dynamic screens and completion

### Task 1: Replace hard-coded metadata

| UI data | Source |
| --- | --- |
| Course title and description | LMS course context |
| Learner name/avatar | LMS user context |
| Tutor display name | Configuration; Loka can remain intentional branding |
| Session IDs, schedule, URL/token | Start API response |
| Remaining time | Calculate from backend `endsAt` and current clock |
| Connected elapsed time | Local connection timing, labeled separately if retained |
| Participants, mic status, active speaker, sharing | Media adapter / Daily |
| Captions | Mock events or Tavus streaming utterances |
| Caption language | Session configuration; omit if unknown |
| Completion and feedback state | End/feedback API results |

Frontend timers display the deadline; backend enforcement remains authoritative.

### Task 2: Complete leaving and feedback

Stop local media promptly and request backend termination. Expose termination failures with retry rather than claiming success. Show feedback after confirmed completion. Distinguish voluntary exit, transient disconnect, provider ending, and booking expiry. Agree how these map to end outcomes before live rollout.

Browser-unload requests cannot guarantee termination. Backend timeout/callback reconciliation is required separately.

### Task 3: Validate behavior

Use focused API/controller tests with MSW and the mock media adapter. Cover duplicate joins, retry limits, stale responses, cancellation during preparation, deadlines, end failures, and feedback errors.

Manually check desktop/mobile layout, keyboard/focus/tooltips, camera-off tile stability, two-line captions, grid/fullscreen, and presentation mode. Later verify authenticated joins, two-way audio, real caption events, screen sharing, and backend termination with an active conversation.

Success: metadata is supplied through typed inputs, mock scenarios are usable, layout stays stable, and errors have recovery paths.

## Confirm before connecting live services

- How the LMS supplies and refreshes credentials.
- Learner-accessible source for course/tutor/language metadata.
- Session recovery after refresh and behavior when a repeated start returns an ended conversation.
- Whether leaving ends immediately or permits reconnect.
- Authoritative deadline and clock-offset handling.
- Mapping UI exit reasons to `COMPLETED` / `INTERRUPTED`.
- Whether live sessions emit the streaming caption events used by this UI.

These do not block mock development. Record assumptions explicitly in fixtures until confirmed.

## Next step

Implement Plan 2: the `useTutorSession` controller and media boundary. Plan 1
is complete; do not extend the API layer with screen-specific behavior. Keep
duplicate-request prevention, stale-response handling, and cross-request retry
limits in the controller rather than in the reusable mutation hooks.
