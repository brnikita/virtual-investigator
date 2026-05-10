import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/dictionaries';

// Server-rendered list of the player's cases. RLS already restricts the
// select to rows where owner_id = auth.uid(), so we don't filter by owner
// in code — the policy is the source of truth.

type CaseStatus = 'draft' | 'interviewing' | 'ready' | 'archived';

export default async function CasesPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/cases');

  const { data: profile } = await supabase
    .from('profiles')
    .select('preferred_language')
    .eq('id', user.id)
    .maybeSingle();
  const preferredLanguage: 'ru' | 'en' =
    profile?.preferred_language === 'en' ? 'en' : 'ru';
  const t = (await getDictionary(preferredLanguage)) as {
    cases: { title: string; empty: string; newCase: string; openCase: string; createdAt: string };
    caseStatus: Record<CaseStatus, string>;
  };

  const { data: cases } = await supabase
    .from('cases')
    .select('id, suspect_name, status, language, created_at')
    .order('created_at', { ascending: false });

  const dateFormatter = new Intl.DateTimeFormat(preferredLanguage === 'ru' ? 'ru-RU' : 'en-US', {
    dateStyle: 'medium',
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-baseline justify-between">
        <h1 className="font-casefile text-4xl">{t.cases.title}</h1>
        <Link
          href="/new"
          className="rounded-md bg-stamp px-4 py-2 text-sm text-white shadow hover:opacity-90"
        >
          {t.cases.newCase}
        </Link>
      </div>

      {!cases || cases.length === 0 ? (
        <p className="mt-10 text-ink/60">{t.cases.empty}</p>
      ) : (
        <ul className="mt-8 divide-y divide-ink/10 rounded-md border border-ink/10 bg-paper">
          {cases.map((c) => {
            const status = c.status as CaseStatus;
            return (
              <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/case/${c.id}`} className="block truncate font-medium hover:underline">
                    {c.suspect_name}
                  </Link>
                  <div className="mt-1 text-xs text-ink/50">
                    {t.cases.createdAt}: {dateFormatter.format(new Date(c.created_at))} · {c.language.toUpperCase()}
                  </div>
                </div>
                <StatusBadge status={status} label={t.caseStatus[status]} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function StatusBadge({ status, label }: { status: CaseStatus; label: string }) {
  const tone: Record<CaseStatus, string> = {
    draft: 'bg-ink/10 text-ink/70',
    interviewing: 'bg-amber-100 text-amber-800',
    ready: 'bg-emerald-100 text-emerald-800',
    archived: 'bg-ink/5 text-ink/50',
  };
  return (
    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${tone[status]}`}>
      {label}
    </span>
  );
}
