import { useTranslation } from 'react-i18next';
import type { LocalizedText } from '@h-os/contracts';
import type { Locale } from '@h-os/i18n';
import { localizedName } from '@h-os/web-client';

export function useLocale(): Locale {
  const { i18n } = useTranslation();
  return i18n.language.startsWith('ar') ? 'ar' : 'en';
}

/** Renders a server-localised value in the active language, with Latin fallback for mixed data. */
export function Localized({ value }: { readonly value: LocalizedText | null | undefined }): string {
  const locale = useLocale();
  return localizedName(value, locale);
}

/**
 * Imperative variant for places where a component cannot be a child, such as `<option>` text.
 * Both variants resolve through the same helper, so mixed data formats identically.
 */
export function useLocalize(): (value: LocalizedText | null | undefined) => string {
  const locale = useLocale();
  return (value) => localizedName(value, locale);
}
