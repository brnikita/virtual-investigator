import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server';

// POST /api/evidence/upload — uploads a binary attachment (suspect photo or
// exhibit). Multipart/form-data so the browser can stream large files.
const FieldsSchema = z.object({
  caseId: z.string().uuid(),
  kind: z.enum(['suspect_photo', 'exhibit']),
});

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const parsed = FieldsSchema.safeParse({
    caseId: form.get('caseId'),
    kind: form.get('kind'),
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });

  // Verify case ownership before writing to Storage.
  const { data: c } = await supabase.from('cases').select('id').eq('id', parsed.data.caseId).single();
  if (!c) return NextResponse.json({ error: 'case not found' }, { status: 404 });

  const ext = file.name.split('.').pop() || 'bin';
  const objectPath = `${parsed.data.caseId}/${parsed.data.kind}-${Date.now()}.${ext}`;
  const buf = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from('evidence')
    .upload(objectPath, buf, { contentType: file.type, upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: att, error: attErr } = await supabase
    .from('attachments')
    .insert({
      case_id: parsed.data.caseId,
      kind: parsed.data.kind,
      storage_path: `evidence/${objectPath}`,
      mime_type: file.type,
    })
    .select()
    .single();
  if (attErr) return NextResponse.json({ error: attErr.message }, { status: 500 });

  return NextResponse.json({ attachment: att });
}
