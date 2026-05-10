'use client';

import { useState } from 'react';

// Owns the WebRTC peer to OpenAI Realtime. Two big responsibilities:
//   1. Negotiate the peer connection using the ephemeral key from
//      /api/realtime/session and stream the user's microphone in.
//   2. Forward incoming audio frames to the AvatarBus so AvatarStage can drive
//      the Simli avatar; forward incoming text deltas to TranscriptPanel.
//
// Tool calls (record_evidence, finish_interview) come back as
// `response.function_call_arguments.delta` events — handle them by POSTing to
// the appropriate API route.
//
// TODO(agent):
//   - Implement createPeerConnection() per
//     https://platform.openai.com/docs/guides/realtime-webrtc
//   - Wire mic via getUserMedia({ audio: true }).
//   - Wire data-channel for events; dispatch to AvatarBus + TranscriptBus.
//   - Honor MAX_INTERVIEW_SECONDS via a setTimeout that calls stop().
export function RealtimeClient({ caseId }: { caseId: string }) {
  const [active, setActive] = useState(false);

  const start = async () => {
    setActive(true);
    // const res = await fetch('/api/realtime/session', { method: 'POST', body: JSON.stringify({ caseId }) });
    // const { client_secret } = await res.json();
    // ... open RTCPeerConnection, attach mic, ...
  };

  const stop = async () => {
    setActive(false);
    await fetch(`/api/interview/${caseId}/finalize`, { method: 'POST' });
    // pc?.close()
  };

  return (
    <div className="rounded-xl border border-ink/10 bg-white/60 p-4 shadow-sm">
      <h3 className="font-semibold">Допрос</h3>
      <p className="mt-1 text-sm text-ink/70">
        Микрофон работает только во время допроса. Можно прервать в любой момент.
      </p>
      <div className="mt-3 flex gap-2">
        {!active ? (
          <button onClick={start} className="rounded-md bg-stamp px-4 py-2 text-white">
            Начать
          </button>
        ) : (
          <button onClick={stop} className="rounded-md border border-ink/30 px-4 py-2">
            Завершить
          </button>
        )}
      </div>
    </div>
  );
}
