import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { signedUrlForAttachment } from '@/lib/storage/signed-url';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/config';
import type { DossierPayload } from '@/types/domain';
import { PrintableSheet } from '@/components/dossier/PrintableSheet';
import { JournalPrintButton } from '@/components/dossier/JournalPrintButton';

// Printable journal — every "ready" dossier owned by the user, one A4 sheet
// per page. RLS scopes the dossier and case selects to the owner; we still
// filter by status and presence-of-dossier here because RLS doesn't know the
// product semantics.
//
// We deliberately render server-side and pre-mint the portrait signed URLs
// here so the printed booklet doesn't blink on a flaky network during the
// browser's print pass.
export default async function JournalPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/journal');

  const { data: profile } = await supabase
    .from('profiles')
    .select('preferred_language')
    .eq('id', user.id)
    .maybeSingle();
  const language = (profile?.preferred_language === 'en' ? 'en' : 'ru') as Locale;
  const dict = await getDictionary(language);
  const t = dict.journal;

  // Pull every ready case + its dossier in one round-trip. We don't have a
  // foreign-key Supabase relation defined for `dossiers.case_id` in the
  // generated types, so do two selects and stitch by case_id locally.
  const { data: cases } = await supabase
    .from('cases')
    .select('id, suspect_name, updated_at')
    .eq('status', 'ready')
    .order('updated_at', { ascending: false });

  const caseIds = (cases ?? []).map((c) => c.id);
  const { data: dossiers } =
    caseIds.length === 0
      ? { data: [] as Array<{ case_id: string; payload: unknown; image_attachment_id: string | null }> }
      : await supabase
          .from('dossiers')
          .select('case_id, payload, image_attachment_id')
          .in('case_id', caseIds);
  const dossiersByCase = new Map(
    (dossiers ?? []).map((d) => [d.case_id as string, d] as const),
  );

  // Resolve portraits: we only need the dossier's pointer (the case page
  // sets it after the first generate-image roundtrip). For older dossier
  // rows that pre-date Phase 5.3 the pointer may be null — fall back to
  // the newest generated_portrait attachment per case.
  const portraitAttachmentByCase = new Map<string, string>();
  for (const d of dossiers ?? []) {
    if (d.image_attachment_id) {
      portraitAttachmentByCase.set(d.case_id as string, d.image_attachment_id as string);
    }
  }
  const missingIds = caseIds.filter((id) => !portraitAttachmentByCase.has(id));
  if (missingIds.length > 0) {
    const { data: extras } = await supabase
      .from('attachments')
      .select('id, case_id, created_at')
      .in('case_id', missingIds)
      .eq('kind', 'generated_portrait')
      .order('created_at', { ascending: false });
    for (const a of extras ?? []) {
      const cid = a.case_id as string;
      // First write wins because the rows arrive newest-first.
      if (!portraitAttachmentByCase.has(cid)) {
        portraitAttachmentByCase.set(cid, a.id as string);
      }
    }
  }

  // Mint signed URLs in parallel. Failures fall through silently — the
  // printable sheet renders a placeholder when the portrait is missing.
  const portraitUrlByCase = new Map<string, string>();
  await Promise.all(
    Array.from(portraitAttachmentByCase.entries()).map(async ([caseId, attId]) => {
      try {
        const signed = await signedUrlForAttachment(attId, 600);
        portraitUrlByCase.set(caseId, signed.url);
      } catch {
        // Swallow — sheet placeholder will cover it.
      }
    }),
  );

  // Pair each case with its dossier; cases without a dossier are dropped.
  const sheets = (cases ?? [])
    .map((c) => ({
      caseId: c.id as string,
      payload: dossiersByCase.get(c.id as string)?.payload as DossierPayload | undefined,
      portraitUrl: portraitUrlByCase.get(c.id as string),
    }))
    .filter((s): s is { caseId: string; payload: DossierPayload; portraitUrl: string | undefined } =>
      s.payload != null,
    );

  return (
    <main className="mx-auto max-w-[210mm] px-0 py-8 print:py-0">
      <div className="no-print mb-6 px-6">
        <h1 className="font-casefile text-4xl">{t.title}</h1>
        <p className="mt-2 text-ink/70">{t.intro}</p>
        <JournalPrintButton label={t.print} />
      </div>

      {sheets.length === 0 ? (
        <div className="px-6 no-print">
          <p className="text-ink/60">{t.empty}</p>
          <a
            href="/cases"
            className="mt-3 inline-flex rounded-md border border-ink/20 px-4 py-2 text-sm hover:bg-ink/5"
          >
            {dict.cases.title}
          </a>
        </div>
      ) : (
        sheets.map((s) => (
          // Per-sheet labels follow the dossier's own language so each
          // page reads in one tongue from header to footer, even if the
          // user's profile preference differs.
          <PrintableSheet key={s.caseId} payload={s.payload} portraitUrl={s.portraitUrl} />
        ))
      )}
    </main>
  );
}
