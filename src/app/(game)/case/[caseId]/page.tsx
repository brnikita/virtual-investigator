import { notFound, redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/config';
import type { DossierPayload } from '@/types/domain';
import { CaseActions } from '@/components/dossier/CaseActions';
import { signedUrlForAttachment } from '@/lib/storage/signed-url';

// Case overview / dossier page. Server-renders the latest dossier payload
// (and its portrait, behind a fresh signed URL) plus the case's appearance
// notes. The interactive bits — compose, generate portrait, edit, save,
// download — are wrapped into one client component so this surface stays
// declarative.
export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/case/${caseId}`);

  const { data: c, error: caseErr } = await supabase
    .from('cases')
    .select('id, suspect_name, language, status')
    .eq('id', caseId)
    .single();
  if (caseErr || !c) notFound();

  const language = (c.language === 'en' ? 'en' : 'ru') as Locale;
  const dict = await getDictionary(language);
  const t = dict.dossier;

  const { data: dossier } = await supabase
    .from('dossiers')
    .select('id, payload, image_attachment_id, updated_at')
    .eq('case_id', caseId)
    .maybeSingle();

  // Pull the most recent generated portrait (if any) — the dossier row may
  // not yet have image_attachment_id set, so fall back to "newest portrait".
  let portraitAttachmentId: string | null = dossier?.image_attachment_id ?? null;
  if (!portraitAttachmentId) {
    const { data: portrait } = await supabase
      .from('attachments')
      .select('id')
      .eq('case_id', caseId)
      .eq('kind', 'generated_portrait')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    portraitAttachmentId = portrait?.id ?? null;
  }

  let portraitUrl: string | null = null;
  if (portraitAttachmentId) {
    try {
      const signed = await signedUrlForAttachment(portraitAttachmentId, 300);
      portraitUrl = signed.url;
    } catch {
      // Stale or deleted attachment — render the placeholder instead.
      portraitUrl = null;
    }
  }

  // The reference photo path (without bucket prefix) is forwarded to the
  // image generator as a hint. RLS already restricts this to our cases.
  const { data: photo } = await supabase
    .from('attachments')
    .select('storage_path')
    .eq('case_id', caseId)
    .eq('kind', 'suspect_photo')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const referencePhotoPath = photo?.storage_path
    ? // strip the leading "<bucket>/" prefix for the API contract.
      photo.storage_path.slice(photo.storage_path.indexOf('/') + 1)
    : null;

  const { data: appearance } = await supabase
    .from('evidence')
    .select('value_text')
    .eq('case_id', caseId)
    .eq('category', 'appearance');
  const appearanceNotes = (appearance ?? [])
    .map((r) => (r.value_text as string | null) ?? '')
    .filter((s) => s.length > 0);

  const payload = (dossier?.payload ?? null) as DossierPayload | null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-casefile text-4xl">
            {t.title}: {c.suspect_name}
          </h1>
          <p className="mt-1 text-sm text-ink/60">№ {caseId.slice(0, 8)}</p>
        </div>
      </header>

      <CaseActions
        caseId={caseId}
        labels={t}
        initialPayload={payload}
        initialPortraitUrl={portraitUrl}
        appearanceNotes={appearanceNotes}
        referencePhotoPath={referencePhotoPath}
      />
    </main>
  );
}

