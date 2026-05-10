import { Document, Font, Image as PdfImage, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { DossierPayload } from '@/types/domain';

// Register two open-source handwritten faces from Google Fonts. We pull the
// raw .ttf URLs (gstatic.com) instead of bundling binaries with the repo.
// "Caveat" carries the headline, "Patrick Hand" handles body copy. The
// renderer downloads + caches them on first render; subsequent calls are
// in-memory.
//
// NOTE: Font.register is idempotent in @react-pdf/renderer — a second call
// with the same family name is a no-op, so we don't have to gate it.
Font.register({
  family: 'Caveat',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjcB9eIqp.ttf',
      fontWeight: 'normal',
    },
    {
      src: 'https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjf99eIqp.ttf',
      fontWeight: 'bold',
    },
  ],
});

Font.register({
  family: 'PatrickHand',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/patrickhand/v23/LDI1apSQOAYtSuYWp8ZhfYeMWcjKm7sp8g.ttf',
      fontWeight: 'normal',
    },
  ],
});

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
    fontFamily: 'PatrickHand',
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
    fontFamily: 'Caveat',
    fontWeight: 'bold',
    fontSize: 28,
    letterSpacing: 1,
  },
  subheadline: {
    marginTop: 2,
    fontStyle: 'italic',
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
    fontFamily: 'Caveat',
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
    fontFamily: 'Caveat',
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
    fontFamily: 'Caveat',
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
    fontStyle: 'italic',
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
    fontStyle: 'italic',
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
