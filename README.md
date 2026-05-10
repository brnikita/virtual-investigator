# Virtual Investigator

A friendly browser game for school children. Inspector Carrot — a cartoon
detective rendered live in the browser with voice and animation —
"interrogates" the player about themselves or a classmate, then produces a
printable A4 dossier sheet styled like a child's secret case file.

> Reference dossier: `samples/Nastya/ChatGPT Image 10 мая 2026 г., 09_07_08.png`.
> The rendered output should feel like that. The on-screen
> `<PrintableSheet>` component (`src/components/dossier/PrintableSheet.tsx`)
> mirrors the same layout 1:1 in the live UI.

## Stack at a glance

- **Next.js 15** App Router, React 19, TypeScript, Tailwind.
- **Supabase** for Postgres, Auth (magic link), and Storage.
- **OpenAI Realtime API** (`gpt-realtime-mini` by default) for the live voice.
- **Simli** for the streaming cartoon avatar.
- **gpt-image-2** for the dossier portrait.
- **@react-pdf/renderer** for the printable PDF.
- **Vercel** for hosting.

Cost target: **< $1 per completed interview**. See `docs/COSTS.md`.

## Quick start

```bash
cp .env.example .env.local        # fill in keys (see "Required external accounts")
npm install
supabase start                    # local Postgres + Studio (alt ports — see below)
supabase db reset                 # apply migrations
npm run db:types                  # regenerate typed DB client
npm run dev                       # http://localhost:3000 (or :3001 if busy)
```

This repo runs Supabase on **alt ports** because the defaults are usually
taken locally. After `supabase start` look for the printed URLs — defaults
land on:

| Service | URL |
|---|---|
| API gateway | http://127.0.0.1:64321 |
| Studio | http://127.0.0.1:64323 |
| Mailpit (magic-link inbox) | http://127.0.0.1:64324 |
| Postgres | postgres://postgres:postgres@127.0.0.1:64322/postgres |

Plug the printed `anon` key, `service_role` key, and the API URL into
`.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`). Magic-link emails go to Mailpit in dev — open
the inbox URL above and click the link.

Full deployment guide: `docs/DEPLOYMENT.md`.

## Required external accounts

To run the live interview end-to-end you need real credentials for two
external services. The repo ships with placeholder values so the surrounding
UI compiles, but the live calls will 401 until you swap them in.

| Service | Env vars | Notes |
|---|---|---|
| **OpenAI** | `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL`, `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY` | Project key with realtime + images access. Defaults: `gpt-realtime-mini` and `gpt-image-2` medium. |
| **Simli** | `SIMLI_API_KEY`, `SIMLI_FACE_ID` | Sign up at simli.com, create a friendly cartoon face, copy the face id. Pinned default in `docs/PROMPTS.md`. |

Supabase is also required, but for local dev the CLI provisions everything
for you.

## What's working today

Each phase ticks against `PLAN.md`:

- **Phase 0 — local dev loop.** `npm install && npm run dev` boots, Supabase
  comes up on alt ports, generated DB types compile.
- **Phase 1 — auth + case lifecycle.** Magic-link login, middleware-gated
  game routes, profile bootstrap, "create case" flow, "my cases" list.
- **Phase 2 — realtime voice loop.** WebRTC peer with ephemeral key,
  bidirectional transcript bus, `record_evidence`/`finish_interview` tool
  dispatch, hard interview cap with countdown, persisted interview
  metrics.
- **Phase 3 — Simli avatar.** AvatarBus + AvatarStage with the realtime
  audio bridge (24 kHz → 16 kHz), Safari fallback. **Blocked on a real
  Simli account for the face id** — see `PLAN.md` step 3.1.
- **Phase 4 — photo capture.** Webcam snap (with retake), drag-and-drop
  upload, signed-URL helper for private storage.
- **Phase 5 — dossier composition + portrait + print.** Compose flow,
  PDF renderer (`@react-pdf/renderer`), portrait generation, inline
  editor, full printable journal at `/journal`.
- **Phase 6 — polish.** Per-case language switcher, friendly empty/error
  states, running cost meter in the interview HUD, Lighthouse 100/100 on
  landing + login, this README refresh.
- **Phase 7 — production deploy.** Pending. See `docs/DEPLOYMENT.md`.

## How an autonomous agent should approach this repo

1. Read **`CLAUDE.md`** in full. It's the operating manual.
2. Open **`PLAN.md`**. Execute steps in order, top-to-bottom.
3. After every step, run `npm run typecheck` and `npm run lint`. Tick the
   step in `PLAN.md` only when both are green.
4. Touch `samples/` only for read-only reference. Do not commit changes
   there.

## Languages

- **Code, comments, docs:** English.
- **Player-facing UI:** Russian (default) and English. Strings live in
  `public/locales/{ru,en}/common.json`.
- **Detective interrogation:** runs in the case's chosen language. The
  per-case `LangSwitcher` on `/case/<id>` lets the user flip it after
  the case has been created.

## Screenshots

Live screenshots aren't included in the repo — capturing them needs valid
OpenAI + Simli credentials, which this dev environment doesn't have. Use
the original design reference instead:

- `samples/Nastya/ChatGPT Image 10 мая 2026 г., 09_07_08.png` — the printable
  dossier the in-browser `<PrintableSheet>` mirrors.
- `samples/Nastya/prompt.md.txt` — the original prompt that produced it.

The on-screen sheet (`src/components/dossier/PrintableSheet.tsx`) and the
PDF (`src/lib/pdf/render.ts`) both render the same layout, just in
different runtimes. Once Phase 7 is live, drop captures of the live
interview HUD and a printed journal page into `docs/screenshots/`.

## Repo map

```
src/             Next.js app (routes, components, lib)
supabase/        Migrations + local config
public/locales/  i18n dictionaries
samples/         Design reference (Nastya example)
docs/            Architecture, costs, deployment, prompts
CLAUDE.md        Operating manual for the build agent
PLAN.md          Ordered build plan
```

## License

Private project.
