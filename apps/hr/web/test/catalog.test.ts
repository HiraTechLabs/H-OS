import { describe, expect, it } from 'vitest';
import { catalogKeys, flattenCatalog } from '@h-os/i18n';
import { hrEn } from '../src/i18n/en.js';
import { hrAr } from '../src/i18n/ar.js';

/**
 * H-HR ships its own catalog under the `hr.` prefix. A missing Arabic string is a release
 * blocker (HHR-UX-007), so parity is enforced mechanically rather than by review.
 */
describe('H-HR catalogs', () => {
  it('define exactly the same keys in English and Arabic', () => {
    expect(catalogKeys(hrAr)).toEqual(catalogKeys(hrEn));
  });

  it('stay inside the hr. namespace so they cannot collide with shell copy', () => {
    for (const key of catalogKeys(hrEn)) {
      expect(key.startsWith('hr.')).toBe(true);
    }
  });

  it('contain no empty strings and no untranslated markers', () => {
    for (const [key, value] of Object.entries(flattenCatalog(hrEn))) {
      expect(value.trim(), key).not.toBe('');
      expect(value, key).not.toMatch(/TODO|FIXME|TRANSLATE/);
    }
    for (const [key, value] of Object.entries(flattenCatalog(hrAr))) {
      expect(value.trim(), key).not.toBe('');
      expect(value, key).not.toMatch(/TODO|FIXME|TRANSLATE/);
    }
  });

  it('keeps interpolation placeholders identical across locales', () => {
    const placeholders = (value: string): string[] =>
      [...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1] ?? '').sort();
    const english = flattenCatalog(hrEn);
    const arabic = flattenCatalog(hrAr);
    for (const key of Object.keys(english)) {
      expect(placeholders(arabic[key] ?? ''), key).toEqual(placeholders(english[key] ?? ''));
    }
  });
});
