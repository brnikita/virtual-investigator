'use client';

import { useRef } from 'react';

// In-browser webcam snap. After `getUserMedia`, draws a single frame to a
// canvas and POSTs it to /api/evidence/upload as suspect_photo.
// TODO(agent): full implementation. The trick is keeping the camera prompt
// localized and offering a retake before upload.
export function WebcamCapture({ caseId: _caseId, onUploaded }: {
  caseId: string;
  onUploaded?: (attachmentId: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  return (
    <div className="rounded-xl border border-ink/10 bg-white/60 p-4">
      <video ref={videoRef} className="aspect-video w-full rounded-md bg-black" autoPlay playsInline muted />
      <button
        onClick={() => onUploaded?.('todo')}
        className="mt-3 rounded-md bg-marker px-3 py-1.5 text-sm font-semibold text-ink"
      >
        Сфоткать
      </button>
    </div>
  );
}
