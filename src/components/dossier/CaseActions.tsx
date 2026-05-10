'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { DossierPayload } from '@/types/domain';
import { PrintableSheet } from './PrintableSheet';
import { DossierEditor } from './DossierEditor';

// Single client surface for the case overview page. Keeps every interactive
// concern (compose, regenerate portrait, edit, save, download) collocated so
// the page itself can stay a plain Server Component.

export interface DossierActionLabels {
  title: string;
  regenerate: string;
  generatePortrait: string;
  generatingPortrait: string;
  portraitError: string;
  print: string;
  downloadPdf: string;
  compose: string;
  composing: string;
  composeError: string;
  noDossier: string;
  edit: string;
  editorTitle: string;
  save: string;
  saving: string;
  saveError: string;
  saved: string;
  headline: string;
  subheadline: string;
  identity: string;
  observations: string;
  scales: string;
  exhibits: string;
  lastSeen: string;
  conclusion: string;
  addRow: string;
  remove: string;
  fieldKey: string;
  fieldValue: string;
  scaleLabel: string;
  scaleValue: string;
  scaleMax: string;
}

export function CaseActions({
  caseId,
  labels,
  initialPayload,
  initialPortraitUrl,
  appearanceNotes,
  referencePhotoPath,
}: {
  caseId: string;
  labels: DossierActionLabels;
  initialPayload: DossierPayload | null;
  initialPortraitUrl: string | null;
  appearanceNotes: string[];
  referencePhotoPath: string | null;
}) {
  const router = useRouter();
  const [payload, setPayload] = useState<DossierPayload | null>(initialPayload);
  const [portraitUrl, setPortraitUrl] = useState<string | null>(initialPortraitUrl);
  const [composing, setComposing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const compose = useCallback(async () => {
    setError(null);
    setComposing(true);
    try {
      const res = await fetch(`/api/dossier/${caseId}/compose`, { method: 'POST' });
      if (!res.ok) throw new Error('compose failed');
      const body = (await res.json()) as { dossier: { payload: DossierPayload } };
      setPayload(body.dossier.payload);
      // Refresh server props so the next navigation sees the new dossier
      // (and so things like the "ready" status get picked up elsewhere).
      startTransition(() => router.refresh());
    } catch {
      setError(labels.composeError);
    } finally {
      setComposing(false);
    }
  }, [caseId, labels.composeError, router]);

  const generatePortrait = useCallback(async () => {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch(`/api/dossier/${caseId}/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appearanceNotes,
          // Forward the path so the route can later use it as a soft hint.
          // (Route currently TODOs the actual download — wiring stays in
          // place for when that lands.)
          ...(referencePhotoPath ? { referencePhotoPath } : {}),
        }),
      });
      if (!res.ok) throw new Error('image gen failed');
      // The new portrait lives behind a fresh signed URL — easiest path is
      // a server refresh, which re-runs the page loader and re-mints it.
      startTransition(() => router.refresh());
    } catch {
      setError(labels.portraitError);
    } finally {
      setGenerating(false);
    }
  }, [appearanceNotes, caseId, labels.portraitError, referencePhotoPath, router]);

  const save = useCallback(
    async (next: DossierPayload) => {
      const previous = payload;
      // Optimistic update — revert on failure.
      setPayload(next);
      try {
        const res = await fetch(`/api/dossier/${caseId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: next }),
        });
        if (!res.ok) throw new Error('save failed');
        setError(null);
      } catch (err) {
        setPayload(previous);
        throw err;
      }
    },
    [caseId, payload],
  );

  // Keep portrait URL in sync if the parent rerenders with a new server prop.
  // Using a separate effect would be overkill — the next router.refresh()
  // hands us a new initialPortraitUrl, so derive on render.
  if (initialPortraitUrl !== null && initialPortraitUrl !== portraitUrl) {
    // Safe: only triggers on prop change, no infinite loop because we only
    // setState when the values actually differ.
    setPortraitUrl(initialPortraitUrl);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {!payload ? (
          <button
            onClick={compose}
            disabled={composing}
            className="rounded-md bg-stamp px-4 py-2 text-white shadow disabled:opacity-50"
          >
            {composing ? labels.composing : labels.compose}
          </button>
        ) : (
          <>
            <button
              onClick={generatePortrait}
              disabled={generating}
              className="rounded-md border border-ink/30 px-4 py-2 disabled:opacity-50"
            >
              {generating
                ? labels.generatingPortrait
                : portraitUrl
                ? labels.regenerate
                : labels.generatePortrait}
            </button>
            <button
              onClick={compose}
              disabled={composing}
              className="rounded-md border border-ink/30 px-4 py-2 disabled:opacity-50"
            >
              {composing ? labels.composing : labels.compose}
            </button>
            <button
              onClick={() => setEditing((v) => !v)}
              className="rounded-md border border-ink/30 px-4 py-2"
            >
              {labels.edit}
            </button>
            <a
              href={`/api/pdf/${caseId}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-ink/30 px-4 py-2"
            >
              {labels.downloadPdf}
            </a>
            <button
              onClick={() => window.print()}
              className="rounded-md border border-ink/30 px-4 py-2"
            >
              {labels.print}
            </button>
          </>
        )}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {!payload ? (
        <p className="rounded-md border border-dashed border-ink/30 bg-paper p-6 text-ink/70">
          {labels.noDossier}
        </p>
      ) : (
        <div className="space-y-8">
          <PrintableSheet payload={payload} portraitUrl={portraitUrl ?? undefined} />
          {editing ? (
            <section className="rounded-xl border border-ink/10 bg-white/70 p-5 shadow-sm no-print">
              <h2 className="font-casefile text-2xl">{labels.editorTitle}</h2>
              <DossierEditor payload={payload} onSave={save} labels={labels} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
