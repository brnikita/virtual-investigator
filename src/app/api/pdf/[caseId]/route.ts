import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { signedUrlForAttachment } from '@/lib/storage/signed-url';
import { renderDossierPdf } from '@/lib/pdf/render';
import type { DossierPayload } from '@/types/domain';

// GET /api/pdf/:caseId — render the dossier as a printable A4 PDF and return
// it inline. Server-rendered with @react-pdf/renderer so the user can print
// without a browser dialog mismatch (CSS `@media print` is unreliable on
// mobile and varies by browser).
//
// react-pdf is a heavyweight pure-Node library — pin the route to the Node
// runtime so the Edge runtime doesn't try (and fail) to bundle it.
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: dossier } = await supabase
    .from('dossiers')
    .select('payload, image_attachment_id')
    .eq('case_id', caseId)
    .single();
  if (!dossier) return NextResponse.json({ error: 'dossier not found' }, { status: 404 });

  // Resolve the portrait — prefer the dossier's own pointer, fall back to the
  // newest generated_portrait attachment for this case (the dossier row may
  // predate the first portrait).
  let attachmentId: string | null = dossier.image_attachment_id ?? null;
  if (!attachmentId) {
    const { data: portrait } = await supabase
      .from('attachments')
      .select('id')
      .eq('case_id', caseId)
      .eq('kind', 'generated_portrait')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    attachmentId = portrait?.id ?? null;
  }

  let portraitUrl: string | undefined;
  if (attachmentId) {
    try {
      // 5 minutes is plenty for PDF generation + a casual reader scrolling
      // through the result; long enough to not race the renderer, short
      // enough to stay within signed-URL hygiene.
      const signed = await signedUrlForAttachment(attachmentId, 300);
      portraitUrl = signed.url;
    } catch {
      // Fall through with no portrait — the template renders a placeholder.
      portraitUrl = undefined;
    }
  }

  const bytes = await renderDossierPdf(dossier.payload as unknown as DossierPayload, portraitUrl);

  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="dossier-${caseId.slice(0, 8)}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
