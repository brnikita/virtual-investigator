# PLAN.md — Build plan for Virtual Investigator

This is the ordered, agent-executable build plan. Each step has a clear goal,
a list of files to touch, and an acceptance check. Work top-to-bottom; do not
skip prerequisites.

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done.

---

## Phase 0 — Local dev loop is green

Goal: a fresh clone can `npm install && npm run dev` and see the landing page.

- [x] **0.1 Repo skeleton.** Configs, package.json, tsconfig, tailwind, eslint,
  prettier, gitignore, editorconfig. (Done at scaffold time.)
- [x] **0.2 Empty UI shell.** Landing page renders, `npm run typecheck` passes
  on the stubs.
- [x] **0.3 Install + boot.** Run `npm install`, then `npm run dev`. Open
  http://localhost:3000 and see the landing page. Fix any package-version
  drift (Next 15 + React 19 are still moving fast).
  - Acceptance: dev server boots without errors; landing renders.
  - Verified: typecheck/lint clean; dev server bound to :3001 (3000 was in use)
    and responded 200 with the RU landing page.
- [x] **0.4 Local Supabase.** `supabase start`, then `supabase db reset` to apply
  the two migrations. Open Studio (`:54323`) and confirm tables + RLS exist.
  Run `npm run db:types` to overwrite the placeholder
  `src/lib/supabase/database.types.ts`.
  - Acceptance: typed Supabase calls in `src/lib/supabase/*` compile against
    the regenerated types.
  - Diverged: Supabase running on alt ports (Studio :64323). Had to cast
    `DossierPayload` to `Json` in `compose/route.ts` since the typed
    interface isn't structurally an index signature.

---

## Phase 1 — Auth + case lifecycle

Goal: a user can log in, create a case, and see it in their list.

- [x] **1.1 Magic-link login.** Implement `src/app/(auth)/login/page.tsx` with a
  small client-side form calling `supabase.auth.signInWithOtp`. The callback
  route (`(auth)/callback/route.ts`) is already wired.
  - Acceptance: end-to-end login on localhost using a real email.
  - Diverged: redirect target is `/callback` (not `/auth/callback`) because the
    `(auth)` route group is invisible in the URL. Verified by triggering OTP
    against local Supabase and seeing the magic-link email land in Mailpit.
- [x] **1.2 Auth gate via middleware.** Extend `src/middleware.ts` to redirect
  unauthenticated users hitting `/(game)/*` to `/login?next=...`.
  - Acceptance: `/new` while logged out redirects to `/login`.
  - Verified via curl: `/new` and `/cases` both 307 to `/login?next=...`.
- [x] **1.3 Profile bootstrap.** On first sign-in, upsert a `profiles` row
  (display_name = email local-part, preferred_language = 'ru').
  - Done in `src/app/(auth)/callback/route.ts` after exchangeCodeForSession.
    Uses `onConflict: 'id', ignoreDuplicates: true` so re-logins don't clobber
    a name/language the user later edits.
- [x] **1.4 Create case.** Implement the form in `src/app/(game)/new/page.tsx`
  with a server action that inserts into `cases` and redirects to
  `/case/<id>/interview`.
  - Acceptance: insert succeeds; new row visible in Studio.
  - Server-rendered form + zod-validated server action `createCase`. Sets
    owner_id explicitly from the session (matches the RLS policy on `cases`).
    Default language seeded from `profiles.preferred_language`.
- [x] **1.5 My cases list.** Add a `/cases` route showing all of the user's
  cases with status badges. Link from header.
  - Server-rendered list ordered by created_at desc with bilingual status
    badges. Header.tsx now bilingual (RU/EN inline) and mounted from
    `src/app/layout.tsx` so it appears site-wide.

---

## Phase 2 — Realtime voice loop (no avatar yet)

Goal: the user can talk to the detective via voice; transcript appears in
real time; tool calls land in the database.

- [x] **2.1 Ephemeral key wiring.** `RealtimeClient` calls
  `/api/realtime/session`, gets `client_secret`, opens an
  `RTCPeerConnection`, attaches the mic from `getUserMedia`, and exchanges
  SDP with `https://api.openai.com/v1/realtime?model=...`.
  - Reference: https://platform.openai.com/docs/guides/realtime-webrtc
  - Acceptance: data-channel events stream in the dev console.
  - Diverged: `/api/realtime/session` now also echoes `model` and
    `maxInterviewSeconds` so the client can target the right SDP endpoint
    and arm the cost-cap timer (used in 2.4) without a second round-trip.
    AvatarBus stub created early as `src/lib/avatar-bus.ts` so the Phase 3
    wiring is purely additive — Phase 2 only emits a `remote_track` event.
- [x] **2.2 Transcript bus.** Route `response.audio_transcript.delta` (assistant)
  and `conversation.item.input_audio_transcription.completed` (user) into a
  `TranscriptBus`. Render in `TranscriptPanel`.
  - Acceptance: live captions in both directions.
  - Diverged: also routes `response.audio_transcript.done` so the panel can
    swap a delta-built bubble for the authoritative final transcript.
    Interview page now loads the dictionary server-side and passes label
    props into both client components — keeps i18n strings out of client
    bundles and out of the realtime hot path.
- [x] **2.3 Tool dispatch.** Handle `response.function_call_arguments.done` for
  `record_evidence` and `finish_interview`. For `record_evidence`, POST to a
  new route `POST /api/evidence` (create stub) that inserts into `evidence`.
  For `finish_interview`, stop the peer and call
  `/api/interview/:id/finalize`.
  - Acceptance: ending the interview creates a `messages` summary row and
    flips the case to `ready`.
  - Diverged: case-flip-to-ready and the summary `messages` row now both
    live in step 2.5 (finalize route body). 2.3 ships only the client-side
    dispatch + `/api/evidence` route. The route upserts on `(case_id, key)`
    so re-asks of the same fact stay one row, and writes a `tool` breadcrumb
    in `messages` keyed to the active interview.
- [x] **2.4 Hard cap on interview length.** `RealtimeClient` enforces
  `MAX_INTERVIEW_SECONDS` with a `setTimeout`. UI shows a countdown in the
  last 60 seconds.
  - Diverged: `MAX_INTERVIEW_SECONDS` is read from the
    `/api/realtime/session` response (already wired in 2.1) so the client
    doesn't need a second config endpoint. Defense-in-depth check added to
    the finalize route: rejects with 409 if the active interview's
    `started_at` is older than `MAX + 30s`.
- [x] **2.5 Interview metrics.** Persist `started_at`, `ended_at`,
  `duration_seconds`, and a `cost_estimate_usd` computed from the audio
  duration on `interviews`.
  - Diverged: finalize URL switched from `:caseId` to `:interviewId`. The
    new `/api/interview/start` route inserts the row, flips the case to
    `interviewing`, and returns `{ interviewId }` which RealtimeClient
    holds for the lifetime of the peer. Finalize is idempotent, caps
    duration at `MAX_INTERVIEW_SECONDS` so a misbehaving client can't
    inflate the bill, and writes a `system` summary row in `messages`.

---

## Phase 3 — Cartoon avatar (Simli)

Goal: while the detective speaks, a friendly animated face syncs lips and
appears live in `AvatarStage`.

- [~] **3.1 Simli account + face id.** Create a Simli account, choose a
  friendly cartoon face, store `SIMLI_FACE_ID` in env. Document choice in
  `docs/PROMPTS.md`.
  - blocked: needs Simli dashboard signup (human-only). `.env.local` carries
    placeholder values for `SIMLI_API_KEY`/`SIMLI_FACE_ID` so the rest of
    Phase 3 ships dry; live streaming will succeed once the human swaps in
    real credentials.
- [x] **3.2 AvatarBus.** Create `src/lib/avatar-bus.ts` — a tiny EventTarget
  that lets `RealtimeClient` push audio chunks (PCM16 24 kHz Int16Array) and
  `AvatarStage` subscribe.
  - Diverged: bus carries the whole `MediaStreamTrack` (one `remote_track`
    event) plus an `end` signal — no per-frame events. Consumer attaches its
    own `MediaStreamTrackProcessor` so the realtime hot path stays free of
    audio decoding. Stub from Phase 2.1 already matched the final shape; only
    the doc comment changed in this step.
- [x] **3.3 Simli session bootstrap.** `AvatarStage` fetches
  `/api/simli/session` and calls `startAvatar`.
  - Diverged: AvatarStage also owns the audio bridge from realtime track
    to Simli — `MediaStreamTrackProcessor` reads Float32 frames at 24 kHz,
    we convert to Int16 and push through the controller (downsampling to
    16 kHz happens inside the controller). Safari (no MSTP) falls back to
    mounting the realtime track on the visible <audio> element and
    surfacing a one-line "no lip-sync" notice. Session-fetch failures
    show an "avatar offline" chip but don't crash the rest of the page.
- [x] **3.4 Wire the audio pipeline.** Replace the throw in
  `src/lib/simli/client.ts` with a real implementation using `simli-client`.
  Use `pipeline.downsamplePcm24kTo16k` to convert frames before pushing.
  - Acceptance: lips move in time with the detective's voice; latency
    < 1.5 s on first turn, < 800 ms on subsequent turns.
  - Diverged: SDK is `simli-client@1.2.5`. We use `new SimliClient()` +
    `Initialize({ apiKey, faceID, handleSilence: true, maxSessionLength,
    maxIdleTime, videoRef, audioRef, SimliURL: '' })` + `start()`. Audio
    feed is `sendAudioData(Uint8Array)` over the resampled Int16 buffer;
    `flush()` maps to `ClearBuffer()`; `stop()` to `close()`. Latency
    target unverified (no live Simli account in this env — see 3.1).
- [ ] **3.5 Idle state.** When no audio is flowing for > 1 s, the avatar idles
  (Simli does this itself — verify).

---

## Phase 4 — Photo capture and uploads

Goal: the suspect provides a photo via webcam or file upload; it's stored
privately and used as a hint for the portrait generator.

- [ ] **4.1 WebcamCapture.** Implement `getUserMedia({ video: true })`,
  capture a frame to canvas, POST to `/api/evidence/upload` as
  `kind=suspect_photo`. Show a retake-or-keep dialog.
- [ ] **4.2 File upload.** Drag-and-drop + file picker in `EvidenceUploader`,
  hitting the same endpoint.
- [ ] **4.3 Signed-URL helper.** Add a server util that returns a 60-s signed
  URL for an attachment, used by the dossier editor and PDF renderer.

---

## Phase 5 — Dossier composition + portrait + print

Goal: when the interview ends, the dossier is composed, the cartoon portrait
is generated, and the user can print or download.

- [ ] **5.1 Compose flow.** After `finish_interview`, the client calls
  `POST /api/dossier/:id/compose` (already implemented stub) and renders the
  result in the dossier overview page.
- [ ] **5.2 PDF renderer.** Implement `src/lib/pdf/render.ts` with
  `@react-pdf/renderer`. The component must mirror the visual structure of
  `samples/Nastya/*.png`: header + stamps, photo card (left), identity
  table (right), observations block, danger-scale, exhibits, last-seen,
  footer. Wire `/api/pdf/:caseId` to stream the bytes.
- [ ] **5.3 Portrait generation.** Add a "Generate portrait" button on the
  dossier page that calls `POST /api/dossier/:id/generate-image` with
  `appearanceNotes` derived from the `appearance` evidence rows. Show a
  loading state and replace the placeholder when done.
- [ ] **5.4 Inline editor.** Implement `DossierEditor` so the user can fix
  the composer's mistakes. Save back to `dossiers.payload`.
- [ ] **5.5 Journal page.** `/journal` lists every "ready" dossier as a
  `PrintableSheet` separated by `.page-break`. The browser Print dialog
  produces the booklet.

---

## Phase 6 — Polish

- [ ] **6.1 i18n round-trip.** Confirm RU and EN flow end-to-end (case
  language drives interview language drives composer language).
- [ ] **6.2 Empty / error states.** Friendly messages when the user has no
  cases, mic is denied, image gen fails, etc.
- [ ] **6.3 Cost display.** Show running cost estimate in the interview
  HUD; cap message at the limit.
- [ ] **6.4 Lighthouse pass.** Aim for ≥ 90 on Best Practices and
  Accessibility.
- [ ] **6.5 README + screenshots.** Refresh `README.md` with screenshots of
  the live interview and a printed journal page.

---

## Phase 7 — Production deploy

- [ ] **7.1 Supabase project.** Create a hosted project. Run
  `supabase link --project-ref <ref>` then `supabase db push`.
- [ ] **7.2 Vercel project.** Import the repo, add env vars from
  `.env.example`, deploy.
- [ ] **7.3 Auth redirects.** Add the production URL and Vercel preview
  wildcard to Supabase Auth → URL Configuration.
- [ ] **7.4 Production smoke test.** Full flow on the deployed URL with a
  real OpenAI key. Confirm cost stays under $1.

---

## Discovered work

> Append items found mid-build that didn't fit the plan above. Don't reorder
> the existing phases.

- (none yet)
