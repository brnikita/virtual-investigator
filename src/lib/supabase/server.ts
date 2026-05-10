import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { serverEnv } from '@/lib/env';
import type { Database } from './database.types';

// Cookie-aware Supabase client for Server Components, Server Actions and Route
// Handlers. Refreshing tokens here keeps the user logged in without an extra
// round-trip from the browser.
export async function createSupabaseServer() {
  const env = serverEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(items) {
        try {
          for (const { name, value, options } of items) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies; middleware refreshes the
          // session, so the swallow here is intentional.
        }
      },
    },
  });
}

// Service-role client for server-only privileged operations (e.g. issuing
// signed Storage URLs after our own ownership check). Never import from a
// client component.
export function createSupabaseAdmin() {
  const env = serverEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
