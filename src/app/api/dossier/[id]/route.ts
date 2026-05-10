import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServer } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';
import type { DossierPayload } from '@/types/domain';

// PUT /api/dossier/:id — replace the dossier payload with a user-edited copy.
// RLS scopes writes to the case owner; we still validate the body so a stray
// integer in `scales[].value` doesn't break the printable sheet template.
const ScaleSchema = z.object({
  label: z.string(),
  value: z.number().int().min(0),
  max: z.number().int().min(1),
});

const PayloadSchema = z.object({
  language: z.enum(['ru', 'en']),
  headline: z.string(),
  subheadline: z.string(),
  identity: z.record(z.string(), z.string()),
  observations: z.array(z.string()),
  scales: z.array(ScaleSchema),
  exhibits: z.array(z.string()),
  last_seen: z.string(),
  conclusion: z.string(),
});

const Body = z.object({ payload: PayloadSchema });

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = Body.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  // Clamp scale.value into [0, max] at the boundary — the editor already
  // does this but a raw fetch caller shouldn't be able to slip past it.
  const clamped: DossierPayload = {
    ...body.data.payload,
    scales: body.data.payload.scales.map((s) => ({
      ...s,
      value: Math.max(0, Math.min(s.value, s.max)),
    })),
  };

  const { data, error } = await supabase
    .from('dossiers')
    .update({ payload: clamped as unknown as Json, updated_at: new Date().toISOString() })
    .eq('case_id', caseId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'dossier not found' }, { status: 404 });

  return NextResponse.json({ dossier: data });
}
