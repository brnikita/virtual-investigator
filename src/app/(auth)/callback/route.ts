import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

// Supabase OAuth/magic-link callback. Exchanges the `code` query param for a
// session cookie, bootstraps a profile row on first sign-in, then bounces to
// the post-login destination.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createSupabaseServer();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Idempotent — re-logins keep the existing display_name/preferred_language
        // intact thanks to onConflict and ignoreDuplicates.
        const emailLocalPart = user.email ? user.email.split('@')[0] : null;
        await supabase
          .from('profiles')
          .upsert(
            {
              id: user.id,
              display_name: emailLocalPart ?? null,
              preferred_language: 'ru',
            },
            { onConflict: 'id', ignoreDuplicates: true },
          );
      }
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
