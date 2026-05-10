import type { DossierPayload } from '@/types/domain';

// PDF renderer for the printable A4 dossier sheet. Mirrors the visual layout
// of samples/Nastya/*.png: header + stamps, left photo card, right identity
// table, observations block, danger-scale, exhibits, last-seen, footer.
//
// TODO(agent): implement with @react-pdf/renderer. Use the existing fonts
// (Caveat / Patrick Hand) registered via Font.register. Aim for one A4 page,
// 14pt body, generous margins.
export async function renderDossierPdf(_payload: DossierPayload, _portraitUrl?: string): Promise<Uint8Array> {
  throw new Error('renderDossierPdf not implemented yet — see PLAN.md step 5.2');
}
