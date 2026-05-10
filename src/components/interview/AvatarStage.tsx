'use client';

import { useEffect, useRef } from 'react';

// Renders the Simli avatar's <video> element. Audio frames driving the
// animation come from RealtimeClient through the AvatarBus (a small
// pub-sub instantiated in `lib/avatar-bus.ts` — TODO).
export function AvatarStage({ caseId: _caseId }: { caseId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // TODO(agent):
    //  1. Fetch /api/simli/session for { apiKey, faceId }.
    //  2. Call startAvatar({ apiKey, faceId, videoElement, audioElement }).
    //  3. Subscribe to AvatarBus 'audio_chunk' events; downsample 24k→16k via
    //     pipeline.downsamplePcm24kTo16k and forward to controller.pushAudioChunk.
    //  4. On unmount: controller.stop().
  }, []);

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-ink/10 bg-black shadow-lg">
      <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
      <audio ref={audioRef} autoPlay />
      <div className="absolute left-3 top-3 rounded bg-stamp px-2 py-1 text-xs font-bold uppercase tracking-widest text-white">
        Live · Инспектор Морковкин
      </div>
    </div>
  );
}
