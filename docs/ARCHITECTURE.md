# Architecture

## Components

### Browser

- **Next.js 15 App Router**, React 19, TypeScript, Tailwind.
- The interview screen owns two long-lived WebRTC peers:
  1. To **OpenAI Realtime** (audio in, audio + tool calls out).
  2. To **Simli** (audio in at 16 kHz, animated video + audio out).
- Audio glue lives in `src/lib/simli/pipeline.ts`. PCM16 mono throughout.

### Server (Vercel functions)

- All API routes are Edge-compatible Node functions; none of them stream
  audio. The longest-running ones (image generation, PDF render) are
  configured with `maxDuration: 60` in `vercel.json`.
- Server-only modules consume `serverEnv()` (zod-validated). Don't import
  these from client components.

### Supabase

- **Postgres** with strict RLS on every domain table. The `case_belongs_to_me`
  helper function makes child-table policies one-liners.
- **Storage buckets** `evidence` (uploads, generated portraits) and
  `dossiers` (rendered PDFs). Both private; access via signed URLs only.
- **Auth** with magic-link email; `@supabase/ssr` keeps sessions in cookies.

## Data flow per interview

1. User opens `/case/<id>/interview`.
2. `RealtimeClient.start()`:
   - `POST /api/realtime/session { caseId }` → `{ client_secret }`.
   - `getUserMedia` mic.
   - Opens `RTCPeerConnection`, exchanges SDP with OpenAI.
3. `AvatarStage`:
   - `GET /api/simli/session` → `{ apiKey, faceId }`.
   - `startAvatar(...)` initializes Simli WebRTC.
4. As OpenAI streams audio frames, `RealtimeClient` pushes them onto
   `AvatarBus`. `AvatarStage` reads, downsamples 24 kHz → 16 kHz, forwards.
5. Tool calls hit `/api/evidence` and `/api/interview/:id/finalize`.
6. Finalize triggers compose + portrait. The client redirects to
   `/case/<id>` to show the dossier.
7. User edits, prints, or jumps to `/journal`.

## Why this stack

- **Realtime + Simli** is the cheapest combo we found that meets "live voice
  + visible face" and stays under $1 per 5-minute session.
- **Supabase** is one-click on Vercel and gives Postgres + Storage + Auth in
  a single managed surface — important for "easy to deploy".
- **gpt-image-2** because the owner specified it and the cartoon style needs
  the model's strong text/style following.

## Audio sample rates (gotcha)

- Mic from `getUserMedia` → 48 kHz typically. Browser handles resampling to
  the offer's `a=ptime` automatically inside the peer.
- OpenAI Realtime over WebRTC sends/receives at **24 kHz PCM16 mono**.
- Simli expects **16 kHz PCM16 mono**. Use `downsamplePcm24kTo16k`.
- If you ever need to inspect the bytes, prefer `MediaStreamTrackProcessor`
  over `ScriptProcessorNode` — the latter is deprecated and laggy.
