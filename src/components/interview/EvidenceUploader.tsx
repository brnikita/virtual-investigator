'use client';

import { WebcamCapture, type WebcamLabels } from './WebcamCapture';

// Two-tab uploader: webcam snap + file upload. Both feed
// /api/evidence/upload. Step 4.1 wires the webcam path; the drag-and-drop
// file picker lands in 4.2.
export interface EvidenceLabels extends WebcamLabels {
  dropZoneHint: string;
  orPickFile: string;
  fileTypeError: string;
}

export function EvidenceUploader({
  caseId,
  labels,
}: {
  caseId: string;
  labels: EvidenceLabels;
}) {
  const handleUploaded = (attachmentId: string) => {
    // Phase 5 dossier compose hooks into this — for now just log so we can
    // verify the round-trip in the browser console.
    console.log('evidence uploaded', attachmentId);
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <WebcamCapture caseId={caseId} labels={labels} onUploaded={handleUploaded} />
      <div className="rounded-xl border border-dashed border-ink/30 p-4 text-sm text-ink/60">
        {labels.dropZoneHint}{' '}
        <label className="cursor-pointer underline">
          {labels.orPickFile}
          <input type="file" accept="image/*" className="hidden" />
        </label>
      </div>
    </div>
  );
}
