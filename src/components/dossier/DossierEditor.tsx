'use client';

import type { DossierPayload } from '@/types/domain';

// Inline editor for the dossier payload. Presents the same fields as the
// printable sheet, but every text node becomes a contenteditable / input.
// TODO(agent): full implementation. Save with optimistic update via
// `useTransition` + `fetch('/api/dossier/:id/compose', { method: 'PUT' })`.
export function DossierEditor({ payload }: { payload: DossierPayload }) {
  return (
    <div className="space-y-4">
      <p className="text-ink/60">TODO: editable form for {Object.keys(payload).length} fields</p>
    </div>
  );
}
