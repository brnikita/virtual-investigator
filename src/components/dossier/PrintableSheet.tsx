import type { DossierPayload } from '@/types/domain';

// Static A4 sheet that mirrors samples/Nastya/*.png on screen and on paper.
// Pure presentational component — no data fetching here, the parent page
// handles that. Section labels follow the dossier's own language so the
// printed output reads in one tongue from header to footer.
export interface PrintableSheetLabels {
  observations: string;
  scales: string;
  exhibits: string;
  lastSeen: string;
  conclusion: string;
  facialComposite: string;
}

const FALLBACK_LABELS: Record<'ru' | 'en', PrintableSheetLabels> = {
  ru: {
    observations: 'Сведения из наблюдений',
    scales: 'Уровень опасности',
    exhibits: 'Вещдоки',
    lastSeen: 'Последнее место',
    conclusion: 'Вывод комиссии',
    facialComposite: 'фоторобот',
  },
  en: {
    observations: 'Observations',
    scales: 'Danger scale',
    exhibits: 'Exhibits',
    lastSeen: 'Last seen',
    conclusion: 'Conclusion',
    facialComposite: 'facial composite',
  },
};

export function PrintableSheet({
  payload,
  portraitUrl,
  labels,
}: {
  payload: DossierPayload;
  portraitUrl?: string;
  labels?: PrintableSheetLabels;
}) {
  // Fall back to language-keyed defaults so callers that don't have a
  // dictionary handy (e.g. early scaffolding) still render something
  // sensible in the right tongue.
  const l = labels ?? FALLBACK_LABELS[payload.language];
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
            <img src={portraitUrl} alt={l.facialComposite} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-ink/40">{l.facialComposite}</div>
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
        <h2 className="font-casefile text-2xl">{l.observations}</h2>
        <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {payload.observations.map((o, i) => (
            <li key={i} className="before:mr-2 before:content-['—']">{o}</li>
          ))}
        </ul>
      </section>
      <section className="mt-6 grid grid-cols-3 gap-4 text-sm">
        <div>
          <h3 className="font-casefile text-lg">{l.scales}</h3>
          <ul className="mt-1 space-y-0.5">
            {payload.scales.map((s) => (
              <li key={s.label} className="flex justify-between">
                <span>{s.label}</span>
                <span aria-label={`${s.value} / ${s.max}`}>
                  {'★'.repeat(s.value)}{'☆'.repeat(s.max - s.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-casefile text-lg">{l.exhibits}</h3>
          <ul className="mt-1 space-y-0.5">
            {payload.exhibits.map((e, i) => <li key={i}>— {e}</li>)}
          </ul>
        </div>
        <div>
          <h3 className="font-casefile text-lg">{l.lastSeen}</h3>
          <p className="mt-1 italic">{payload.last_seen}</p>
        </div>
      </section>
      <footer className="absolute inset-x-8 bottom-6 border-t-2 border-ink/40 pt-3 text-sm italic">
        {l.conclusion}: {payload.conclusion}
      </footer>
    </article>
  );
}
