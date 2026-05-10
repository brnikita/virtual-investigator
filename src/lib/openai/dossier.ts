import OpenAI from 'openai';
import { serverEnv } from '@/lib/env';

// Compose the structured dossier payload (the JSON consumed by the print
// template) from the raw evidence rows + transcript. The Realtime detective
// already calls record_evidence per fact, but a final pass with a text model
// turns those facts into:
//   - the playful headline ("Объект наблюдения: ...")
//   - the danger-scale bars (милота, загадочность, ...)
//   - the witty closing remark
//
// Using the cheap text model here (gpt-4o-mini class) keeps cost under $0.01.

export interface DossierComposeInput {
  language: 'ru' | 'en';
  suspectName: string;
  evidence: Array<{ category: string; key: string; value: string }>;
  transcriptHighlights?: string[];
}

export interface DossierPayload {
  language: 'ru' | 'en';
  headline: string;
  subheadline: string;
  identity: Record<string, string>;
  observations: string[];
  scales: Array<{ label: string; value: number; max: number }>;
  exhibits: string[];
  last_seen: string;
  conclusion: string;
}

export async function composeDossier(input: DossierComposeInput): Promise<DossierPayload> {
  const env = serverEnv();
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const sys = input.language === 'ru'
    ? 'Ты редактор шуточного школьного «досье». Тон тёплый, дружелюбный, без криминала. Пиши по-русски.'
    : 'You edit a playful school "dossier". Tone warm, friendly, never criminal. Write in English.';

  const userMsg = JSON.stringify({
    suspectName: input.suspectName,
    evidence: input.evidence,
    transcriptHighlights: input.transcriptHighlights ?? [],
    targetSchema: 'DossierPayload',
  });

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: sys },
      {
        role: 'user',
        content:
          'Заполни структуру DossierPayload (headline, subheadline, identity{}, observations[], scales[{label,value,max}], exhibits[], last_seen, conclusion) на основе данных. Шкалы должны быть забавными (например: Милота, Загадочность, Подарконосность). Верни строго JSON.\n\nДанные:\n' +
          userMsg,
      },
    ],
  });

  const text = resp.choices[0]?.message.content ?? '{}';
  const parsed = JSON.parse(text) as DossierPayload;
  // The model may forget the language field; pin it from input.
  parsed.language = input.language;
  return parsed;
}
