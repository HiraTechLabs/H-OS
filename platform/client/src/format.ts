import type { LocalizedText } from '@h-os/contracts';
import type { Locale } from '@h-os/i18n';

const DATE_LOCALES: Record<Locale, string> = {
  // Gregorian calendar is a business requirement, not a locale accident (BIZ-010).
  en: 'en-GB',
  ar: 'ar-SA-u-ca-gregory',
};

/** Picks the active locale from a server-localised value, never concatenating the two. */
export function localizedName(value: LocalizedText | null | undefined, locale: Locale): string {
  if (!value) return '';
  return locale === 'ar' ? value.ar : value.en;
}

export function formatDate(value: string | null | undefined, locale: Locale): string {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

export function formatDateTime(value: string | null | undefined, locale: Locale): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(DATE_LOCALES[locale]).format(value);
}
