'use client';

// Per-case language switcher. Updates `cases.language` so the next interview
// runs in that language and the dossier is composed accordingly.
// TODO(agent): wire to a server action.
export function LangSwitcher({ value, onChange }: {
  value: 'ru' | 'en';
  onChange: (next: 'ru' | 'en') => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-ink/20 text-sm">
      {(['ru', 'en'] as const).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={l === value ? 'bg-ink px-3 py-1 text-paper' : 'px-3 py-1 hover:bg-ink/10'}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
