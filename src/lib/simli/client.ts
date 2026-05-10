// Thin wrapper around `simli-client` so the rest of the app sees a stable
// surface. Simli takes 16 kHz PCM input and returns video + audio frames; the
// Realtime client gives us 24 kHz audio, so the wrapper handles resampling.
//
// We keep the actual SDK calls here rather than in the React component so we
// can swap providers (Tavus, D-ID) later without touching the UI.
//
// SDK reference: node_modules/simli-client/README.md and the `SimliClient`
// class in `lib/SimliClient.ts`. Public surface used here:
//   new SimliClient()
//   .Initialize({ apiKey, faceID, handleSilence, maxSessionLength,
//                 maxIdleTime, videoRef, audioRef, SimliURL })
//   .start()                       // async; opens the WebRTC peer
//   .sendAudioData(Uint8Array)     // raw 16 kHz Int16 mono bytes
//   .ClearBuffer()                 // tells the avatar to stop talking
//   .close()                       // tear-down

import type { RefObject } from 'react';
import { SimliClient } from 'simli-client';
import { downsamplePcm24kTo16k } from './pipeline';

export interface StartAvatarOptions {
  apiKey: string;
  faceId: string;
  videoElement: HTMLVideoElement;
  audioElement: HTMLAudioElement;
  /**
   * Hard cap on the Simli session length, in seconds. Defaults to a value
   * matching `MAX_INTERVIEW_SECONDS` so the avatar can never out-live the
   * cost-capped interview. Pass through from the caller.
   */
  maxSessionSeconds?: number;
}

export interface AvatarController {
  /** Send a chunk of 24 kHz PCM16 from the Realtime API. Resampled in here. */
  pushAudioChunk: (chunk: Int16Array) => void;
  /** Tell the avatar to stop talking and idle. */
  flush: () => void;
  /** Tear down the WebRTC peer. */
  stop: () => void;
}

export async function startAvatar(opts: StartAvatarOptions): Promise<AvatarController> {
  const simli = new SimliClient();

  // SimliClient stores the refs and reads `.current` later; a plain object
  // with a `current` field is enough — the SDK never reassigns it. The
  // `RefObject` type marks `current` readonly, so we cast through `unknown`.
  const videoRef = { current: opts.videoElement } as unknown as RefObject<HTMLVideoElement>;
  const audioRef = { current: opts.audioElement } as unknown as RefObject<HTMLAudioElement>;

  simli.Initialize({
    apiKey: opts.apiKey,
    faceID: opts.faceId,
    // SDK auto-emits silence packets when no audio flows — keeps the avatar
    // looking alive between turns instead of freezing on the last frame.
    handleSilence: true,
    maxSessionLength: opts.maxSessionSeconds ?? 600,
    // Drop the session if nobody talks for this long. The interview already
    // hard-caps duration, so a generous idle window is fine.
    maxIdleTime: 120,
    videoRef,
    audioRef,
    enableConsoleLogs: false,
    SimliURL: '',
  });

  await simli.start();

  return {
    pushAudioChunk(chunk: Int16Array) {
      const downsampled = downsamplePcm24kTo16k(chunk);
      // Simli expects a Uint8Array view over the Int16 buffer. Use the
      // exact byte range so a pooled/oversized backing buffer doesn't leak
      // tail bytes of a previous chunk into the wire.
      const bytes = new Uint8Array(
        downsampled.buffer,
        downsampled.byteOffset,
        downsampled.byteLength,
      );
      simli.sendAudioData(bytes);
    },
    flush() {
      simli.ClearBuffer();
    },
    stop() {
      try {
        simli.close();
      } catch {
        /* close is best-effort; the SDK occasionally throws if the peer
           was already torn down by a network failure. */
      }
    },
  };
}
