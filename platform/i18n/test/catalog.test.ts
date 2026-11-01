import { describe, expect, it } from 'vitest';
import { createI18n, catalogKeys, directionFor, flattenCatalog } from '../src/index.js';
import { en } from '../src/en.js';
import { ar } from '../src/ar.js';

/**
 * A missing Arabic string is a release blocker (UX-006, HHR-UX-007), so parity is enforced
 * mechanically instead of by review.
 */
describe('shell catalogs', () => {
  it('define exactly the same keys in English and Arabic', () => {
    expect(catalogKeys(ar)).toEqual(catalogKeys(en));
  });

  it('contain no empty strings and no leftover untranslated markers', () => {
    for (const [key, value] of Object.entries(flattenCatalog(en))) {
      expect(value.trim(), key).not.toBe('');
      expect(value, key).not.toMatch(/TODO|FIXME|TRANSLATE/);
    }
    for (const [key, value] of Object.entries(flattenCatalog(ar))) {
      expect(value.trim(), key).not.toBe('');
      expect(value, key).not.toMatch(/TODO|FIXME|TRANSLATE/);
    }
  });

  it('keeps interpolation placeholders identical across locales', () => {
    const placeholders = (value: string): string[] =>
      [...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1] ?? '').sort();
    const english = flattenCatalog(en);
    const arabic = flattenCatalog(ar);
    for (const key of Object.keys(english)) {
      expect(placeholders(arabic[key] ?? ''), key).toEqual(placeholders(english[key] ?? ''));
    }
  });

  it('resolves shell and app strings and switches direction', async () => {
    const i18n = createI18n({
      locale: 'ar',
      extra: { ar: { hr: { title: 'الموظفون' } }, en: { hr: { title: 'Employees' } } },
    });
    await i18n.changeLanguage('ar');
    expect(i18n.t('nav.employees')).toBe('الموظفون');
    expect(i18n.t('hr.title')).toBe('الموظفون');
    expect(directionFor('ar')).toBe('rtl');
    expect(directionFor('en')).toBe('ltr');
  });

  it('interpolates counted values instead of concatenating them', async () => {
    const i18n = createI18n();
    expect(i18n.t('common.showing', { count: 12 })).toBe('Showing 12');
  });

  it('merges app catalogs under their prefix without overwriting shell keys', () => {
    const merged = flattenCatalog({
      hr: { employees: { title: 'Employees', subtitle: 'Directory' } },
    });
    expect(merged['hr.employees.title']).toBe('Employees');
    expect(merged['nav.employees']).toBeUndefined();
  });
});
