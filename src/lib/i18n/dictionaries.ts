import type { Locale } from './config';

// Tiny in-repo dictionary. For the MVP we don't need a full message-extraction
// pipeline — keys live next to the code that uses them.
export const dictionaries = {
  ru: () => import('@/../public/locales/ru/common.json').then((m) => m.default),
  en: () => import('@/../public/locales/en/common.json').then((m) => m.default),
} as const;

export async function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}
