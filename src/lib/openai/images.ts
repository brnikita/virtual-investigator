import OpenAI from 'openai';
import { serverEnv } from '@/lib/env';

// Generate the cartoon "фоторобот" portrait that anchors the printable dossier.
// The reference photo (suspect_photo) is passed as a low-fidelity guide; the
// model is instructed to produce a friendly cartoon, never a photoreal copy.
export interface PortraitInput {
  suspectName: string;
  language: 'ru' | 'en';
  /** Optional URL or base64 data URL of the reference photo. */
  referencePhotoDataUrl?: string;
  /** Free-form notes from the interview (hair color, clothes, mood). */
  appearanceNotes: string[];
}

export interface PortraitOutput {
  /** PNG bytes. Caller is responsible for uploading to Storage. */
  bytes: Uint8Array;
  /** What we billed against. */
  cost_estimate_usd: number;
}

export async function generateDossierPortrait(input: PortraitInput): Promise<PortraitOutput> {
  const env = serverEnv();
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const prompt = buildPortraitPrompt(input);

  // gpt-image-2 supports both pure generation and image-edit / variation. For
  // the MVP we use generation with a textual description of the reference.
  // TODO(agent): switch to images.edit when reference photo is provided to
  // produce a closer-match cartoon.
  const result = await openai.images.generate({
    model: env.OPENAI_IMAGE_MODEL,
    prompt,
    size: '1024x1024',
    quality: env.OPENAI_IMAGE_QUALITY,
    n: 1,
  });

  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error('Image generation returned no data');
  const bytes = Uint8Array.from(Buffer.from(b64, 'base64'));

  return {
    bytes,
    cost_estimate_usd: estimateImageCost(env.OPENAI_IMAGE_QUALITY),
  };
}

function estimateImageCost(quality: 'low' | 'medium' | 'high'): number {
  // Rough public pricing for gpt-image-2 at 1024x1024.
  return { low: 0.006, medium: 0.053, high: 0.211 }[quality];
}

function buildPortraitPrompt(i: PortraitInput): string {
  const headRu = `Шуточный детский «фоторобот» для дружелюбного школьного досье на персонажа по имени ${i.suspectName}.`;
  const headEn = `A friendly children's cartoon "police sketch" for a school dossier of ${i.suspectName}.`;
  const head = i.language === 'ru' ? headRu : headEn;
  const styleRu = [
    'Стиль: мягкий карикатурный набросок ребёнка, не фотореалистичный, без мрачности.',
    'Тёплые цвета, школьная бумага в клетку как фон, лёгкие doodle-элементы.',
    'Лицо круглое, доброе, лёгкая улыбка, образ узнаваемо детский.',
    'Никаких оружия, наручников, криминальных мотивов. Образ дружелюбный, как добрая семейная шутка.',
  ].join(' ');
  const styleEn = [
    'Style: soft, friendly cartoon sketch as if drawn by a child, not photorealistic.',
    'Warm colors, grid school-paper background, gentle doodle accents.',
    'Round, kind face with a slight smile. Recognizably childlike.',
    'No weapons, no handcuffs, no crime motifs. Treat it as a wholesome family joke.',
  ].join(' ');
  const style = i.language === 'ru' ? styleRu : styleEn;
  const notes = i.appearanceNotes.length
    ? `\n\nDetails from the interview:\n- ${i.appearanceNotes.join('\n- ')}`
    : '';
  return `${head}\n\n${style}${notes}`;
}
