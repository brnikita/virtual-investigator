# Virtual Investigator

A friendly browser game for school children. Inspector Carrot — a cartoon
detective rendered live in the browser with voice and animation —
"interrogates" the player about themselves or a classmate, then produces a
printable A4 dossier sheet styled like a child's secret case file.

> Reference dossier: `samples/Nastya/ChatGPT Image 10 мая 2026 г., 09_07_08.png`.
> The rendered output should feel like that.

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
cp .env.example .env.local        # fill in keys
npm install
supabase start                    # local Postgres + Studio
supabase db reset                 # apply migrations
npm run db:types                  # regenerate typed DB client
npm run dev                       # http://localhost:3000
```

Full deployment guide: `docs/DEPLOYMENT.md`.

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
- **Detective interrogation:** runs in the case's chosen language.

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
