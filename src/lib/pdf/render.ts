import { renderToBuffer } from '@react-pdf/renderer';
import type { DossierPayload } from '@/types/domain';
import { DossierA4 } from './DossierA4';

// Public entry point. Renders the Phase 5.2 dossier component to a PDF buffer
// suitable for streaming inline. Kept thin on purpose — see DossierA4 for the
// layout itself.
export async function renderDossierPdf(
  payload: DossierPayload,
  portraitUrl?: string,
): Promise<Uint8Array> {
  // renderToBuffer hands us a Node Buffer. The Vercel runtime is happy with a
  // Uint8Array view, and the API route can wrap it in a Response body without
  // a copy.
  const buffer = await renderToBuffer(DossierA4({ payload, portraitUrl }));
  return new Uint8Array(buffer);
}
