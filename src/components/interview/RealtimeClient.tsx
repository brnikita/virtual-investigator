'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { avatarBus } from '@/lib/avatar-bus';
import { transcriptBus } from '@/lib/transcript-bus';

// Owns the WebRTC peer to OpenAI Realtime. Two big responsibilities:
//   1. Negotiate the peer connection using the ephemeral key from
//      /api/realtime/session and stream the user's microphone in.
//   2. Forward incoming audio frames to AvatarBus so AvatarStage can drive
//      the Simli avatar; forward incoming text deltas to TranscriptBus so
//      TranscriptPanel can render captions.
//
// Tool calls (record_evidence, finish_interview) are handled in step 2.3.
// Length cap and metrics persistence are handled in 2.4 / 2.5.
//
// References:
//   https://platform.openai.com/docs/guides/realtime-webrtc

interface SessionResponse {
  client_secret: { value: string; expires_at: number };
  model: string;
  maxInterviewSeconds: number;
}

// We handle a handful of event types; the rest of the union is represented
// as `Record<string, unknown>` so the JSON.parse cast stays narrow.
type RealtimeEvent =
  | { type: 'response.audio_transcript.delta'; delta: string; item_id?: string }
  | { type: 'response.audio_transcript.done'; transcript: string; item_id?: string }
  | {
      type: 'conversation.item.input_audio_transcription.completed';
      transcript: string;
      item_id?: string;
    }
  | {
      type: 'response.function_call_arguments.done';
      name: string;
      arguments: string;
      call_id: string;
    }
  | { type: string; [key: string]: unknown };

interface RecordEvidenceArgs {
  category: 'identity' | 'appearance' | 'observations' | 'funny_facts' | 'exhibits';
  key: string;
  value: string;
  confidence?: number;
}

interface FinishInterviewArgs {
  summary: string;
}

function isRecordEvidenceArgs(v: unknown): v is RecordEvidenceArgs {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.category === 'string' && typeof o.key === 'string' && typeof o.value === 'string';
}

function isFinishInterviewArgs(v: unknown): v is FinishInterviewArgs {
  if (!v || typeof v !== 'object') return false;
  return typeof (v as Record<string, unknown>).summary === 'string';
}

export interface RealtimeClientLabels {
  panelTitle: string;
  panelHint: string;
  start: string;
  stop: string;
  errorPrefix: string;
  endingSoon: string;
}

export function RealtimeClient({
  caseId,
  labels,
}: {
  caseId: string;
  labels: RealtimeClientLabels;
}) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Visible only inside the last 60 seconds; null otherwise.
  const [countdown, setCountdown] = useState<number | null>(null);

  // Refs because these survive re-renders but never need to trigger one.
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioElRef = useRef<HTMLAudioElement | null>(null);
  const hardStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Set by /api/interview/start at session open; read at /finalize time.
  const interviewIdRef = useRef<string | null>(null);

  // Tear-down is shared between the explicit Stop button, the hard cap
  // timer, and unmount.
  const teardown = useCallback(() => {
    if (hardStopTimerRef.current) clearTimeout(hardStopTimerRef.current);
    if (countdownTickerRef.current) clearInterval(countdownTickerRef.current);
    hardStopTimerRef.current = null;
    countdownTickerRef.current = null;
    try { dcRef.current?.close(); } catch { /* noop */ }
    try { pcRef.current?.getSenders().forEach((s) => s.track?.stop()); } catch { /* noop */ }
    try { pcRef.current?.close(); } catch { /* noop */ }
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (remoteAudioElRef.current) {
      remoteAudioElRef.current.srcObject = null;
      remoteAudioElRef.current.remove();
      remoteAudioElRef.current = null;
    }
    avatarBus.emit('end', undefined);
    pcRef.current = null;
    dcRef.current = null;
    micStreamRef.current = null;
    setCountdown(null);
  }, []);

  useEffect(() => {
    // Always release the mic and the peer if the user navigates away.
    return () => teardown();
  }, [teardown]);

  const start = async () => {
    setError(null);
    try {
      // 1. Mint an ephemeral key bound to this case.
      const sessionRes = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      });
      if (!sessionRes.ok) throw new Error(`session mint failed (${sessionRes.status})`);
      const session = (await sessionRes.json()) as SessionResponse;
      const ephemeralKey = session.client_secret.value;

      // 1b. Register the interview row before opening the peer so the
      //     evidence dispatcher can attach tool breadcrumbs immediately.
      const startRes = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, realtimeSessionId: session.client_secret.value }),
      });
      if (!startRes.ok) throw new Error(`interview start failed (${startRes.status})`);
      const { interviewId } = (await startRes.json()) as { interviewId: string };
      interviewIdRef.current = interviewId;

      // 2. Build the peer.
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 3. Mount the remote audio element. Hidden — Simli will play the
      //    audio once Phase 3 lands; until then the user hears the
      //    detective directly through this element.
      const remoteAudio = document.createElement('audio');
      remoteAudio.autoplay = true;
      remoteAudio.style.display = 'none';
      document.body.appendChild(remoteAudio);
      remoteAudioElRef.current = remoteAudio;

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (stream) remoteAudio.srcObject = stream;
        // Phase 3.2 will subscribe to this event in AvatarStage and
        // route the track through the Simli pipeline.
        avatarBus.emit('remote_track', event.track);
      };

      // 4. Mic.
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = mic;
      for (const track of mic.getTracks()) pc.addTrack(track, mic);

      // 5. Single data channel for events. Name is mandated by the API.
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      // Send a tool result back through the data channel and ask the model
      // to continue its turn. The shape comes from the Realtime examples:
      // `conversation.item.create` followed by `response.create`.
      const sendToolOutput = (callId: string, output: unknown) => {
        if (dc.readyState !== 'open') return;
        dc.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: JSON.stringify(output),
            },
          }),
        );
        dc.send(JSON.stringify({ type: 'response.create' }));
      };

      const handleEvent = async (evt: RealtimeEvent) => {
        switch (evt.type) {
          case 'response.audio_transcript.delta':
            transcriptBus.dispatchTurn({
              role: 'detective',
              text: (evt as { delta: string }).delta,
              final: false,
              itemId: (evt as { item_id?: string }).item_id,
            });
            return;
          case 'response.audio_transcript.done':
            transcriptBus.dispatchTurn({
              role: 'detective',
              text: (evt as { transcript: string }).transcript,
              final: true,
              itemId: (evt as { item_id?: string }).item_id,
            });
            return;
          case 'conversation.item.input_audio_transcription.completed':
            transcriptBus.dispatchTurn({
              role: 'suspect',
              text: (evt as { transcript: string }).transcript,
              final: true,
              itemId: (evt as { item_id?: string }).item_id,
            });
            return;
          case 'response.function_call_arguments.done': {
            const tool = evt as {
              name: string;
              arguments: string;
              call_id: string;
            };
            let parsed: unknown;
            try {
              parsed = JSON.parse(tool.arguments);
            } catch {
              sendToolOutput(tool.call_id, { ok: false, error: 'invalid_json' });
              return;
            }
            if (tool.name === 'record_evidence' && isRecordEvidenceArgs(parsed)) {
              try {
                const res = await fetch('/api/evidence', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ caseId, ...parsed }),
                });
                sendToolOutput(tool.call_id, res.ok ? { ok: true } : { ok: false });
              } catch {
                sendToolOutput(tool.call_id, { ok: false, error: 'network' });
              }
              return;
            }
            if (tool.name === 'finish_interview' && isFinishInterviewArgs(parsed)) {
              sendToolOutput(tool.call_id, { ok: true });
              // The detective is done speaking — close the loop. stop()
              // tears the peer down and POSTs to /finalize.
              await stop();
              return;
            }
            sendToolOutput(tool.call_id, { ok: false, error: 'unknown_tool' });
            return;
          }
          default:
            return;
        }
      };

      dc.addEventListener('message', (e) => {
        if (typeof e.data !== 'string') return;
        try {
          const evt = JSON.parse(e.data) as RealtimeEvent;
          void handleEvent(evt);
        } catch {
          // Realtime occasionally pads with binary control frames; ignore.
        }
      });

      // 6. SDP offer/answer with the OpenAI Realtime endpoint. The body of
      //    the POST is the raw SDP (Content-Type: application/sdp) and the
      //    response body is the answer SDP — not JSON.
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime?model=${encodeURIComponent(session.model)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp ?? '',
        },
      );
      if (!sdpRes.ok) throw new Error(`realtime SDP exchange failed (${sdpRes.status})`);
      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      setActive(true);

      // Cost guardrail: hard-stop at MAX_INTERVIEW_SECONDS, with a visible
      // countdown in the last 60s so kids aren't surprised by the cut.
      const maxSec = session.maxInterviewSeconds;
      const startedAt = Date.now();
      hardStopTimerRef.current = setTimeout(() => {
        void stop();
      }, maxSec * 1000);
      countdownTickerRef.current = setInterval(() => {
        const remaining = Math.max(0, maxSec - Math.floor((Date.now() - startedAt) / 1000));
        setCountdown(remaining <= 60 ? remaining : null);
      }, 1000);
    } catch (err) {
      teardown();
      setError(err instanceof Error ? err.message : 'unknown error');
    }
  };

  const stop = async () => {
    const interviewId = interviewIdRef.current;
    teardown();
    setActive(false);
    interviewIdRef.current = null;
    if (!interviewId) return;
    await fetch(`/api/interview/${interviewId}/finalize`, { method: 'POST' }).catch(() => {
      /* finalize errors are surfaced server-side; the UI just stops the peer. */
    });
  };

  return (
    <div className="rounded-xl border border-ink/10 bg-white/60 p-4 shadow-sm">
      <h3 className="font-semibold">{labels.panelTitle}</h3>
      <p className="mt-1 text-sm text-ink/70">{labels.panelHint}</p>
      <div className="mt-3 flex gap-2">
        {!active ? (
          <button onClick={start} className="rounded-md bg-stamp px-4 py-2 text-white">
            {labels.start}
          </button>
        ) : (
          <button onClick={stop} className="rounded-md border border-ink/30 px-4 py-2">
            {labels.stop}
          </button>
        )}
      </div>
      {countdown !== null ? (
        <p className="mt-2 text-sm font-semibold text-stamp">
          {labels.endingSoon} {countdown}s
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-red-700">
          {labels.errorPrefix}: {error}
        </p>
      ) : null}
    </div>
  );
}
