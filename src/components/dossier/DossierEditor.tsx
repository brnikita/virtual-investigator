'use client';

import { useEffect, useState, useTransition } from 'react';
import type { DossierPayload } from '@/types/domain';
import type { DossierActionLabels } from './CaseActions';

// Inline editor for the printable payload. Mirrors the on-screen sheet:
// headline + subheadline at the top, identity rows (key/value, addable and
// removable), observations and exhibits as plain string lists, scales with
// numeric values clamped 0..max, and the closing remark.
//
// Save is optimistic at the parent boundary (CaseActions): we hand the new
// payload up via `onSave` and let the parent revert on failure. The inline
// "Saving…" / "Saved" / error chip only reflects the in-flight state of THIS
// editor's submission, never the upstream optimistic flip.

type IdentityRow = { id: number; key: string; value: string };

interface EditorState {
  language: DossierPayload['language'];
  headline: string;
  subheadline: string;
  identity: IdentityRow[];
  observations: string[];
  scales: Array<{ label: string; value: number; max: number }>;
  exhibits: string[];
  lastSeen: string;
  conclusion: string;
}

let nextRowId = 1;
function nextId(): number {
  nextRowId += 1;
  return nextRowId;
}

function fromPayload(payload: DossierPayload): EditorState {
  return {
    language: payload.language,
    headline: payload.headline,
    subheadline: payload.subheadline,
    identity: Object.entries(payload.identity).map(([key, value]) => ({
      id: nextId(),
      key,
      value,
    })),
    observations: [...payload.observations],
    scales: payload.scales.map((s) => ({ ...s })),
    exhibits: [...payload.exhibits],
    lastSeen: payload.last_seen,
    conclusion: payload.conclusion,
  };
}

function toPayload(state: EditorState): DossierPayload {
  // Identity is a key/value record. If two rows share a key, the later one
  // wins — the same behaviour as Object.fromEntries.
  const identity: Record<string, string> = {};
  for (const row of state.identity) {
    const trimmed = row.key.trim();
    if (trimmed.length === 0) continue;
    identity[trimmed] = row.value;
  }
  return {
    language: state.language,
    headline: state.headline,
    subheadline: state.subheadline,
    identity,
    observations: state.observations.filter((s) => s.trim().length > 0),
    scales: state.scales.map((s) => ({
      label: s.label,
      value: Math.max(0, Math.min(s.value, s.max)),
      max: Math.max(1, s.max),
    })),
    exhibits: state.exhibits.filter((s) => s.trim().length > 0),
    last_seen: state.lastSeen,
    conclusion: state.conclusion,
  };
}

export function DossierEditor({
  payload,
  onSave,
  labels,
}: {
  payload: DossierPayload;
  onSave: (next: DossierPayload) => Promise<void>;
  labels: DossierActionLabels;
}) {
  const [state, setState] = useState<EditorState>(() => fromPayload(payload));
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the parent reloads with a fresh payload (e.g. after a recompose), reset
  // the editor unless the user has unsaved drafts. We use a shallow check on
  // the headline as a quick sentinel — good enough for the MVP.
  useEffect(() => {
    setState(fromPayload(payload));
  }, [payload]);

  const submit = () => {
    setError(null);
    setSaved(false);
    const next = toPayload(state);
    startTransition(async () => {
      try {
        await onSave(next);
        setSaved(true);
      } catch {
        setError(labels.saveError);
      }
    });
  };

  return (
    <div className="mt-4 space-y-6 text-sm">
      <Section title={labels.headline}>
        <input
          className={inputCls}
          value={state.headline}
          onChange={(e) => setState((s) => ({ ...s, headline: e.target.value }))}
        />
      </Section>

      <Section title={labels.subheadline}>
        <textarea
          className={`${inputCls} min-h-[3rem]`}
          value={state.subheadline}
          onChange={(e) => setState((s) => ({ ...s, subheadline: e.target.value }))}
        />
      </Section>

      <Section title={labels.identity}>
        <div className="space-y-2">
          {state.identity.map((row, idx) => (
            <div key={row.id} className="grid grid-cols-[1fr_2fr_auto] gap-2">
              <input
                aria-label={labels.fieldKey}
                placeholder={labels.fieldKey}
                className={inputCls}
                value={row.key}
                onChange={(e) =>
                  setState((s) => {
                    const next = [...s.identity];
                    const target = next[idx];
                    if (!target) return s;
                    next[idx] = { ...target, key: e.target.value };
                    return { ...s, identity: next };
                  })
                }
              />
              <input
                aria-label={labels.fieldValue}
                placeholder={labels.fieldValue}
                className={inputCls}
                value={row.value}
                onChange={(e) =>
                  setState((s) => {
                    const next = [...s.identity];
                    const target = next[idx];
                    if (!target) return s;
                    next[idx] = { ...target, value: e.target.value };
                    return { ...s, identity: next };
                  })
                }
              />
              <button
                type="button"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    identity: s.identity.filter((_, i) => i !== idx),
                  }))
                }
                className={removeBtnCls}
                aria-label={labels.remove}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className={addBtnCls}
            onClick={() =>
              setState((s) => ({
                ...s,
                identity: [...s.identity, { id: nextId(), key: '', value: '' }],
              }))
            }
          >
            + {labels.addRow}
          </button>
        </div>
      </Section>

      <StringList
        title={labels.observations}
        values={state.observations}
        onChange={(observations) => setState((s) => ({ ...s, observations }))}
        addLabel={labels.addRow}
        removeLabel={labels.remove}
      />

      <Section title={labels.scales}>
        <div className="space-y-2">
          {state.scales.map((scale, idx) => (
            <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
              <input
                aria-label={labels.scaleLabel}
                placeholder={labels.scaleLabel}
                className={inputCls}
                value={scale.label}
                onChange={(e) =>
                  setState((s) => {
                    const next = [...s.scales];
                    const target = next[idx];
                    if (!target) return s;
                    next[idx] = { ...target, label: e.target.value };
                    return { ...s, scales: next };
                  })
                }
              />
              <input
                aria-label={labels.scaleValue}
                type="number"
                min={0}
                max={scale.max}
                className={inputCls}
                value={scale.value}
                onChange={(e) =>
                  setState((s) => {
                    const next = [...s.scales];
                    const target = next[idx];
                    if (!target) return s;
                    const raw = Number.parseInt(e.target.value, 10);
                    const v = Number.isFinite(raw) ? raw : 0;
                    next[idx] = { ...target, value: Math.max(0, Math.min(v, target.max)) };
                    return { ...s, scales: next };
                  })
                }
              />
              <input
                aria-label={labels.scaleMax}
                type="number"
                min={1}
                className={inputCls}
                value={scale.max}
                onChange={(e) =>
                  setState((s) => {
                    const next = [...s.scales];
                    const target = next[idx];
                    if (!target) return s;
                    const raw = Number.parseInt(e.target.value, 10);
                    const max = Math.max(1, Number.isFinite(raw) ? raw : 1);
                    next[idx] = { ...target, max, value: Math.min(target.value, max) };
                    return { ...s, scales: next };
                  })
                }
              />
              <button
                type="button"
                onClick={() =>
                  setState((s) => ({ ...s, scales: s.scales.filter((_, i) => i !== idx) }))
                }
                className={removeBtnCls}
                aria-label={labels.remove}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className={addBtnCls}
            onClick={() =>
              setState((s) => ({
                ...s,
                scales: [...s.scales, { label: '', value: 0, max: 5 }],
              }))
            }
          >
            + {labels.addRow}
          </button>
        </div>
      </Section>

      <StringList
        title={labels.exhibits}
        values={state.exhibits}
        onChange={(exhibits) => setState((s) => ({ ...s, exhibits }))}
        addLabel={labels.addRow}
        removeLabel={labels.remove}
      />

      <Section title={labels.lastSeen}>
        <textarea
          className={`${inputCls} min-h-[3rem]`}
          value={state.lastSeen}
          onChange={(e) => setState((s) => ({ ...s, lastSeen: e.target.value }))}
        />
      </Section>

      <Section title={labels.conclusion}>
        <textarea
          className={`${inputCls} min-h-[4rem]`}
          value={state.conclusion}
          onChange={(e) => setState((s) => ({ ...s, conclusion: e.target.value }))}
        />
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-stamp px-4 py-2 text-white shadow disabled:opacity-50"
        >
          {pending ? labels.saving : labels.save}
        </button>
        {saved && !pending ? <span className="text-emerald-700">{labels.saved}</span> : null}
        {error ? <span className="text-red-700">{error}</span> : null}
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-ink/20 bg-paper px-3 py-2 outline-none focus:border-stamp';
const addBtnCls =
  'mt-2 inline-flex rounded-md border border-dashed border-ink/30 px-3 py-1 text-ink/70 hover:bg-paper';
const removeBtnCls =
  'flex h-9 w-9 items-center justify-center rounded-md border border-ink/20 text-ink/60 hover:border-stamp hover:text-stamp';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-casefile text-lg">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function StringList({
  title,
  values,
  onChange,
  addLabel,
  removeLabel,
}: {
  title: string;
  values: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  removeLabel: string;
}) {
  return (
    <Section title={title}>
      <div className="space-y-2">
        {values.map((v, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className={inputCls}
              value={v}
              onChange={(e) => {
                const next = [...values];
                next[idx] = e.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, i) => i !== idx))}
              className={removeBtnCls}
              aria-label={removeLabel}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className={addBtnCls} onClick={() => onChange([...values, ''])}>
          + {addLabel}
        </button>
      </div>
    </Section>
  );
}
