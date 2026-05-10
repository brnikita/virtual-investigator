import { signedUrlForAttachment } from '@/lib/storage/signed-url';

// Async Server Component that renders a private Storage attachment behind a
// short-lived signed URL. We use a plain <img> on purpose — the signed host
// is `127.0.0.1` in local dev, which doesn't match next/image's
// remotePatterns out of the box. The MVP doesn't need next/image perks here.
export async function EvidenceImage({
  attachmentId,
  alt,
  className,
  expiresInSeconds,
}: {
  attachmentId: string;
  alt: string;
  className?: string;
  expiresInSeconds?: number;
}) {
  const { url } = await signedUrlForAttachment(attachmentId, expiresInSeconds);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} />;
}
