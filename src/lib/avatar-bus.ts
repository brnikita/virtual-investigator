// Tiny pub-sub bus that decouples the OpenAI Realtime peer (producer) from
// the Simli avatar (consumer). RealtimeClient pushes the remote audio
// MediaStreamTrack onto the bus; AvatarStage subscribes and forwards frames
// into Simli after downsampling 24 kHz -> 16 kHz.
//
// Phase 3 reconciliation: we send the whole `MediaStreamTrack` over the bus
// (not per-frame Int16 chunks) and let the consumer attach its own
// `MediaStreamTrackProcessor`. This keeps the producer cheap (no audio
// decoding on the realtime hot path) and lets the consumer pick the
// resampling strategy that fits the runtime — see `AvatarStage`.

export type AvatarBusEventMap = {
  /** A new remote audio MediaStreamTrack from the Realtime peer. */
  remote_track: MediaStreamTrack;
  /** Sent when the peer is torn down so the avatar can stop. */
  end: void;
};

type Listener<K extends keyof AvatarBusEventMap> = (payload: AvatarBusEventMap[K]) => void;

class AvatarBus {
  private readonly target = new EventTarget();

  on<K extends keyof AvatarBusEventMap>(type: K, listener: Listener<K>): () => void {
    const handler = (e: Event) => listener((e as CustomEvent<AvatarBusEventMap[K]>).detail);
    this.target.addEventListener(type, handler);
    return () => this.target.removeEventListener(type, handler);
  }

  emit<K extends keyof AvatarBusEventMap>(type: K, payload: AvatarBusEventMap[K]): void {
    this.target.dispatchEvent(new CustomEvent(type, { detail: payload }));
  }
}

// Module-level singleton. The interview screen mounts a single avatar + a
// single peer at any time, so a global bus is the simplest fit.
export const avatarBus = new AvatarBus();
