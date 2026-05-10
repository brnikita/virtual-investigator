import { notFound } from 'next/navigation';
import { AvatarStage } from '@/components/interview/AvatarStage';
import { RealtimeClient } from '@/components/interview/RealtimeClient';
import { TranscriptPanel } from '@/components/interview/TranscriptPanel';
import { EvidenceUploader } from '@/components/interview/EvidenceUploader';
import { createSupabaseServer } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/config';

// Live interview screen. The avatar (Simli) is on the left, the transcript on
// the right, evidence/photo controls below. RealtimeClient is a client
// component that owns the WebRTC peer to OpenAI and feeds audio frames into
// AvatarStage via a shared context. Dictionary is loaded server-side from the
// case language so the client never has to fetch a JSON file.
export default async function InterviewPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const supabase = await createSupabaseServer();
  const { data: c, error } = await supabase
    .from('cases')
    .select('id, language')
    .eq('id', caseId)
    .single();
  if (error || !c) notFound();

  const dict = await getDictionary(c.language as Locale);
  const t = dict.interview;
  const a = dict.avatar;
  const labels = {
    panelTitle: t.panelTitle,
    panelHint: t.panelHint,
    start: t.start,
    stop: t.stop,
    errorPrefix: t.errorPrefix,
    endingSoon: t.endingSoon,
    composing: t.composing,
  };
  const transcriptLabels = {
    title: t.transcriptTitle,
    empty: t.transcriptEmpty,
    detective: t.roleDetective,
    suspect: t.roleSuspect,
  };
  const avatarLabels = {
    liveBadge: a.liveBadge,
    offline: a.offline,
    noLipSync: a.noLipSync,
  };
  const evidenceLabels = {
    takePhoto: t.takePhoto,
    snap: t.snap,
    retake: t.retake,
    useThis: t.useThis,
    uploading: t.uploading,
    uploaded: t.uploaded,
    cameraError: t.cameraError,
    uploadError: t.uploadError,
    dropZoneHint: t.dropZoneHint,
    orPickFile: t.orPickFile,
    fileTypeError: t.fileTypeError,
  };

  return (
    <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[2fr_1fr]">
      <section className="space-y-4">
        <AvatarStage caseId={caseId} labels={avatarLabels} />
        <EvidenceUploader caseId={caseId} labels={evidenceLabels} />
      </section>
      <aside className="space-y-4">
        <RealtimeClient caseId={caseId} labels={labels} />
        <TranscriptPanel labels={transcriptLabels} />
      </aside>
    </main>
  );
}
