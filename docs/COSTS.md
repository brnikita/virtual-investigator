# Costs

Budget: **< $1.00 per completed interview** (suspect_name → printable
dossier). Numbers are approximate, sourced as of May 2026 from public pricing
pages. Re-check before any release.

## Per-interview breakdown (5-minute interview, default config)

| Item | Unit price | Per interview |
|---|---|---|
| OpenAI Realtime (`gpt-realtime-mini`) audio in + out | ~$0.06–0.10/min | $0.30–0.50 |
| Simli streaming avatar (low-fi face) | ~$0.06–0.10/min | $0.30–0.50 |
| `gpt-4o-mini` dossier composer | ~$0.15 / 1M tokens | < $0.01 |
| `gpt-image-2` portrait, 1024² medium | $0.053 | $0.05 |
| Supabase Postgres + Storage | free tier covers MVP | ~$0 |
| Vercel functions | free tier covers MVP | ~$0 |
| **Total** |  | **$0.65–1.05** |

If we go over budget, levers in priority order:
1. Drop interview cap from 300 s to 240 s.
2. Switch portrait quality `medium → low` ($0.05 → $0.006).
3. Drop avatar to a static animated PNG between speech turns
   (Simli idle frames cost zero).
4. Skip portrait regeneration unless the user clicks "Regenerate".

## Premium mode

If the user explicitly opts in (and we surface the new price first):

| Item | Unit price | Per 5-min interview |
|---|---|---|
| OpenAI Realtime (`gpt-realtime`) | ~$0.18–0.24/min | $0.90–1.20 |
| Simli premium face | ~$0.15/min | $0.75 |
| `gpt-image-2` high quality | $0.211 | $0.21 |
| **Total** |  | **~$1.86–2.16** |

## Hard caps in code

- `MAX_INTERVIEW_SECONDS` (default 300) — enforced in `RealtimeClient` and
  `/api/interview/:id/finalize`.
- `MAX_IMAGES_PER_CASE` (default 3) — enforced in
  `/api/dossier/:id/generate-image`.
