import i18next from 'i18next';
import type { i18n } from 'i18next';
import type { Catalog, Locale } from './catalog.js';
import { en } from './en.js';
import { ar } from './ar.js';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'ar'];
export const DEFAULT_LOCALE: Locale = 'en';

/** Flattens `{ hr: { title: 'x' } }` into `{ 'hr.title': 'x' }` for i18next. */
export function flattenCatalog(catalog: Catalog, prefix = ''): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix.length === 0 ? key : `${prefix}.${key}`;
    if (typeof value === 'string') {
      flat[path] = value;
    } else {
      Object.assign(flat, flattenCatalog(value, path));
    }
  }
  return flat;
}

/** Every leaf path in a catalog, used by the parity test and by developers adding strings. */
export function catalogKeys(catalog: Catalog): string[] {
  return Object.keys(flattenCatalog(catalog)).sort();
}

export interface I18nOptions {
  readonly locale?: Locale;
  /** App catalogs merged after the shell catalog; app prefixes must not collide. */
  readonly extra?: Partial<Record<Locale, Catalog>>;
}

/**
 * One i18next instance for the whole shell. `fallbackLng` is deliberately `en` so a missing
 * Arabic key is visible as English text rather than a raw key; the parity test prevents that.
 */
export function createI18n(options: I18nOptions = {}): i18n {
  const locale = options.locale ?? DEFAULT_LOCALE;
  const resources = {
    en: { translation: { ...flattenCatalog(en), ...flattenCatalog(options.extra?.en ?? {}) } },
    ar: { translation: { ...flattenCatalog(ar), ...flattenCatalog(options.extra?.ar ?? {}) } },
  };

  const instance = i18next.createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LOCALES],
    resources,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return instance;
}

/** Locale direction for `<html dir>` (UX-006). */
export function directionFor(locale: string): 'ltr' | 'rtl' {
  return locale.startsWith('ar') ? 'rtl' : 'ltr';
}
