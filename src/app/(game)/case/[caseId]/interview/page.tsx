import { AvatarStage } from '@/components/interview/AvatarStage';
import { RealtimeClient } from '@/components/interview/RealtimeClient';
import { TranscriptPanel } from '@/components/interview/TranscriptPanel';
import { EvidenceUploader } from '@/components/interview/EvidenceUploader';

// Live interview screen. The avatar (Simli) is on the left, the transcript on
// the right, evidence/photo controls below. RealtimeClient is a client
// component that owns the WebRTC peer to OpenAI and feeds audio frames into
// AvatarStage via a shared context.
export default async function InterviewPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return (
    <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-4">
        <AvatarStage caseId={caseId} />
        <EvidenceUploader caseId={caseId} />
      </section>
      <aside className="space-y-4">
        <RealtimeClient caseId={caseId} />
        <TranscriptPanel caseId={caseId} />
      </aside>
    </main>
  );
}
