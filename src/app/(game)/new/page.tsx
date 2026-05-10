// New case form. Captures suspect name + language, creates a `cases` row, then
// redirects to /case/[id]/interview.
// TODO(agent): wire up server action `createCase(formData)` that inserts via
// the SSR Supabase client, returning the new id.
export default function NewCasePage() {
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="font-casefile text-4xl">Новое дело</h1>
      <p className="mt-3 text-ink/70">Кого будем «допрашивать»?</p>
      {/* TODO(agent): name input, language switch, submit button */}
    </main>
  );
}
