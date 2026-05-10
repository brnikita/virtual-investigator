import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { createSupabaseServer } from '@/lib/supabase/server';

// POST /api/interview/:id/finalize — called by the client when the user (or
// the detective via the finish_interview tool) ends the session. The :id
// route param is the interviews.id row created by /api/interview/start.
//
// Steps:
//   1. Read the active interview row.
//   2. Defense-in-depth: reject if the audio ran longer than the cost cap.
//   3. Stamp ended_at, duration_seconds, status='completed', and a rough
//      cost_estimate_usd based on gpt-realtime-mini's per-minute midpoint.
//   4. Flip cases.status to 'ready' so the dossier composer can pick it up.
//
// Cost rate: roughly $0.10 / minute total for gpt-realtime-mini including
// both directions of audio (see docs/COSTS.md). Premium voice would
// substitute a higher rate; this stays a flat estimate until we wire OpenAI
// usage records.
const COST_USD_PER_SECOND = 0.10 / 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const env = serverEnv();
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: interview, error: readErr } = await supabase
    .from('interviews')
    .select('id, case_id, started_at, status')
    .eq('id', id)
    .single();
  if (readErr || !interview) {
    return NextResponse.json({ error: 'interview not found' }, { status: 404 });
  }

  // Idempotency: if already completed, just echo it back.
  if (interview.status === 'completed') {
    return NextResponse.json({ ok: true, interviewId: interview.id, idempotent: true });
  }

  const startedAtIso = interview.started_at;
  const endedAt = new Date();

  // Defense in depth on the cost cap. Without a started_at we still proceed —
  // the row will simply have a null duration.
  let durationSeconds: number | null = null;
  if (startedAtIso) {
    const elapsed = (endedAt.getTime() - new Date(startedAtIso).getTime()) / 1000;
    if (elapsed > env.MAX_INTERVIEW_SECONDS + 30) {
      // Mark the row aborted so a stuck client can retry without spinning
      // up infinite cost; flip the case back to draft.
      await supabase
        .from('interviews')
        .update({ status: 'aborted', ended_at: endedAt.toISOString() })
        .eq('id', interview.id);
      return NextResponse.json(
        { error: 'interview exceeded MAX_INTERVIEW_SECONDS', elapsed },
        { status: 409 },
      );
    }
    // Cap duration at MAX so a misbehaving client can't inflate the bill.
    durationSeconds = Math.max(0, Math.min(env.MAX_INTERVIEW_SECONDS, Math.floor(elapsed)));
  }

  const costEstimateUsd =
    durationSeconds !== null ? Number((durationSeconds * COST_USD_PER_SECOND).toFixed(4)) : null;

  const { error: updateErr } = await supabase
    .from('interviews')
    .update({
      status: 'completed',
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
      cost_estimate_usd: costEstimateUsd,
    })
    .eq('id', interview.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Append a summary breadcrumb so the transcript carries the close.
  await supabase.from('messages').insert({
    interview_id: interview.id,
    role: 'system',
    content: `interview completed (${durationSeconds ?? '?'}s, ~$${costEstimateUsd ?? '?'})`,
  });

  // Flip the case to ready so the dossier overview can render it.
  await supabase.from('cases').update({ status: 'ready' }).eq('id', interview.case_id);

  return NextResponse.json({
    ok: true,
    interviewId: interview.id,
    durationSeconds,
    costEstimateUsd,
  });
}
