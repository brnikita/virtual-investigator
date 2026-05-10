'use client';

// Streams transcript deltas from RealtimeClient. Subscribed via TranscriptBus
// (a pub-sub instantiated alongside AvatarBus — see lib/transcript-bus.ts
// TODO). Renders detective vs suspect with different colors.
export function TranscriptPanel({ caseId: _caseId }: { caseId: string }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white/60 p-4 text-sm">
      <h3 className="mb-2 font-semibold">Стенограмма</h3>
      <p className="text-ink/50">TODO: live transcript</p>
    </div>
  );
}
