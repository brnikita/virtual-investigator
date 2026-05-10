import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mintRealtimeEphemeralKey } from '@/lib/openai/realtime';
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

  const key = await mintRealtimeEphemeralKey({
    voice: body.data.voice,
    language: c.language as 'ru' | 'en',
    instructions: detectiveSystemPrompt({
      language: c.language as 'ru' | 'en',
      suspectName: c.suspect_name as string,
    }),
    tools: detectiveTools as unknown as unknown[],
  });

  return NextResponse.json(key);
}
