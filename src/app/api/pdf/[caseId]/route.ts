import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

// GET /api/pdf/:caseId — render the dossier as a printable A4 PDF and return
// it inline. Server-rendered with @react-pdf/renderer so the user can print
// without a browser dialog mismatch (CSS `@media print` is unreliable on
// mobile and varies by browser).
export async function GET(_req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: dossier } = await supabase
    .from('dossiers')
    .select('payload, image_attachment_id')
    .eq('case_id', caseId)
    .single();
  if (!dossier) return NextResponse.json({ error: 'dossier not found' }, { status: 404 });

  // TODO(agent): implement src/lib/pdf/render.ts with a <DossierA4/> component
  // mirroring the Nastya sample (samples/Nastya/*.png). Stream the PDF buffer.
  return NextResponse.json(
    { todo: 'render PDF', caseId, payload: dossier.payload },
    { status: 501 },
  );
}
