'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { WebcamCapture, type WebcamLabels } from './WebcamCapture';

// Two-tab uploader: webcam snap + file upload. Both feed
// /api/evidence/upload and surface the same dispatched event so the dossier
// compose path (Phase 5) can hook in without caring which path the photo
// came from.
export interface EvidenceLabels extends WebcamLabels {
  dropZoneHint: string;
  orPickFile: string;
  fileTypeError: string;
}

interface UploadResult {
  attachmentId: string;
  previewUrl: string;
  fileName: string;
  fileSize: number;
}

// Shared client-side helper. Kept in this file (not /lib) because it's
// browser-only and only the uploader component needs it.
async function uploadSuspectPhoto(file: File, caseId: string): Promise<{ id: string }> {
  const fd = new FormData();
  fd.append('caseId', caseId);
  fd.append('kind', 'suspect_photo');
  fd.append('file', file);
  const res = await fetch('/api/evidence/upload', { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  const body = (await res.json()) as { attachment: { id: string } };
  return { id: body.attachment.id };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dispatchUploaded(attachmentId: string) {
  // Fire a custom DOM event so anything mounted in the page (Phase 5
  // dossier panel) can react without a prop chain.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('evidence:uploaded', { detail: { attachmentId } }));
  }
  console.log('evidence uploaded', attachmentId);
}

export function EvidenceUploader({
  caseId,
  labels,
  onUploaded,
}: {
  caseId: string;
  labels: EvidenceLabels;
  onUploaded?: (attachmentId: string) => void;
}) {
  const fileInputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  const handleWebcamUploaded = useCallback(
    (attachmentId: string) => {
      dispatchUploaded(attachmentId);
      onUploaded?.(attachmentId);
    },
    [onUploaded],
  );

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError(labels.fileTypeError);
        return;
      }
      setError(null);
      setBusy(true);
      try {
        const { id } = await uploadSuspectPhoto(file, caseId);
        const previewUrl = URL.createObjectURL(file);
        // Replace any previous preview so we don't leak object URLs.
        setResult((prev) => {
          if (prev) URL.revokeObjectURL(prev.previewUrl);
          return { attachmentId: id, previewUrl, fileName: file.name, fileSize: file.size };
        });
        dispatchUploaded(id);
        onUploaded?.(id);
      } catch {
        setError(labels.uploadError);
      } finally {
        setBusy(false);
      }
    },
    [caseId, labels.fileTypeError, labels.uploadError, onUploaded],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      void handleFile(file);
    },
    [handleFile],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      void handleFile(file);
      // Reset so re-picking the same file still fires onChange.
      e.target.value = '';
    },
    [handleFile],
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <WebcamCapture caseId={caseId} labels={labels} onUploaded={handleWebcamUploaded} />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={
          'flex flex-col gap-3 rounded-xl border border-dashed p-4 text-sm transition ' +
          (dragOver ? 'border-marker bg-marker/10 text-ink' : 'border-ink/30 text-ink/60')
        }
      >
        <p>
          {labels.dropZoneHint}{' '}
          <label htmlFor={fileInputId} className="cursor-pointer underline">
            {labels.orPickFile}
          </label>
          <input
            id={fileInputId}
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPick}
          />
        </p>

        {busy && <p className="text-ink/60">{labels.uploading}</p>}

        {result && (
          <div className="flex items-start gap-3 rounded-md border border-ink/10 bg-white/70 p-2">
            {/* Plain <img> — the preview comes from a local object URL, no
                need for next/image's remote-pattern dance. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.previewUrl}
              alt={result.fileName}
              className="h-16 w-16 flex-shrink-0 rounded object-cover"
            />
            <div className="min-w-0 flex-1 text-xs text-ink/70">
              <div className="truncate font-medium text-ink">{result.fileName}</div>
              <div>{formatBytes(result.fileSize)}</div>
              <div className="mt-1 font-semibold text-emerald-700">{labels.uploaded}</div>
            </div>
          </div>
        )}

        {error && <p className="text-red-600">{error}</p>}
      </div>
    </div>
  );
}
