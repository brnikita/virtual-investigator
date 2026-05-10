# Prompts

A single source of truth for every prompt the system sends to a model.
Whenever you change a prompt, update this file in the same commit so a future
maintainer can audit drift.

## Detective system prompt

Source: `src/lib/openai/prompts.ts` → `detectiveSystemPrompt`.

Two language variants. Hard rules common to both:

1. Tone: warm, playful, encouraging. Never scary, never criminal, never
   weapons or handcuffs.
2. One short question at a time, wait for an answer.
3. React with delight ("Wow! Adding to the case file!").
4. Call `record_evidence` for every fact learned.
5. Call `finish_interview` after 8-10 minutes or when enough material is in.

Voice: `verse` (natural, friendly). Switch via the `voice` query param if a
user prefers another preset.

## Tool definitions

Source: `src/lib/openai/prompts.ts` → `detectiveTools`.

| Tool | Purpose |
|---|---|
| `record_evidence(category, key, value, confidence?)` | Log a single fact. |
| `finish_interview(summary)` | End the session, supply a one-line conclusion. |

Categories: `identity`, `appearance`, `observations`, `funny_facts`,
`exhibits`. Keep snake_case keys consistent across rounds — the dossier
composer joins on them.

## Dossier composer

Source: `src/lib/openai/dossier.ts` → `composeDossier`.

Model: `gpt-4o-mini` with `response_format: json_object`.

The composer must produce a `DossierPayload` with playful scales (Милота,
Загадочность, Подарконосность for RU; Cuteness, Mysteriousness, Gift-bearing
for EN). The detective's evidence rows are passed verbatim plus optional
transcript highlights.

## Avatar idle behaviour

Source: `src/lib/simli/client.ts` → `startAvatar`.

`SimliClient.Initialize` is called with `handleSilence: true`, which makes
the SDK emit its own filler audio frames (a 6 KB zero-PCM packet, see
`SimliClient.ts` line ~417) whenever no real audio has flowed for ~6 s.
That's enough to keep the cartoon face looking alive between speech turns
without any work on our side. We do not need a manual silence-timeout +
`flush()` nudge in `AvatarStage`.

`maxIdleTime` (set to 120 s) is the hard cut: if the avatar receives no
audio for that long the SDK tears the WebRTC peer down. The interview
already hard-caps at `MAX_INTERVIEW_SECONDS` (default 300), so 120 s of
idle inside an interview is "the player wandered off" and ending the
session is the right call.

## Portrait generator

Source: `src/lib/openai/images.ts` → `buildPortraitPrompt`.

The prompt explicitly asks for a *non-photorealistic*, soft, child-style
cartoon. The reference photo (when supplied) is meant as a soft hint, never
a copy. This is intentional — the suspects are minors and the output ends
up on a printed sheet that may circulate.

If the model returns a content-policy refusal, the wholesomeness clause has
to be reinforced. The fallback prompt should:

- Add "wholesome family-album style"
- Add "no realistic facial features, exaggerated cartoon proportions"
- Drop the reference image hint entirely
