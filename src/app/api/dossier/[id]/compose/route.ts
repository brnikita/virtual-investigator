import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { composeDossier } from '@/lib/openai/dossier';

// POST /api/dossier/:id/compose — pulls evidence rows for the case, runs them
// through the dossier composer (gpt-4o-mini), upserts the dossier row, and
// returns the structured payload so the editor can render it immediately.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: c } = await supabase
    .from('cases')
    .select('id, suspect_name, language')
    .eq('id', caseId)
    .single();
  if (!c) return NextResponse.json({ error: 'case not found' }, { status: 404 });

  const { data: ev } = await supabase
    .from('evidence')
    .select('category, key, value_text')
    .eq('case_id', caseId);

  const payload = await composeDossier({
    language: c.language as 'ru' | 'en',
    suspectName: c.suspect_name as string,
    evidence: (ev ?? []).map((r) => ({
      category: r.category as string,
      key: r.key as string,
      value: (r.value_text as string) ?? '',
    })),
  });

  const { data: dossier, error } = await supabase
    .from('dossiers')
    .upsert({ case_id: caseId, payload }, { onConflict: 'case_id' })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ dossier });
}
