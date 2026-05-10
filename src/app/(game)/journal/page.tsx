// Printable journal — every "ready" dossier owned by the user, one A4 sheet
// per page. The browser's Print dialog produces the final booklet.
// TODO(agent): query dossiers + portraits, render PrintableSheet for each,
// separate with `.page-break`.
export default async function JournalPage() {
  return (
    <main className="mx-auto max-w-[210mm] px-0 py-8 print:py-0">
      <h1 className="font-casefile text-4xl no-print mb-6">Журнал расследований</h1>
      {/* TODO(agent): list of <PrintableSheet payload={...} /> with .page-break */}
    </main>
  );
}
