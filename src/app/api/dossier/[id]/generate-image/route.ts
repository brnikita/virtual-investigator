import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';
import { generateDossierPortrait } from '@/lib/openai/images';

// POST /api/dossier/:id/generate-image — generates the cartoon portrait for the
// case dossier and stores it in the `evidence` bucket as
// `<case_id>/portrait-vN.png`. Returns the new attachment row.
const Body = z.object({
  appearanceNotes: z.array(z.string()).default([]),
  referencePhotoPath: z.string().optional(), // e.g. "<case_id>/photo.jpg"
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const { data: c, error } = await supabase
    .from('cases')
    .select('id, suspect_name, language')
    .eq('id', caseId)
    .single();
  if (error || !c) return NextResponse.json({ error: 'case not found' }, { status: 404 });

  // TODO(agent): When body.referencePhotoPath is set, download the bytes from
  // the `evidence` bucket via admin client, base64-encode, pass as
  // referencePhotoDataUrl. The model uses it as a soft hint, never a copy.

  const portrait = await generateDossierPortrait({
    suspectName: c.suspect_name as string,
    language: c.language as 'ru' | 'en',
    appearanceNotes: body.data.appearanceNotes,
  });

  const objectPath = `${caseId}/portrait-${Date.now()}.png`;
  const { error: upErr } = await admin.storage
    .from('evidence')
    .upload(objectPath, portrait.bytes, { contentType: 'image/png', upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: att, error: attErr } = await supabase
    .from('attachments')
    .insert({
      case_id: caseId,
      kind: 'generated_portrait',
      storage_path: `evidence/${objectPath}`,
      mime_type: 'image/png',
    })
    .select()
    .single();
  if (attErr) return NextResponse.json({ error: attErr.message }, { status: 500 });

  return NextResponse.json({ attachment: att, cost_estimate_usd: portrait.cost_estimate_usd });
}
