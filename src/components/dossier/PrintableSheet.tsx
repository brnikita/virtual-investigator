import type { DossierPayload } from '@/types/domain';

// Static A4 sheet that mirrors samples/Nastya/*.png on screen and on paper.
// Pure presentational component — no data fetching here, the parent page
// handles that.
//
// TODO(agent): flesh out the full layout: header bar with stamps, photo card
// (left), identity table (right), observations block, danger-scale, exhibits,
// last-seen, footer. Use Tailwind classes only — no global CSS.
export function PrintableSheet({
  payload,
  portraitUrl,
}: {
  payload: DossierPayload;
  portraitUrl?: string;
}) {
  return (
    <article className="page-break relative mx-auto h-[297mm] w-[210mm] overflow-hidden bg-paper bg-grid bg-grid-sm p-8 shadow-lg print:shadow-none">
      <header className="border-b-2 border-ink/40 pb-3">
        <h1 className="font-casefile text-4xl tracking-wide">{payload.headline}</h1>
        <p className="mt-1 italic text-ink/70">{payload.subheadline}</p>
      </header>
      <div className="mt-6 grid grid-cols-[1fr_1fr] gap-6">
        <div className="aspect-[3/4] rounded border-2 border-ink/40 bg-white">
          {portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portraitUrl} alt="фоторобот" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-ink/40">фоторобот</div>
          )}
        </div>
        <dl className="space-y-2 text-base">
          {Object.entries(payload.identity).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[120px_1fr] gap-2">
              <dt className="font-semibold text-ink/60">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <section className="mt-6">
        <h2 className="font-casefile text-2xl">Сведения из наблюдений</h2>
        <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {payload.observations.map((o, i) => (
            <li key={i} className="before:mr-2 before:content-['—']">{o}</li>
          ))}
        </ul>
      </section>
      <section className="mt-6 grid grid-cols-3 gap-4 text-sm">
        <div>
          <h3 className="font-casefile text-lg">Уровень опасности</h3>
          <ul className="mt-1 space-y-0.5">
            {payload.scales.map((s) => (
              <li key={s.label} className="flex justify-between">
                <span>{s.label}</span>
                <span>{'★'.repeat(s.value)}{'☆'.repeat(s.max - s.value)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-casefile text-lg">Вещдоки</h3>
          <ul className="mt-1 space-y-0.5">
            {payload.exhibits.map((e, i) => <li key={i}>— {e}</li>)}
          </ul>
        </div>
        <div>
          <h3 className="font-casefile text-lg">Последнее место</h3>
          <p className="mt-1 italic">{payload.last_seen}</p>
        </div>
      </section>
      <footer className="absolute inset-x-8 bottom-6 border-t-2 border-ink/40 pt-3 text-sm italic">
        Вывод комиссии: {payload.conclusion}
      </footer>
    </article>
  );
}
