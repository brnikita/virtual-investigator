import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/dictionaries';

// New case form. Server-rendered so the language pref can come from the DB
// without a flash; submission goes through a server action that inserts a
// `cases` row scoped to the authenticated user, then redirects into the
// interview screen.

const CreateCaseSchema = z.object({
  suspect_name: z.string().trim().min(1).max(120),
  language: z.enum(['ru', 'en']),
});

async function createCase(formData: FormData): Promise<void> {
  'use server';
  const parsed = CreateCaseSchema.safeParse({
    suspect_name: formData.get('suspect_name'),
    language: formData.get('language'),
  });
  if (!parsed.success) {
    // Surface a 400-style error by throwing — the framework will render an
    // error boundary. We deliberately do not silently coerce.
    throw new Error('invalid form input');
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Should be unreachable thanks to middleware, but cheap to guard.
    redirect('/login?next=/new');
  }

  // RLS policy on `cases` requires owner_id = auth.uid(); we still set it
  // explicitly so the insert succeeds and we don't rely on a default.
  const { data: row, error } = await supabase
    .from('cases')
    .insert({
      owner_id: user.id,
      suspect_name: parsed.data.suspect_name,
      language: parsed.data.language,
    })
    .select('id')
    .single();
  if (error || !row) {
    throw new Error(error?.message ?? 'failed to create case');
  }

  redirect(`/case/${row.id}/interview`);
}

export default async function NewCasePage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/new');

  const { data: profile } = await supabase
    .from('profiles')
    .select('preferred_language')
    .eq('id', user.id)
    .maybeSingle();
  const preferredLanguage: 'ru' | 'en' =
    profile?.preferred_language === 'en' ? 'en' : 'ru';
  const t = (await getDictionary(preferredLanguage)) as {
    newCase: {
      title: string;
      subtitle: string;
      suspectNameLabel: string;
      suspectNamePlaceholder: string;
      languageLabel: string;
      languageRu: string;
      languageEn: string;
      submit: string;
    };
  };

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="font-casefile text-4xl">{t.newCase.title}</h1>
      <p className="mt-3 text-ink/70">{t.newCase.subtitle}</p>

      <form action={createCase} className="mt-8 space-y-5">
        <label className="block">
          <span className="text-sm text-ink/70">{t.newCase.suspectNameLabel}</span>
          <input
            type="text"
            name="suspect_name"
            required
            maxLength={120}
            placeholder={t.newCase.suspectNamePlaceholder}
            className="mt-1 block w-full rounded-md border border-ink/20 bg-paper px-3 py-2 outline-none focus:border-stamp"
          />
        </label>

        <fieldset className="block">
          <legend className="text-sm text-ink/70">{t.newCase.languageLabel}</legend>
          <div className="mt-2 flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="language"
                value="ru"
                defaultChecked={preferredLanguage === 'ru'}
              />
              <span>{t.newCase.languageRu}</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="language"
                value="en"
                defaultChecked={preferredLanguage === 'en'}
              />
              <span>{t.newCase.languageEn}</span>
            </label>
          </div>
        </fieldset>

        <button
          type="submit"
          className="rounded-md bg-stamp px-5 py-3 text-white shadow hover:opacity-90"
        >
          {t.newCase.submit}
        </button>
      </form>
    </main>
  );
}
