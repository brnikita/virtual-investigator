'use client';

import { useEffect, useRef, useState } from 'react';
import { avatarBus } from '@/lib/avatar-bus';
import { startAvatar, type AvatarController } from '@/lib/simli/client';

// Renders the Simli avatar's <video> element. The <audio> element is the
// fallback playback path if the browser can't decode the realtime track for
// us (Safari notably lacks `MediaStreamTrackProcessor`).
//
// Lifecycle:
//   1. On mount: GET /api/simli/session for { apiKey, faceId }.
//   2. Subscribe to avatarBus 'remote_track' (the OpenAI realtime audio
//      track) and 'end' (peer torn down).
//   3. When the track arrives, call startAvatar() to bring the Simli WebRTC
//      peer up, then bridge audio: MediaStreamTrackProcessor reads raw
//      AudioData frames at 24 kHz mono, we convert Float32 -> Int16, and
//      push each chunk through the controller (which downsamples to 16 kHz
//      and forwards to Simli).
//   4. If MediaStreamTrackProcessor isn't available, mount the track on the
//      <audio> element directly so the user still hears the detective; the
//      avatar will idle but won't lip-sync.
//   5. On 'end' or unmount: stop the controller.
//
// Idle behaviour is handled by the SDK itself (`handleSilence: true` in
// `lib/simli/client.ts`) — the avatar emits its own filler frames between
// speech turns instead of freezing on the last frame.

export interface AvatarStageLabels {
  liveBadge: string;
  offline: string;
  noLipSync: string;
}

interface SessionResponse {
  apiKey: string;
  faceId: string;
}

// `MediaStreamTrackProcessor` is in lib.dom but not in every TS lib version
// we target; the runtime check below is the source of truth.
type AudioDataFrame = {
  numberOfFrames: number;
  numberOfChannels: number;
  sampleRate: number;
  format: string;
  copyTo: (dest: ArrayBufferView, opts: { planeIndex: number; format?: string }) => void;
  close: () => void;
};

function hasMediaStreamTrackProcessor(): boolean {
  return typeof window !== 'undefined' && 'MediaStreamTrackProcessor' in window;
}

// Convert a Float32 audio frame ([-1, 1]) to Int16 PCM mono. We clamp first
// because audio data occasionally contains values outside [-1, 1] after
// processing chains.
function float32ToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function AvatarStage({
  caseId: _caseId,
  labels,
}: {
  caseId: string;
  labels: AvatarStageLabels;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const controllerRef = useRef<AvatarController | null>(null);
  // Track abort controller for the bridge loop so unmount stops the read.
  const bridgeAbortRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noLipSync, setNoLipSync] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let session: SessionResponse | null = null;

    async function loadSession() {
      try {
        const res = await fetch('/api/simli/session');
        if (!res.ok) throw new Error(`session ${res.status}`);
        session = (await res.json()) as SessionResponse;
      } catch {
        // Surface a small chip but keep the rest of the interview alive —
        // the realtime audio still plays through RealtimeClient's hidden
        // <audio> element.
        if (!cancelled) setError(labels.offline);
      }
    }

    const sessionPromise = loadSession();

    // Bridge: read raw audio from the realtime track, convert to Int16,
    // forward to Simli through the controller. Returns a stop function.
    async function bridgeAudio(track: MediaStreamTrack, controller: AvatarController) {
      // Lazy lookup avoids referencing a name TS might not have in lib.dom.
      const Ctor = (window as unknown as { MediaStreamTrackProcessor?: new (init: { track: MediaStreamTrack }) => { readable: ReadableStream<AudioDataFrame> } })
        .MediaStreamTrackProcessor;
      if (!Ctor) return; // caller already handled the fallback

      const processor = new Ctor({ track });
      const reader = processor.readable.getReader();
      const abort = new AbortController();
      bridgeAbortRef.current = abort;

      abort.signal.addEventListener('abort', () => {
        // Cancelling the reader propagates to the underlying track processor.
        reader.cancel().catch(() => { /* noop */ });
      });

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done || abort.signal.aborted) break;
          if (!value) continue;
          const samples = value.numberOfFrames;
          const float = new Float32Array(samples);
          // Channel 0 only — Simli is mono. Realtime sends mono anyway.
          try {
            value.copyTo(float, { planeIndex: 0, format: 'f32' });
          } catch {
            // Some browsers reject the `format` option; retry without it.
            value.copyTo(float, { planeIndex: 0 });
          }
          const int16 = float32ToInt16(float);
          controller.pushAudioChunk(int16);
          value.close();
        }
      } catch {
        /* The reader rejects on track end / cancel; nothing to surface. */
      }
    }

    const offTrack = avatarBus.on('remote_track', async (track) => {
      // Wait for the session to land before we try to start the avatar; the
      // realtime track usually arrives within a second of the SDP exchange.
      await sessionPromise;
      if (cancelled || !session) return;
      const video = videoRef.current;
      const audio = audioRef.current;
      if (!video || !audio) return;

      try {
        const controller = await startAvatar({
          apiKey: session.apiKey,
          faceId: session.faceId,
          videoElement: video,
          audioElement: audio,
        });
        controllerRef.current = controller;
      } catch {
        // Simli failed to come up — fall back to plain audio so the
        // interview still runs. RealtimeClient's hidden <audio> already
        // plays the same stream, so we don't need to do anything else.
        setError(labels.offline);
        return;
      }

      if (!hasMediaStreamTrackProcessor()) {
        // Safari path: no per-frame audio access. Mount the track on the
        // visible <audio> so the user hears the detective. Lips won't move.
        try {
          audio.srcObject = new MediaStream([track]);
          await audio.play().catch(() => { /* autoplay blocked; user gesture already happened */ });
        } catch {
          /* noop */
        }
        setNoLipSync(true);
        return;
      }

      void bridgeAudio(track, controllerRef.current!);
    });

    const offEnd = avatarBus.on('end', () => {
      bridgeAbortRef.current?.abort();
      bridgeAbortRef.current = null;
      controllerRef.current?.stop();
      controllerRef.current = null;
    });

    return () => {
      cancelled = true;
      offTrack();
      offEnd();
      bridgeAbortRef.current?.abort();
      bridgeAbortRef.current = null;
      controllerRef.current?.stop();
      controllerRef.current = null;
    };
  }, [labels.offline]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-ink/10 bg-black shadow-lg">
      <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
      <audio ref={audioRef} autoPlay />
      <div className="absolute left-3 top-3 rounded bg-stamp px-2 py-1 text-xs font-bold uppercase tracking-widest text-white">
        {labels.liveBadge}
      </div>
      {error ? (
        <div className="absolute right-3 top-3 rounded bg-red-700/90 px-2 py-1 text-xs font-semibold text-white">
          {error}
        </div>
      ) : null}
      {noLipSync ? (
        <div className="absolute bottom-3 left-3 right-3 rounded bg-black/60 px-2 py-1 text-center text-xs text-white/90">
          {labels.noLipSync}
        </div>
      ) : null}
    </div>
  );
}
