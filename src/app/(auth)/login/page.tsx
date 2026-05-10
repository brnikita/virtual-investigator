// Magic-link login. Kept intentionally minimal — Supabase SSR handles cookies.
// TODO(agent): implement with createSupabaseBrowser().auth.signInWithOtp.
export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-casefile text-4xl">Вход</h1>
      <p className="mt-4 text-ink/70">Введи свой email — пришлём волшебную ссылку.</p>
      {/* TODO(agent): magic-link form */}
    </main>
  );
}
