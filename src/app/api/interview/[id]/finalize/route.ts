import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

// POST /api/interview/:id/finalize — called by the client when the user (or the
// detective via the finish_interview tool) ends the session. Writes
// duration/cost/status and flips the case to status='ready' for dossier
// composition.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // TODO(agent):
  //  1. Update interview row: status='completed', ended_at=now(),
  //     duration_seconds, cost_estimate_usd (compute from session metrics).
  //  2. Update case row: status='ready'.
  //  3. Optionally enqueue dossier compose + portrait gen jobs.
  return NextResponse.json({ ok: true, interviewId: id, todo: 'finalize logic' }, { status: 501 });
}
