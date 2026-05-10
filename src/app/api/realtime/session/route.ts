import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mintRealtimeEphemeralKey } from '@/lib/openai/realtime';
import { serverEnv } from '@/lib/env';
import { createSupabaseServer } from '@/lib/supabase/server';
import { detectiveSystemPrompt, detectiveTools } from '@/lib/openai/prompts';

// POST /api/realtime/session — issues an ephemeral OpenAI Realtime key bound
// to the case's language and suspect name. The browser then opens a WebRTC
// connection directly to OpenAI; our server is not in the audio hot path.
const Body = z.object({
  caseId: z.string().uuid(),
  voice: z.string().optional(),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const { data: c, error } = await supabase
    .from('cases')
    .select('id, suspect_name, language')
    .eq('id', body.data.caseId)
    .single();
  if (error || !c) return NextResponse.json({ error: 'case not found' }, { status: 404 });

  const env = serverEnv();
  const key = await mintRealtimeEphemeralKey({
    voice: body.data.voice,
    language: c.language as 'ru' | 'en',
    instructions: detectiveSystemPrompt({
      language: c.language as 'ru' | 'en',
      suspectName: c.suspect_name as string,
    }),
    tools: detectiveTools as unknown as unknown[],
  });

  // Echo the realtime model so the client can target the right SDP endpoint
  // without leaking server-only env. Same for the hard interview cap — the
  // client uses it to enforce the cost guardrail with a setTimeout. The
  // per-minute USD rate is the published default for the chosen model
  // (see docs/COSTS.md); the HUD multiplies it by elapsed minutes to show
  // a running cost estimate. This is informational — the hard cap is the
  // real budget guard.
  const costPerMinuteUsd =
    env.OPENAI_REALTIME_MODEL === 'gpt-realtime' ? 0.3 : 0.1;
  return NextResponse.json({
    ...key,
    model: env.OPENAI_REALTIME_MODEL,
    maxInterviewSeconds: env.MAX_INTERVIEW_SECONDS,
    costPerMinuteUsd,
  });
}
