'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Browser-side webcam snap. We deliberately do NOT call getUserMedia on mount
// — iOS/Safari requires a user gesture, and a silent prompt at page load is
// hostile UX anyway. The flow is: idle -> live preview -> frozen frame ->
// upload -> idle. Frames are scaled down so the long edge is at most 1024 px;
// uploads stay well under a megabyte at JPEG quality 0.9.
export interface WebcamLabels {
  takePhoto: string;
  snap: string;
  retake: string;
  useThis: string;
  uploading: string;
  uploaded: string;
  cameraError: string;
  uploadError: string;
}

type Phase = 'idle' | 'live' | 'frozen' | 'uploading' | 'done';

const MAX_LONG_EDGE = 1024;

export function WebcamCapture({
  caseId,
  labels,
  onUploaded,
}: {
  caseId: string;
  labels: WebcamLabels;
  onUploaded?: (attachmentId: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    for (const track of stream.getTracks()) track.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Always release the camera when this component unmounts; iOS keeps the
  // green LED on otherwise.
  useEffect(() => stopStream, [stopStream]);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        // Older Safari needs the explicit play() — autoplay alone is unreliable
        // when the element wasn't visible at first paint.
        await video.play().catch(() => undefined);
      }
      setPhase('live');
    } catch {
      setError(labels.cameraError);
      setPhase('idle');
    }
  }, [labels.cameraError]);

  const snap = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const sw = video.videoWidth;
    const sh = video.videoHeight;
    if (!sw || !sh) return;
    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(sw, sh));
    const dw = Math.round(sw * scale);
    const dh = Math.round(sh * scale);
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, dw, dh);
    setPhase('frozen');
  }, []);

  const retake = useCallback(() => {
    setError(null);
    setPhase('live');
  }, []);

  const useThis = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setPhase('uploading');
    setError(null);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9),
    );
    if (!blob) {
      setError(labels.uploadError);
      setPhase('frozen');
      return;
    }
    const fd = new FormData();
    fd.append('caseId', caseId);
    fd.append('kind', 'suspect_photo');
    fd.append('file', new File([blob], `snap-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    try {
      const res = await fetch('/api/evidence/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('upload failed');
      const { attachment } = (await res.json()) as { attachment: { id: string } };
      onUploaded?.(attachment.id);
      stopStream();
      setPhase('done');
    } catch {
      setError(labels.uploadError);
      setPhase('frozen');
    }
  }, [caseId, labels.uploadError, onUploaded, stopStream]);

  return (
    <div className="rounded-xl border border-ink/10 bg-white/60 p-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
        <video
          ref={videoRef}
          className={phase === 'live' ? 'h-full w-full object-cover' : 'hidden'}
          autoPlay
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className={
            phase === 'frozen' || phase === 'uploading' || phase === 'done'
              ? 'h-full w-full object-contain'
              : 'hidden'
          }
        />
        {phase === 'idle' && (
          <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
            {labels.takePhoto}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {phase === 'idle' && (
          <button
            type="button"
            onClick={startCamera}
            className="rounded-md bg-marker px-3 py-1.5 text-sm font-semibold text-ink"
          >
            {labels.takePhoto}
          </button>
        )}
        {phase === 'live' && (
          <button
            type="button"
            onClick={snap}
            className="rounded-md bg-marker px-3 py-1.5 text-sm font-semibold text-ink"
          >
            {labels.snap}
          </button>
        )}
        {phase === 'frozen' && (
          <>
            <button
              type="button"
              onClick={useThis}
              className="rounded-md bg-marker px-3 py-1.5 text-sm font-semibold text-ink"
            >
              {labels.useThis}
            </button>
            <button
              type="button"
              onClick={retake}
              className="rounded-md border border-ink/30 px-3 py-1.5 text-sm text-ink"
            >
              {labels.retake}
            </button>
          </>
        )}
        {phase === 'uploading' && <span className="text-sm text-ink/60">{labels.uploading}</span>}
        {phase === 'done' && (
          <span className="text-sm font-semibold text-emerald-700">{labels.uploaded}</span>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
