'use client';

import { useEffect, useRef, useState } from 'react';
import { transcriptBus, type TranscriptRole } from '@/lib/transcript-bus';

// Live captions panel. Subscribes to TranscriptBus, accumulates assistant
// deltas under a single bubble per item_id, and appends user finals as their
// own bubbles. Auto-scrolls to the newest message so the player can keep up.

interface Bubble {
  id: string;
  role: TranscriptRole;
  text: string;
  final: boolean;
}

export interface TranscriptPanelLabels {
  title: string;
  empty: string;
  detective: string;
  suspect: string;
}

const ROLE_STYLES: Record<TranscriptRole, string> = {
  detective: 'bg-stamp/10 text-ink',
  suspect: 'bg-paper/80 text-ink/80',
};

export function TranscriptPanel({ labels }: { labels: TranscriptPanelLabels }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return transcriptBus.on((turn) => {
      setBubbles((prev) => {
        // Detective deltas with the same itemId belong to one bubble; we
        // append text until the matching `done` arrives.
        if (turn.role === 'detective' && !turn.final && turn.itemId) {
          const idx = prev.findIndex((b) => b.id === turn.itemId && !b.final);
          if (idx >= 0) {
            const next = prev.slice();
            const target = next[idx];
            // noUncheckedIndexedAccess: narrow before use.
            if (target) {
              next[idx] = { ...target, text: target.text + turn.text };
            }
            return next;
          }
        }
        // Detective `done` finalizes the running bubble (if any) by replacing
        // its text with the authoritative full transcript.
        if (turn.role === 'detective' && turn.final && turn.itemId) {
          const idx = prev.findIndex((b) => b.id === turn.itemId);
          if (idx >= 0) {
            const next = prev.slice();
            const target = next[idx];
            if (target) {
              next[idx] = { ...target, text: turn.text, final: true };
            }
            return next;
          }
        }
        // New bubble (either a brand-new detective stream or a user final).
        const id = turn.itemId ?? `${turn.role}-${turn.ts}`;
        return [...prev, { id, role: turn.role, text: turn.text, final: turn.final }];
      });
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [bubbles]);

  return (
    <div className="rounded-xl border border-ink/10 bg-white/60 p-4 text-sm">
      <h3 className="mb-2 font-semibold">{labels.title}</h3>
      <div ref={scrollRef} className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
        {bubbles.length === 0 ? (
          <p className="text-ink/50">{labels.empty}</p>
        ) : (
          bubbles.map((b) => (
            <div key={b.id} className={`rounded-lg px-3 py-2 ${ROLE_STYLES[b.role]}`}>
              <div className="text-xs font-bold uppercase tracking-wide text-ink/60">
                {b.role === 'detective' ? labels.detective : labels.suspect}
              </div>
              <div className="whitespace-pre-wrap break-words">{b.text || '…'}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
