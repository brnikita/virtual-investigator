// Case overview = dossier editor. Loads dossier, attachments and evidence,
// renders the editable on-screen sheet, and exposes "Regenerate portrait" /
// "Print" actions.
// TODO(agent): full server-rendered editor, plus client-side mutations via
// fetch('/api/dossier/...').
export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-casefile text-4xl">Досье № {caseId.slice(0, 8)}</h1>
      <p className="mt-2 text-ink/60">TODO: editable dossier view</p>
    </main>
  );
}
