# Ask Loka — Tavus React POC

A React proof of concept for a face-to-face AI learning session using Tavus Conversational Video Interface (CVI) and Daily's video SDK. It demonstrates a custom learning interface with a pre-call device check, live replica video, screen sharing, and streaming closed captions.

The UI is adapted from the [Tavus haircheck and conversation example](https://github.com/Tavus-Engineering/tavus-examples/tree/main/examples/cvi-ui-haircheck-conversation). Tavus UI components and hooks are copied into this project and customized locally.

## Start here

1. Install dependencies and start the app using [Run locally](#run-locally).
2. Open `http://localhost:5173/?demo` to explore the UI immediately. No API key, environment file, or backend is needed for the demo.
3. Read [How the app works](#how-the-app-works), then open `src/App.tsx` to see the screen flow.
4. Use [Where to make changes](#where-to-make-changes) to find the component relevant to your task.
5. For real AI responses, follow [Join a live conversation](#join-a-live-conversation).

## Tech stack

Versions below describe the dependency ranges in `package.json`; `package-lock.json` pins the installed versions. Use `npm ci` to reproduce them.

| Technology | Version / approach | Role in this repo |
| --- | --- | --- |
| React + React DOM | 19.1 | Renders screens and manages UI state with hooks |
| TypeScript | 5.8 | Checks component props, SDK calls, and event types |
| Vite + React plugin | Vite 7 | Local development, hot updates, and production bundling |
| Daily JS | `^0.80.0` | WebRTC call client: joining, leaving, media devices, and screen sharing |
| Daily React | `^0.22.0` | React provider, video/audio components, and hooks for Daily call state |
| Tavus CVI UI | Generated source | Starting components and event hooks copied into `src/components/cvi/` and customized here |
| CSS Modules | `*.module.css` | Component-scoped styling; `src/index.css` supplies global defaults |
| TanStack Query | v5 | Mutation state, scoped cache keys, and retry defaults for Tutor API calls |
| MSW + Vitest | MSW 2 / Vitest 5 | Opt-in HTTP mocks plus API and hook tests; not mounted in the app |
| ESLint | 9 | Static checks, including React hook rules |

**Tavus and Daily have different jobs:** Tavus runs the conversational AI and provides the replica stream and conversation events. Daily carries the real-time media and exposes browser call controls. This repository owns the React interface around them.

Jotai is also declared as a dependency. The entry flow uses React state; new contributors do not need to learn a separate application store to understand `App.tsx`.

## How the app works

```text
main.tsx
  └─ CVIProvider (wraps DailyProvider)
       └─ App.tsx
            ├─ URL form
            │    └─ HairCheck → Join → Conversation
            └─ ?demo → Conversation with demo=true
```

- **Entry:** `App.tsx` stores the pasted URL and current screen in memory. Reloading clears that state; `?demo` selects the demo screen on startup. There is no router.
- **Device check:** `HairCheck` starts the local camera/microphone preview and uses Daily device APIs for input/output selection. Speaker testing uses the browser's Web Audio API.
- **Joining:** `Conversation` calls `useCVICall`, which invokes Daily's `join({ url })`. The hook guards against joining again while already joining or joined.
- **Media rendering:** Daily video components render the replica, local camera, or shared screen. Daily audio handles remote sound. React state selects grid or speaker layout; screen sharing uses the presentation layout.
- **Captions:** `cvi-events-hooks.tsx` listens for Daily app messages. `use-closed-caption.tsx` consumes Tavus `conversation.utterance.streaming` events. The caption component displays the latest two visual lines and clears a final caption after a short delay.
- **Leaving:** The leave control calls Daily's `leave()` and returns to the URL form. Backend session termination is a separate integration step.

The active entry flow does not call the API helpers under `src/api/` or the Tutor client and hooks added in Plan 1. Session creation, screen wiring, and media integration remain outside this phase. Generated chat files remain in the repository but are not mounted in the conversation screen.

## Features

- Camera and microphone check before joining, with device selection and speaker test sound.
- Full-browser conversation layout with replica video, self-preview, participants, and session information.
- Microphone and camera toggles, device dropdowns, and hover tooltips.
- Camera tile stays visible with a placeholder when video is off.
- Speaker and grid layouts, plus a fullscreen control.
- Screen sharing with a presentation layout that keeps both camera previews visible. Grid switching is disabled while sharing.
- Closed captions showing the latest two lines in a fixed strip, keeping video size stable.
- Active speaker indicators, microphone status, elapsed session timer, and network information on hover.
- Demo mode for reviewing the layout without creating a Tavus conversation.

## Screenshots

### Pre-call device check

Preview your camera, select input and output devices, and test your speakers before joining.

![Camera and microphone check with device selectors](docs/screenshots/device-check.png)

### Speaker view

The replica takes the main stage, with your camera, participant status, and learning context in the sidebar. Captions appear below the main video.

![Live AI learning session in speaker view](docs/screenshots/speaker-view.png)

### Grid view

Display the replica and your camera side by side.

![Replica and learner camera displayed side by side](docs/screenshots/grid-view.png)

### Screen sharing

Shared content takes the main stage while the replica and your camera remain visible in the sidebar.

![Presentation view with shared screen and both camera previews](docs/screenshots/screen-sharing.png)

## Run locally

Use Node.js 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, usually http://localhost:5173. Camera, microphone, and screen sharing require browser permissions and a secure context such as localhost or HTTPS.

### Join a live conversation

1. Create an active Tavus conversation through your backend or existing integration.
2. Copy the exact `conversation_url` returned by that integration.
3. Paste it into the app's Conversation URL field.
4. Check your devices, then click **Join**.

The client joins through Daily's SDK, so provide the underlying SDK-compatible room URL. A Tavus Maker webpage link is not interchangeable with that room URL. Use the returned URL rather than constructing one from a conversation ID.

The entry flow does not create a backend session or ask for an API key. Keep Tavus credentials on your backend. This UI currently accepts a room URL only; rooms requiring a separate meeting token need additional join credential handling.

**Leave Session** disconnects the browser from the call. It does not call your backend to terminate the Tavus conversation.

### Preview without a live conversation

Open http://localhost:5173/?demo or select **Preview conversation UI (demo)** on the entry screen.

Demo mode shows a replica placeholder and sample captions. You can optionally enable your real camera and microphone to try the local preview and controls. It does not create a Tavus session or produce AI responses. The demo timer remains at `00:00`.

## Integration roadmap

Plan 1 is complete: a typed Tutor API client, reusable React Query hooks, deterministic MSW scenarios, and tests exist under `src/api/tutor.ts`, `src/hooks/tutor/`, and `src/mocks/`. None of it is mounted by the current screens, which still use local fixtures.

Next, build the Plan 2 session controller and a separate mock media adapter before connecting live APIs. See the [frontend integration plan](docs/frontend-integration-plan.md) for scope and validation scenarios, and [Tutor API client, hooks, and mocks](docs/frontend-api-and-mocks.md) for configuration, auth, retry semantics, and future wiring. MSW is installed as a dev dependency; browser mock startup is opt-in and `main.tsx` is unchanged.

## Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create a production build in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest API and hook tests with MSW Node |
| `npm run test:watch` | Run Vitest in watch mode |

## Project structure

```text
src/
  App.tsx                         # URL entry, device check, live call, and demo flow
  main.tsx                        # React entry point and CVIProvider
  api/tutor.ts                    # Typed Tutor API client (Plan 1, not mounted)
  hooks/tutor/                    # React Query mutation hooks, keys, and provider
  mocks/                          # MSW fixtures, scenarios, handlers, and bootstraps
  test/setup.ts                   # Vitest + Testing Library setup
  components/cvi/
    components/
      cvi-provider/               # Daily React context
      hair-check/                 # Pre-call preview and device settings
      conversation/               # Session layout and presentation/grid modes
      device-select/              # Media controls and device dropdowns
      closed-captions/            # Caption toggle and two-line display
    hooks/                        # Call lifecycle, devices, and Tavus event handling
docs/frontend-api-and-mocks.md    # API/hook/mock usage and future wiring
docs/screenshots/                 # README screenshots
```

Additional generated components and API helpers may exist in the source tree; the active conversation UI does not include chat.

## Where to make changes

Paths below are relative to the repository root. Component folders contain `index.tsx` and their associated CSS Module.

| Task | Start here |
| --- | --- |
| Change entry screen or switch between demo/live | `src/App.tsx` |
| Change pre-call device check | `src/components/cvi/components/hair-check/` |
| Change session header, sidebar, grid, or presentation layout | `src/components/cvi/components/conversation/` |
| Change mic, camera, screen-share controls or dropdowns | `src/components/cvi/components/device-select/` |
| Change caption appearance or CC button | `src/components/cvi/components/closed-captions/` |
| Change caption event handling / clear delay | `src/components/cvi/hooks/use-closed-caption.tsx` |
| Change join/leave behavior or add meeting-token support | `src/components/cvi/hooks/use-cvi-call.tsx` |
| Change device initialization | `src/components/cvi/hooks/use-start-haircheck.tsx` |
| Inspect Tavus event types and subscription helpers | `src/components/cvi/hooks/cvi-events-hooks.tsx` |
| Change Tutor API calls, auth headers, or errors | `src/api/tutor.ts` |
| Change Tutor mutation hooks, retry defaults, or cache keys | `src/hooks/tutor/` |
| Change mock scenarios, fixtures, or MSW bootstraps | `src/mocks/` |
| Change global styles | `src/index.css` |

Edit generated Tavus files like normal application source. Re-running the Tavus component generator can replace local customizations, so inspect its proposed changes before accepting replacements.

### Check your changes

Run `npm run build` for TypeScript and production bundling, `npm run lint` for static checks, and `npm test` for the Vitest/MSW API and hook suites. Add or update MSW Node tests when changing the Tutor client, hooks, or scenarios.

For UI changes, check the following manually:

- Open demo mode and toggle captions, grid view, and fullscreen.
- Enable devices, mute/unmute, and switch the camera off/on. The camera tile should retain its size.
- Resize to desktop and mobile widths; verify captions and controls stay readable.
- With an active conversation, verify two-way audio, streaming captions, and screen sharing. Stop sharing and confirm the normal layout returns.

Demo mode verifies layout and local media controls. It does not verify backend session creation, remote media, real AI responses, or live caption events.

## Implementation notes

- **Stack:** React 19, TypeScript, Vite, CSS Modules, `@daily-co/daily-react`, and `@daily-co/daily-js`.
- **Tutor API layer:** Plan 1 ships a typed client, React Query hooks, and opt-in MSW mocks. They are not mounted by screens yet; see `docs/frontend-api-and-mocks.md`.
- **Media:** Daily supplies camera, microphone, screen tracks, and participant state; React components control their layout.
- **Captions:** Tavus streaming utterance events feed the caption display. Live captions depend on the session emitting these events.
- **Branding:** “Ask Loka” and “Data Wrangling with SQL” are currently hard-coded demonstration labels, not backend course metadata.
- **Scope:** This is a frontend proof of concept. Booking, authentication, session creation, and backend session termination belong to the integrating application.

## Troubleshooting

- **Room fails to join:** Check that the room URL is correct and the conversation is still active. Obtain a fresh session when necessary.
- **No camera or microphone:** Check browser and operating-system permissions and select an available device.
- **No captions:** Enable the CC control and verify that the live session emits streaming utterance events.
- **Screen sharing stops:** Re-select a screen, window, or tab through the browser's sharing prompt. Ending sharing restores the regular layout.
