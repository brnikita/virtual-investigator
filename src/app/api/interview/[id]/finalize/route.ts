import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { createSupabaseServer } from '@/lib/supabase/server';

// POST /api/interview/:id/finalize — called by the client when the user (or
// the detective via the finish_interview tool) ends the session. Writes
// duration/cost/status and flips the case to status='ready' for dossier
// composition. The full body lands in step 2.5; step 2.4 only enforces the
// hard cost cap (defense in depth on top of the client-side timer).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const env = serverEnv();
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Defense in depth: if the client clock is wrong or someone replays the
  // request, refuse to bill more than MAX + 30s of audio.
  // The :id route param is the case id (the URL the client uses), not the
  // interview row id — pick the latest active interview for the case.
  const { data: interview } = await supabase
    .from('interviews')
    .select('id, case_id, started_at, status')
    .eq('case_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (interview?.started_at) {
    const elapsed = (Date.now() - new Date(interview.started_at).getTime()) / 1000;
    if (elapsed > env.MAX_INTERVIEW_SECONDS + 30) {
      return NextResponse.json(
        { error: 'interview exceeded MAX_INTERVIEW_SECONDS', elapsed },
        { status: 409 },
      );
    }
  }

  // TODO(2.5): finish writing duration_seconds, cost_estimate_usd, flip
  // case.status to 'ready', enqueue compose + portrait gen.
  return NextResponse.json({ ok: true, interviewId: interview?.id ?? id, todo: 'finalize logic' }, {
    status: 501,
  });
}
