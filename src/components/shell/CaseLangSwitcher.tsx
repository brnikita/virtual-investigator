'use client';

import { useCallback } from 'react';
import { LangSwitcher } from './LangSwitcher';
import type { Locale } from '@/lib/i18n/config';
import { updateCaseLanguage } from '@/app/(game)/case/[caseId]/actions';

// Thin client wrapper that binds a per-case server action to the language
// switcher. Pages mount this directly; the action is server-side and uses
// the user's session for the auth check, so nothing sensitive crosses the
// boundary.
export function CaseLangSwitcher({
  caseId,
  value,
  pickerLabel,
  savingLabel,
}: {
  caseId: string;
  value: Locale;
  pickerLabel: string;
  savingLabel: string;
}) {
  const onChange = useCallback(
    async (next: Locale) => {
      await updateCaseLanguage({ caseId, language: next });
    },
    [caseId],
  );
  return (
    <LangSwitcher
      value={value}
      onChange={onChange}
      pickerLabel={pickerLabel}
      savingLabel={savingLabel}
    />
  );
}
