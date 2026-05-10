// Pub-sub for live captions during an interview. RealtimeClient parses the
// data-channel events from OpenAI Realtime and dispatches `turn` events here;
// TranscriptPanel subscribes and renders.
//
// The realtime API streams the assistant transcript token-by-token
// (`response.audio_transcript.delta`) and the user transcript only as a
// final string (`conversation.item.input_audio_transcription.completed`).
// Carrying `final` lets the panel show a live "typing" effect for the
// detective and a stable line for the suspect.

export type TranscriptRole = 'detective' | 'suspect';

export interface TranscriptTurn {
  role: TranscriptRole;
  /** For deltas this is the increment; for finals it's the full final text. */
  text: string;
  final: boolean;
  /** Server-side stream ordering — used to merge deltas under one bubble. */
  itemId?: string;
  /** Wall-clock timestamp on the producer. */
  ts: number;
}

class TranscriptBus {
  private readonly target = new EventTarget();

  on(listener: (turn: TranscriptTurn) => void): () => void {
    const handler = (e: Event) => listener((e as CustomEvent<TranscriptTurn>).detail);
    this.target.addEventListener('turn', handler);
    return () => this.target.removeEventListener('turn', handler);
  }

  dispatchTurn(turn: Omit<TranscriptTurn, 'ts'> & { ts?: number }): void {
    const detail: TranscriptTurn = { ts: turn.ts ?? Date.now(), ...turn };
    this.target.dispatchEvent(new CustomEvent('turn', { detail }));
  }
}

export const transcriptBus = new TranscriptBus();
