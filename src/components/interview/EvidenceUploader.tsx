'use client';

import { WebcamCapture } from './WebcamCapture';

// Two-tab uploader: webcam snap + file upload. Both feed
// /api/evidence/upload. Empty state shows "Сфоткай или загрузи фото
// подозреваемого, чтобы Инспектор увидел его лицо."
export function EvidenceUploader({ caseId }: { caseId: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <WebcamCapture caseId={caseId} />
      <div className="rounded-xl border border-dashed border-ink/30 p-4 text-sm text-ink/60">
        Перетащи фото сюда или {' '}
        <label className="cursor-pointer underline">
          выбери файл
          <input type="file" accept="image/*" className="hidden" />
        </label>
      </div>
    </div>
  );
}
