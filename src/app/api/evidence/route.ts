import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServer } from '@/lib/supabase/server';

// POST /api/evidence — invoked when the detective calls the `record_evidence`
// tool through the Realtime data channel. We:
//   1. Validate args.
//   2. Find the active interview row for the case (most recent active one).
//   3. Upsert into `evidence` keyed on (case_id, key).
//   4. Append a `tool` row in `messages` so the transcript carries a record
//      of the call for later debugging.
//
// Auth: any user that owns the case via RLS can write. We never trust the
// client-supplied caseId without that ownership check — RLS enforces it.

const Body = z.object({
  caseId: z.string().uuid(),
  category: z.enum(['identity', 'appearance', 'observations', 'funny_facts', 'exhibits']),
  key: z.string().min(1).max(120),
  value: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(1).optional(),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { caseId, category, key, value, confidence } = parsed.data;

  // Confirm the case is visible to the caller (RLS would throw on insert too,
  // but a clean 404 beats a vague 403).
  const { data: ownedCase, error: caseErr } = await supabase
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .single();
  if (caseErr || !ownedCase) return NextResponse.json({ error: 'case not found' }, { status: 404 });

  // Latest active interview; nullable for the rare case where the detective
  // calls record_evidence before the interview row is created.
  const { data: interview } = await supabase
    .from('interviews')
    .select('id')
    .eq('case_id', caseId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Unique index on (case_id, key) means upsert keeps the dossier clean even
  // if the detective re-asks the same fact in a follow-up question.
  const { error: upsertErr } = await supabase
    .from('evidence')
    .upsert(
      {
        case_id: caseId,
        interview_id: interview?.id ?? null,
        category,
        key,
        value_text: value,
        confidence: confidence ?? 0.8,
        source: 'interview',
      },
      { onConflict: 'case_id,key' },
    );
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  // Best-effort transcript breadcrumb. If there's no interview row yet, we
  // skip — `messages.interview_id` is NOT NULL.
  if (interview) {
    await supabase.from('messages').insert({
      interview_id: interview.id,
      role: 'tool',
      content: `record_evidence(${category}.${key})`,
      tool_name: 'record_evidence',
      tool_payload: { category, key, value, confidence: confidence ?? 0.8 },
    });
  }

  return NextResponse.json({ ok: true });
}
