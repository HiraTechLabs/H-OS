import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@h-os/ui';
import { SUPPORTED_LOCALES } from '@h-os/i18n';
import type { Locale } from '@h-os/i18n';
import { applyDocumentLocale, persistLocale } from '../i18n.js';

/**
 * One language switch for the whole shell. Changing it re-renders every app, flips
 * `<html dir>`, and persists the choice for the next visit (UX-006, HHR-UX-007).
 */
export function LanguageSwitcher(): ReactNode {
  const { t, i18n } = useTranslation();
  const current: Locale = i18n.language.startsWith('ar') ? 'ar' : 'en';

  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">{t('shell.language')}</span>
      <Select
        className="w-auto py-1 text-xs"
        value={current}
        aria-label={t('shell.language')}
        onChange={(event) => {
          const next: Locale = event.target.value === 'ar' ? 'ar' : 'en';
          void i18n.changeLanguage(next);
          persistLocale(next);
          applyDocumentLocale(next);
        }}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {locale === 'ar' ? t('shell.switchToArabic') : t('shell.switchToEnglish')}
          </option>
        ))}
      </Select>
    </label>
  );
}
