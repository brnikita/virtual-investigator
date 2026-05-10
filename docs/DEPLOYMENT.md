# Deployment

One-shot path from clean clone to a live URL.

## Prereqs

- Node 20+, npm.
- Supabase CLI: `npm i -g supabase` (or use the official installer).
- Accounts: GitHub, Vercel, Supabase, OpenAI, Simli.

## Local

```bash
git clone <repo>
cd virtual-investigator
cp .env.example .env.local

npm install
supabase start            # spins up Postgres, Storage, Studio on :54321/:54323
supabase db reset         # applies the migrations + seed
npm run db:types          # regenerate typed DB client

npm run dev               # http://localhost:3000
```

Add the local Supabase keys (printed by `supabase start`) plus your OpenAI
and Simli keys to `.env.local`.

## Production

### 1. Supabase

```bash
supabase login
supabase projects create virtual-investigator --region eu-central-1
supabase link --project-ref <ref>
supabase db push                      # runs migrations against the hosted DB
```

In the Supabase Dashboard:

- **Auth → URL Configuration**: add your production URL and the wildcard
  `https://<vercel-project>-*.vercel.app/**` for preview deploys.
- **Auth → Email Templates**: tweak the magic-link copy to be kid-friendly.
- **Storage → Buckets**: confirm `evidence` and `dossiers` exist and are
  private.

### 2. Vercel

Import the repo. Add the following env vars (use the Supabase integration to
auto-fill the Supabase ones):

| Name | Source |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | https://your-domain |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `OPENAI_API_KEY` | OpenAI dashboard |
| `OPENAI_REALTIME_MODEL` | `gpt-realtime-mini` (default) |
| `OPENAI_IMAGE_MODEL` | `gpt-image-2` |
| `OPENAI_IMAGE_QUALITY` | `medium` |
| `SIMLI_API_KEY` | Simli dashboard |
| `SIMLI_FACE_ID` | Simli dashboard, the friendly face you picked |
| `MAX_INTERVIEW_SECONDS` | `300` |
| `MAX_IMAGES_PER_CASE` | `3` |

Trigger a deploy. Vercel will run `next build` and serve from `fra1` (see
`vercel.json`).

### 3. Smoke test

1. Open the production URL. Log in with a real email.
2. Create a case named "Test".
3. Run a short interview. Watch network tab — `/api/realtime/session`,
   `/api/simli/session`, `/api/evidence/upload` should all 200.
4. Finalize, generate the portrait, open the journal, print to PDF.
5. Confirm OpenAI dashboard usage < $1.

## Rollback

Vercel keeps every deploy. Roll back via the dashboard "Promote" button.
Schema rollbacks are the standard Supabase migration pattern: write a new
down-migration, never edit a published one.
