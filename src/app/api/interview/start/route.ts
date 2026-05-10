import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServer } from '@/lib/supabase/server';

// POST /api/interview/start — called by RealtimeClient right before opening
// the WebRTC peer. Creates an `interviews` row in 'active' state so:
//   - the evidence route can attach tool-call breadcrumbs to a real id;
//   - the finalize route has a row to update;
//   - the started_at timestamp anchors the cost-cap defense.
//
// The realtime_session_id (ephemeral key id from OpenAI) is captured here
// when the client provides it; useful for cross-referencing OpenAI usage
// records against our local cost estimates.
const Body = z.object({
  caseId: z.string().uuid(),
  realtimeSessionId: z.string().optional(),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { caseId, realtimeSessionId } = parsed.data;

  const { data: ownedCase, error: caseErr } = await supabase
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .single();
  if (caseErr || !ownedCase) return NextResponse.json({ error: 'case not found' }, { status: 404 });

  // Flip the case to 'interviewing' so the cases list shows progress.
  await supabase.from('cases').update({ status: 'interviewing' }).eq('id', caseId);

  const { data: row, error } = await supabase
    .from('interviews')
    .insert({
      case_id: caseId,
      status: 'active',
      started_at: new Date().toISOString(),
      realtime_session_id: realtimeSessionId ?? null,
    })
    .select('id')
    .single();
  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? 'insert failed' }, { status: 500 });
  }

  return NextResponse.json({ interviewId: row.id });
}
