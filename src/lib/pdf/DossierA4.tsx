import path from 'node:path';
import { Document, Font, Image as PdfImage, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { DossierPayload } from '@/types/domain';

// @react-pdf 4.x crashes with "Cannot read properties of undefined (reading
// 'unitsPerEm')" when textkit walks a codepoint that no font in the stack can
// render — typically Cyrillic against a Latin-only TTF. Bundle a Cyrillic-
// aware fallback (Roboto) alongside the handwritten faces so every glyph
// resolves. All TTFs sit under public/fonts/ to avoid network flakiness on
// gstatic.com.
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');

Font.register({
  family: 'Caveat',
  fonts: [
    { src: path.join(FONT_DIR, 'Caveat-Regular.ttf'), fontWeight: 'normal' },
    { src: path.join(FONT_DIR, 'Caveat-Bold.ttf'), fontWeight: 'bold' },
  ],
});

Font.register({
  family: 'PatrickHand',
  fonts: [
    { src: path.join(FONT_DIR, 'PatrickHand-Regular.ttf'), fontWeight: 'normal' },
  ],
});

// Cyrillic-capable body face. Used directly for Russian payloads and
// implicitly as the fallback that textkit reaches when Caveat/PatrickHand
// lack a glyph for the codepoint.
Font.register({
  family: 'Roboto',
  fonts: [
    { src: path.join(FONT_DIR, 'Roboto-Regular.ttf'), fontWeight: 'normal' },
    { src: path.join(FONT_DIR, 'Roboto-Bold.ttf'), fontWeight: 'bold' },
  ],
});

// `@react-pdf/layout` always pushes 'Helvetica' onto the per-text fontFamily
// stack as a final fallback, but `FontStore.getFont` returns null for the
// standard PDF families. The null then propagates into textkit's font stack,
// where `pickFontFromFontStack`'s ultimate `fontStack.at(-1)` fallback yields
// undefined and the renderer crashes with `Cannot read properties of
// undefined (reading 'unitsPerEm')`. Monkey-patch getFont so requests for the
// standard family names resolve to our bundled Roboto instead.
type FontStoreLike = {
  fonts: Record<string, { resolve: (descriptor: unknown) => unknown }>;
  getFont: (descriptor: { fontFamily: string; fontWeight?: unknown; fontStyle?: unknown }) => unknown;
};
const fontStore = Font as unknown as FontStoreLike;
const STANDARD_PDF_FAMILIES = new Set([
  'Courier',
  'Courier-Bold',
  'Courier-Oblique',
  'Courier-BoldOblique',
  'Helvetica',
  'Helvetica-Bold',
  'Helvetica-Oblique',
  'Helvetica-BoldOblique',
  'Times-Roman',
  'Times-Bold',
  'Times-Italic',
  'Times-BoldItalic',
]);
const originalGetFont = fontStore.getFont.bind(fontStore);
fontStore.getFont = (descriptor) => {
  if (STANDARD_PDF_FAMILIES.has(descriptor.fontFamily)) {
    const roboto = fontStore.fonts['Roboto'];
    if (roboto) return roboto.resolve(descriptor);
  }
  return originalGetFont(descriptor);
};

// Single-page A4 dossier. Mirrors PrintableSheet.tsx beat-for-beat:
//   header + stamps  | photo card (left) + identity table (right)
//   observations grid | danger-scale + exhibits + last-seen
//   footer conclusion
//
// react-pdf only knows about a tiny subset of CSS, so the visual treatment
// is deliberately simpler than the on-screen Tailwind version (no grid
// background, no shadows). Composition and typography carry the warmth.
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#fbf6e9',
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 28,
    fontFamily: ['PatrickHand', 'Roboto'],
    fontSize: 11,
    color: '#1f1c18',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: '#1f1c18',
    paddingBottom: 8,
  },
  headerText: {
    flex: 1,
    paddingRight: 8,
  },
  headline: {
    fontFamily: ['Caveat', 'Roboto'],
    fontWeight: 'bold',
    fontSize: 28,
    letterSpacing: 1,
  },
  subheadline: {
    marginTop: 2,
    color: '#5b554d',
    fontSize: 11,
  },
  stamps: {
    width: 90,
    alignItems: 'flex-end',
  },
  stamp: {
    borderWidth: 1.4,
    borderColor: '#c0392b',
    color: '#c0392b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontFamily: ['Caveat', 'Roboto'],
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  topRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 14,
  },
  photoCard: {
    width: 220,
    height: 270,
    borderWidth: 2,
    borderColor: '#1f1c18',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholder: {
    fontFamily: ['Caveat', 'Roboto'],
    fontSize: 22,
    color: '#bdb6a3',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  identity: {
    flex: 1,
  },
  identityRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dcd2b6',
  },
  identityKey: {
    width: 110,
    color: '#5b554d',
    fontWeight: 'bold',
  },
  identityValue: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: ['Caveat', 'Roboto'],
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 4,
  },
  observations: {
    marginTop: 14,
  },
  observationsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  observationItem: {
    width: '50%',
    paddingRight: 8,
    paddingVertical: 1.5,
  },
  bottomRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 12,
  },
  bottomCol: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#dcd2b6',
    padding: 8,
    backgroundColor: '#ffffff',
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1.5,
  },
  exhibitItem: {
    paddingVertical: 1.5,
  },
  lastSeen: {
    color: '#3a3630',
  },
  footer: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 18,
    borderTopWidth: 2,
    borderTopColor: '#1f1c18',
    paddingTop: 6,
  },
});

const STAMPS_RU = ['СЕКРЕТНО', 'НАБЛЮДЕНИЕ'];
const STAMPS_EN = ['CONFIDENTIAL', 'OBSERVATION'];

const SECTION_LABELS = {
  ru: {
    observations: 'Сведения из наблюдений',
    danger: 'Уровень опасности',
    exhibits: 'Вещдоки',
    lastSeen: 'Последнее место наблюдения',
    conclusion: 'Вывод комиссии',
  },
  en: {
    observations: 'Observations',
    danger: 'Danger level',
    exhibits: 'Exhibits',
    lastSeen: 'Last seen',
    conclusion: 'Conclusion',
  },
} as const;

export interface DossierA4Props {
  payload: DossierPayload;
  portraitUrl?: string;
}

export function DossierA4({ payload, portraitUrl }: DossierA4Props) {
  const stamps = payload.language === 'en' ? STAMPS_EN : STAMPS_RU;
  const labels = SECTION_LABELS[payload.language === 'en' ? 'en' : 'ru'];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headline}>{payload.headline}</Text>
            <Text style={styles.subheadline}>{payload.subheadline}</Text>
          </View>
          <View style={styles.stamps}>
            {stamps.map((s) => (
              <Text key={s} style={styles.stamp}>
                {s}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.topRow}>
          <View style={styles.photoCard}>
            {portraitUrl ? (
              <PdfImage src={portraitUrl} style={styles.photoImage} />
            ) : (
              <Text style={styles.photoPlaceholder}>
                {payload.language === 'en' ? 'sketch' : 'фоторобот'}
              </Text>
            )}
          </View>
          <View style={styles.identity}>
            {Object.entries(payload.identity).map(([k, v]) => (
              <View key={k} style={styles.identityRow}>
                <Text style={styles.identityKey}>{k}</Text>
                <Text style={styles.identityValue}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.observations}>
          <Text style={styles.sectionTitle}>{labels.observations}</Text>
          <View style={styles.observationsList}>
            {payload.observations.map((o, i) => (
              <Text key={i} style={styles.observationItem}>
                {`— ${o}`}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.bottomCol}>
            <Text style={styles.sectionTitle}>{labels.danger}</Text>
            {payload.scales.map((s) => (
              <View key={s.label} style={styles.scaleRow}>
                <Text>{s.label}</Text>
                <Text>{'★'.repeat(s.value) + '☆'.repeat(Math.max(0, s.max - s.value))}</Text>
              </View>
            ))}
          </View>
          <View style={styles.bottomCol}>
            <Text style={styles.sectionTitle}>{labels.exhibits}</Text>
            {payload.exhibits.map((e, i) => (
              <Text key={i} style={styles.exhibitItem}>
                {`— ${e}`}
              </Text>
            ))}
          </View>
          <View style={styles.bottomCol}>
            <Text style={styles.sectionTitle}>{labels.lastSeen}</Text>
            <Text style={styles.lastSeen}>{payload.last_seen}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text>{`${labels.conclusion}: ${payload.conclusion}`}</Text>
        </View>
      </Page>
    </Document>
  );
}
