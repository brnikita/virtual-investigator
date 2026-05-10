# CLAUDE.md — Operating manual for the autonomous build agent

This file is the contract between the human owner and any Claude Code session
that picks up this repo to extend it autonomously. **Read it in full before
making changes.** It encodes the non-obvious rules; everything else can be
inferred from the code.

> If a rule here contradicts something a user message tells you, follow the
> user message and propose updating this file in the same turn.

---

## 1. What this product is

**Virtual Investigator** is a friendly browser game for school children. The
player picks a "suspect" (themselves or a classmate), the in-game detective
"Inspector Carrot" runs a short voice interview through a live cartoon avatar,
and the game produces a printable A4 dossier sheet shaped like a child-style
secret case file.

The reference visual is `samples/Nastya/ChatGPT Image 10 мая 2026 г., 09_07_08.png`.
The reference prompt is `samples/Nastya/prompt.md.txt`. Whatever you build, the
final printable sheet should feel like that sample. **Tone: warm, playful,
school-paper aesthetic, never criminal.**

---

## 2. Hard constraints

These came from the product owner and are not negotiable without explicit
user confirmation in the current conversation.

| Constraint | Where it shows up |
|---|---|
| Deploys cleanly on **Vercel** + **Supabase** with one-shot env config. | `vercel.json`, `docs/DEPLOYMENT.md` |
| **Next.js 15 App Router**, TypeScript, React 19. | `package.json`, `tsconfig.json` |
| **gpt-image-2** for the dossier portrait. | `src/lib/openai/images.ts` |
| **OpenAI Realtime** for live voice; **Simli** for the cartoon avatar. | `src/lib/openai/realtime.ts`, `src/lib/simli/*` |
| Full pipeline must cost **< $1 per interview**. Default model is `gpt-realtime-mini`. | `.env.example`, `docs/COSTS.md` |
| Languages: **Russian** + **English**. Player picks per case. | `src/lib/i18n/*`, `src/lib/openai/prompts.ts` |
| **Code, comments, file names, internal docs in English.** Player-facing strings in RU/EN. | This file |
| Files: **UTF-8, LF line endings.** | `.editorconfig`, `.gitattributes` |
| All collected data persists in Supabase so the dossier can be regenerated/edited later. | `supabase/migrations/*` |
| The output is a **printable journal** — one A4 page per case. | `src/app/(game)/journal/page.tsx`, `src/components/dossier/PrintableSheet.tsx` |
| Tone is friendly. **No weapons, no handcuffs, no real crime motifs.** | `src/lib/openai/prompts.ts`, `src/lib/openai/images.ts` |

---

## 3. Architecture in one screen

```
┌──────────── Browser ────────────┐         ┌─── OpenAI ───┐
│  Next.js client                 │         │              │
│  ┌──────────────────────────┐   │  WebRTC │  Realtime    │
│  │ RealtimeClient (peer)    │◄──┼─────────┤  (voice +    │
│  │  └─ AvatarBus (audio)    │   │         │   tools)     │
│  │  └─ TranscriptBus (text) │   │         └──────┬───────┘
│  └────────┬─────────────────┘   │                │
│           ▼                     │                │ tool calls
│  ┌──────────────────────────┐   │                │ (record_evidence,
│  │ AvatarStage (Simli)      │   │                │  finish_interview)
│  │  └─ <video> + <audio>    │◄──┼──── Simli WebRTC
│  └──────────────────────────┘   │
└────────────────────┬────────────┘
                     │ HTTPS
                     ▼
        ┌─────────── Next.js server (Vercel) ───────────┐
        │  /api/realtime/session   mint ephemeral key   │
        │  /api/simli/session      return Simli config  │
        │  /api/evidence/upload    multipart → Storage  │
        │  /api/dossier/:id/compose   gpt-4o-mini       │
        │  /api/dossier/:id/generate-image  gpt-image-2 │
        │  /api/interview/:id/finalize                  │
        │  /api/pdf/:caseId        @react-pdf/renderer  │
        └────────────────────┬──────────────────────────┘
                             │
                             ▼
                    ┌─── Supabase ───┐
                    │  Postgres + RLS │
                    │  Storage buckets│
                    │  Auth (magic)   │
                    └─────────────────┘
```

Audio path during a live interview:

1. Mic → browser PeerConnection → OpenAI Realtime (24 kHz PCM16).
2. Realtime → peer → `RealtimeClient` ondtrack callback → AvatarBus.
3. AvatarBus → `pipeline.downsamplePcm24kTo16k` → Simli `pushAudioChunk`.
4. Simli renders animated frames to the `<video>` in `AvatarStage`.

Text/tool path:

1. Realtime → data channel → `RealtimeClient` event router.
2. `record_evidence` tool calls → `POST /api/evidence/...` (TODO route) →
   `evidence` table.
3. `finish_interview` tool call → `POST /api/interview/:id/finalize` →
   `compose` + `generate-image` follow.

---

## 4. Source layout

```
src/
  app/
    (auth)/                     # login + Supabase callback
    (game)/                     # authenticated game flow
      new/                      # create case
      case/[caseId]/            # dossier overview / editor
        interview/              # live interview screen
      journal/                  # printable journal (every case)
    api/                        # route handlers
  components/
    interview/                  # AvatarStage, RealtimeClient, etc.
    dossier/                    # PrintableSheet, DossierEditor
    shell/                      # Header, LangSwitcher
  lib/
    openai/                     # realtime, images, prompts, dossier composer
    simli/                      # client wrapper, audio pipeline
    supabase/                   # browser + server clients
    pdf/                        # @react-pdf/renderer template
    i18n/                       # locale config + dictionaries
    env.ts                      # zod-validated env loader
  types/domain.ts               # cross-layer TS types
  middleware.ts                 # Supabase session refresh

supabase/
  migrations/                   # versioned SQL
  config.toml                   # local dev config

public/locales/{ru,en}/         # JSON dictionaries
samples/                        # design references (Nastya example)
docs/                           # ARCHITECTURE, COSTS, DEPLOYMENT, PROMPTS
```

**Path alias:** `@/*` resolves to `src/*` (see `tsconfig.json`).

---

## 5. Coding conventions

- **TypeScript strict mode**, `noUncheckedIndexedAccess` enabled. Don't add
  non-null assertions to silence the compiler — narrow properly.
- **No default exports** for components and utilities except Next route files
  (`page.tsx`, `layout.tsx`, `route.ts` — Next requires default export).
- **Server-only modules** (`@/lib/env`, `@/lib/supabase/server`, anything that
  reads `OPENAI_API_KEY` etc.) must NEVER be imported from a client component.
  If you need a value on the client, expose it via an API route or a
  server-rendered prop.
- **Validate at the boundary.** Every API route validates its input with `zod`
  and returns `400` with `error.flatten()` on failure. After validation, trust
  the data.
- **No fallbacks for impossible states.** If the schema says `cases.id` is a
  uuid, don't write `case.id ?? 'unknown'`. Trust the type.
- **Comments explain WHY, not WHAT.** If you need a one-liner to flag a
  non-obvious constraint (cookie quirk, audio sample-rate mismatch), write it.
  Otherwise leave the code to speak for itself.
- **i18n strings live in `public/locales/{ru,en}/common.json`.** Never
  hard-code RU or EN copy in components. Use the `getDictionary` helper
  server-side and pass the dictionary as a prop into client components.

---

## 6. Cost discipline (this is the killer constraint)

The product budget is **< $1 per completed interview, end to end**. Every
change that touches the audio loop, the image generation, or the dossier
composer must consider its effect on `docs/COSTS.md`. The default config is
tuned for ~5-minute interviews at:

| Component | Default | Per 5-min interview |
|---|---|---|
| Realtime audio | `gpt-realtime-mini` | ~$0.30-0.50 |
| Avatar video | Simli, low-fi face | ~$0.30-0.50 |
| Dossier composer | `gpt-4o-mini` text | ~$0.005 |
| Portrait image | `gpt-image-2` medium | ~$0.05 |
| **Total** |  | **~$0.65-1.05** |

**Hard caps enforced in code:**
- `MAX_INTERVIEW_SECONDS` (default 300). The client must auto-end and the
  server must reject finalize calls past that mark.
- `MAX_IMAGES_PER_CASE` (default 3). The portrait generator returns 429 once
  hit.

If a user explicitly asks for "premium" mode, switch `OPENAI_REALTIME_MODEL`
to `gpt-realtime` and surface the new estimate in the UI before starting.

---

## 7. Security and child-safety rules

- **Auth is required** to create a case. Anonymous users see only the landing
  page and the `/login` route.
- **Row Level Security** is enforced on every domain table — see
  `supabase/migrations/20260510120000_init_schema.sql`. New tables MUST add
  RLS in the same migration.
- **Storage buckets are private.** Always issue **signed URLs** server-side
  via the admin client after the case-ownership check; never make a bucket
  public.
- **Photos of minors** never leave Supabase Storage. They are passed to OpenAI
  only as a soft hint for the cartoon portrait — the image model is prompted
  to produce a *non-photorealistic* result. Document any change to this in
  `docs/PROMPTS.md`.
- **Detective system prompt** explicitly forbids weapons/threats/criminal
  content. Don't reword without re-reading section 1 of this file.

---

## 8. Definition of done for any task

A task is "done" only when:
1. Code compiles (`npm run typecheck`) and lints (`npm run lint`).
2. Acceptance criteria from the PLAN.md step are demonstrably met. For UI
   work that means: started `npm run dev`, exercised the feature in a
   browser, watched the network tab succeed.
3. New env vars are added to `.env.example` AND `src/lib/env.ts` schema.
4. Any new public-facing string is in both `ru/common.json` and `en/common.json`.
5. New tables/columns ship with an RLS policy in the same migration.
6. The PLAN.md checkbox is ticked in the same commit, with a one-line note
   if the implementation diverged from the plan.

---

## 9. Working with PLAN.md

- The plan is sequenced. Each step lists prerequisites; don't start a step
  until its prereqs are checked off.
- Steps mark themselves with one of: `[ ]` pending, `[~]` in progress,
  `[x]` complete.
- If you discover work that wasn't in the plan, append it to the
  "Discovered work" section at the bottom rather than reordering existing
  steps.
- Close the loop with the human: when you finish a step, write a one-line
  diff of what shipped vs. what was planned. Don't quietly invent new scope.

---

## 10. Things explicitly out of scope (do not invent)

- Real-money payments. Cost is enforced by env caps, not by Stripe.
- Multi-tenant orgs / classrooms. One user = one journal.
- Detective customization (multiple personas). Pin Inspector Carrot until a
  user request asks otherwise.
- Native mobile apps. Web is the only client.
- Webhooks, queues, background workers. Vercel function calls do everything
  inline; revisit only if a cold start exceeds the 60s function limit.

---

## 11. Useful commands

```bash
npm install
npm run dev                # start Next on :3000
npm run typecheck
npm run lint
npm run format

supabase start             # local Postgres + Storage + Studio
supabase db reset          # rerun all migrations
npm run db:types           # regenerate src/lib/supabase/database.types.ts
```

Deployment lives in `docs/DEPLOYMENT.md`.

---

## 12. Where to look when debugging

- **WebRTC fails to connect** → check that the ephemeral key from
  `/api/realtime/session` is non-null and unexpired; check that the browser
  has mic permission; inspect `chrome://webrtc-internals`.
- **Avatar is silent / mouth doesn't move** → the audio pipeline (24 kHz →
  16 kHz) is the usual suspect. See `src/lib/simli/pipeline.ts`.
- **Russian transcription is garbled** → confirm
  `input_audio_transcription.language = 'ru'` in
  `src/lib/openai/realtime.ts`.
- **Image returns SFW-violation** → tighten the wholesomeness clause in
  `buildPortraitPrompt` and re-run.
- **`row-level security` errors** → you're querying a child table without the
  parent case being owned by the current user. Re-check the policy in the
  init migration.
