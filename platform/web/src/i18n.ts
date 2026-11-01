import { createI18n, directionFor } from '@h-os/i18n';
import type { Locale } from '@h-os/i18n';
import { hrAr, hrEn } from '@h-os/hr-web/i18n';

export const LOCALE_STORAGE_KEY = 'h-os.locale';

/** Reads the last chosen language, falling back to English when storage is unavailable. */
export function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

export function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // A blocked storage API must not break language switching for the current visit.
  }
}

/** Keeps `<html lang>` and `<html dir>` in step with the active language (UX-006, HHR-UX-007). */
export function applyDocumentLocale(locale: string): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = directionFor(locale);
}

/** One i18next instance for the shell plus every app catalog the shell hosts. */
export const i18n = createI18n({
  locale: readStoredLocale(),
  extra: { en: hrEn, ar: hrAr },
});
