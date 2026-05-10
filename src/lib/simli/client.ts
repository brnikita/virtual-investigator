// Thin wrapper around `simli-client` so the rest of the app sees a stable
// surface. Simli takes 16 kHz PCM input and returns video + audio frames; the
// Realtime client gives us 24 kHz audio, so the wrapper handles resampling.
//
// We keep the actual SDK calls here rather than in the React component so we
// can swap providers (Tavus, D-ID) later without touching the UI.

export interface StartAvatarOptions {
  apiKey: string;
  faceId: string;
  videoElement: HTMLVideoElement;
  audioElement?: HTMLAudioElement;
}

export interface AvatarController {
  /** Send a chunk of 24 kHz PCM16 from the Realtime API. */
  pushAudioChunk: (chunk: Int16Array) => void;
  /** Tell the avatar to stop talking and idle. */
  flush: () => void;
  /** Tear down the WebRTC peer. */
  stop: () => void;
}

export async function startAvatar(_opts: StartAvatarOptions): Promise<AvatarController> {
  // TODO(agent): Wire up `simli-client`:
  //   import { SimliClient } from 'simli-client';
  //   const simli = new SimliClient();
  //   await simli.Initialize({ apiKey, faceID: faceId, videoRef, audioRef });
  //   simli.start();
  // Resample 24kHz -> 16kHz before calling simli.sendAudioData.
  // See docs/ARCHITECTURE.md "Avatar pipeline" for the full data flow.
  throw new Error('startAvatar not implemented yet — see PLAN.md step 3.4');
}
