// Tiny pub-sub bus that decouples the OpenAI Realtime peer (producer) from
// the Simli avatar (consumer). RealtimeClient pushes the remote audio
// MediaStreamTrack onto the bus; AvatarStage subscribes and forwards frames
// into Simli after downsampling 24 kHz -> 16 kHz.
//
// Phase 2 ships the producer side. Phase 3.2 will replace this stub with
// per-frame PCM events. Keeping the surface stable so the Phase 3 wiring is
// purely additive.

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
