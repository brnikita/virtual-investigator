// Server-only by transitive constraint: createSupabaseServer() reads
// next/headers cookies(), which Next refuses to import in a client bundle.
import { createSupabaseAdmin, createSupabaseServer } from '@/lib/supabase/server';

// Server-only helper for issuing short-lived signed URLs to private Storage
// objects. The flow is: SSR client looks up the attachment row (RLS blocks
// it if the case isn't ours), then the admin client mints the signed URL
// against the right bucket. Two clients on purpose — never bypass RLS for
// the lookup, and never expose the service role to the cookie scope.

export interface SignedAttachmentUrl {
  url: string;
  expiresAt: Date;
}

export async function signedUrlForAttachment(
  attachmentId: string,
  expiresInSeconds = 60,
): Promise<SignedAttachmentUrl> {
  const supabase = await createSupabaseServer();
  const { data: attachment, error: lookupErr } = await supabase
    .from('attachments')
    .select('storage_path')
    .eq('id', attachmentId)
    .single();
  if (lookupErr || !attachment) {
    throw new Error(`attachment ${attachmentId} not found or not owned`);
  }

  // storage_path is stored as `<bucket>/<object/path>`. Split on the FIRST
  // slash; the object key itself contains slashes (e.g. case-id/photo.jpg).
  const slash = attachment.storage_path.indexOf('/');
  if (slash <= 0 || slash === attachment.storage_path.length - 1) {
    throw new Error(`malformed storage_path: ${attachment.storage_path}`);
  }
  const bucket = attachment.storage_path.slice(0, slash);
  const objectKey = attachment.storage_path.slice(slash + 1);

  const admin = createSupabaseAdmin();
  const { data: signed, error: signErr } = await admin.storage
    .from(bucket)
    .createSignedUrl(objectKey, expiresInSeconds);
  if (signErr || !signed) {
    throw new Error(`failed to sign url: ${signErr?.message ?? 'unknown'}`);
  }

  return {
    url: signed.signedUrl,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
  };
}
