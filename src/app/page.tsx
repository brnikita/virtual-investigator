import Link from 'next/link';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { defaultLocale } from '@/lib/i18n/config';

// Public landing page. The visitor hasn't picked a language yet, so we serve
// the default locale (RU) here. The (game) area swaps in the case-language
// dictionary once the user is authenticated and has chosen a case.
export default async function HomePage() {
  const dict = await getDictionary(defaultLocale);
  const t = dict.app;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-casefile text-5xl">{t.title}</h1>
      <p className="mt-4 text-lg text-ink/80">
        {t.tagline}. {t.intro}
      </p>
      <div className="mt-10 flex gap-4">
        <Link
          href="/new"
          className="rounded-md bg-stamp px-5 py-3 text-white shadow hover:opacity-90"
        >
          {t.cta}
        </Link>
        <Link
          href="/journal"
          className="rounded-md border border-ink/20 px-5 py-3 hover:bg-ink/5"
        >
          {t.openJournal}
        </Link>
      </div>
    </main>
  );
}
