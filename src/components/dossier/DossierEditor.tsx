'use client';

import type { DossierPayload } from '@/types/domain';
import type { DossierActionLabels } from './CaseActions';

// Inline editor stub — fleshed out in PLAN step 5.4.
export function DossierEditor({
  payload,
  onSave: _onSave,
  labels: _labels,
}: {
  payload: DossierPayload;
  onSave: (next: DossierPayload) => Promise<void>;
  labels: DossierActionLabels;
}) {
  return (
    <div className="space-y-4">
      <p className="text-ink/60">TODO 5.4: editable form for {Object.keys(payload).length} fields</p>
    </div>
  );
}
