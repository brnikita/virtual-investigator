'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

// Browser Supabase client. Reads the anon key from NEXT_PUBLIC_* envs that
// Next.js inlines at build time.
export function createSupabaseBrowser() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
