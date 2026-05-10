'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseServer } from '@/lib/supabase/server';

// Server action invoked by the per-case LangSwitcher. RLS already restricts
// the row to the case owner; we still require an authenticated session up
// front so an anonymous client can't no-op the call and learn anything.
const Schema = z.object({
  caseId: z.string().uuid(),
  language: z.enum(['ru', 'en']),
});

export async function updateCaseLanguage(input: { caseId: string; language: 'ru' | 'en' }): Promise<void> {
  const parsed = Schema.parse(input);
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');

  const { error } = await supabase
    .from('cases')
    .update({ language: parsed.language })
    .eq('id', parsed.caseId);
  if (error) throw new Error(error.message);

  // Re-render the overview so the dictionary, headline, and any subsequent
  // interview pick up the new language without a reload.
  revalidatePath(`/case/${parsed.caseId}`);
  revalidatePath(`/case/${parsed.caseId}/interview`);
}
