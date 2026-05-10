import { serverEnv } from '@/lib/env';

// Issue a short-lived ephemeral key the browser can use to open a WebRTC
// connection directly to the OpenAI Realtime API. The key is bound to a single
// session and expires within ~1 minute, so it's safe to ship to the client.
//
// Docs: https://platform.openai.com/docs/guides/realtime-webrtc
export interface RealtimeSessionOptions {
  voice?: string;                     // e.g. 'cedar' | 'shimmer' | 'verse'
  language?: 'ru' | 'en';
  instructions: string;               // system prompt for the detective
  tools?: unknown[];                  // function-tool schemas (record_evidence, etc.)
}

export interface EphemeralKey {
  client_secret: { value: string; expires_at: number };
  model: string;
  voice?: string;
}

export async function mintRealtimeEphemeralKey(opts: RealtimeSessionOptions): Promise<EphemeralKey> {
  const env = serverEnv();
  const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_REALTIME_MODEL,
      voice: opts.voice ?? 'verse',
      modalities: ['audio', 'text'],
      instructions: opts.instructions,
      tools: opts.tools,
      // Russian is the primary game language; English is selectable per case.
      input_audio_transcription: { model: 'whisper-1', language: opts.language ?? 'ru' },
      turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 500 },
    }),
  });
  if (!res.ok) {
    throw new Error(`Realtime session mint failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as EphemeralKey;
}
