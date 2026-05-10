'use client';

import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase/client';

// Magic-link login. Client component so we can call signInWithOtp directly
// from the browser; the actual cookie session is established later by the
// (auth)/callback route after the user clicks the link in their email.
//
// Strings are not extracted to the dictionary at this point because the page
// runs before the user has chosen a language; we render RU + EN side by side.
export default function LoginPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/cases';

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setErrorMessage(null);

    const supabase = createSupabaseBrowser();
    // Route group `(auth)` is invisible in the URL, so the callback handler at
    // src/app/(auth)/callback/route.ts is served from `/callback`.
    const redirectTo = `${window.location.origin}/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }
    setStatus('sent');
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-casefile text-4xl">Вход / Sign in</h1>
      <p className="mt-3 text-ink/70">
        Введи свой email — пришлём волшебную ссылку.
        <br />
        Enter your email and we&apos;ll send a magic link.
      </p>

      {status === 'sent' ? (
        <div
          role="status"
          className="mt-8 rounded-md border border-ink/15 bg-ink/5 px-4 py-3 text-ink/80"
        >
          Готово! Проверь почту — мы отправили волшебную ссылку для входа.
          <br />
          Check your inbox — we sent you a magic sign-in link.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm text-ink/70">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ты@школа.ру"
              className="mt-1 block w-full rounded-md border border-ink/20 bg-paper px-3 py-2 outline-none focus:border-stamp"
            />
          </label>
          <button
            type="submit"
            disabled={status === 'sending' || email.length === 0}
            className="rounded-md bg-stamp px-5 py-3 text-white shadow disabled:opacity-50"
          >
            {status === 'sending' ? 'Отправляем… / Sending…' : 'Отправить ссылку / Send link'}
          </button>
          {status === 'error' ? (
            <p role="alert" className="text-sm text-red-600">
              {errorMessage ?? 'Не удалось отправить ссылку. Try again.'}
            </p>
          ) : null}
        </form>
      )}
    </main>
  );
}
