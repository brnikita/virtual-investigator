'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/i18n/config';

// Per-case language switcher. Calls a server action that writes
// `cases.language`, then asks the router to refresh the overview so the
// dictionary, the dossier composer, and the next interview all swap.
//
// We keep this component dumb on purpose: the action is passed in by the
// page so server-only modules don't leak into the client bundle.
export function LangSwitcher({
  value,
  onChange,
  pickerLabel,
  savingLabel,
}: {
  value: Locale;
  onChange: (next: Locale) => Promise<void>;
  pickerLabel: string;
  savingLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const select = (next: Locale) => {
    if (next === value || pending) return;
    startTransition(async () => {
      await onChange(next);
      // The action revalidates the path; refresh ensures the in-memory
      // tree picks the new server payload up immediately.
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-ink/60">{pickerLabel}:</span>
      <div
        className="inline-flex overflow-hidden rounded-md border border-ink/20"
        role="group"
        aria-label={pickerLabel}
      >
        {(['ru', 'en'] as const).map((l) => {
          const active = l === value;
          return (
            <button
              key={l}
              type="button"
              onClick={() => select(l)}
              disabled={pending}
              aria-pressed={active}
              className={
                active
                  ? 'bg-ink px-3 py-1 text-paper'
                  : 'px-3 py-1 hover:bg-ink/10 disabled:opacity-50'
              }
            >
              {l.toUpperCase()}
            </button>
          );
        })}
      </div>
      {pending ? <span className="text-ink/50">{savingLabel}</span> : null}
    </div>
  );
}
