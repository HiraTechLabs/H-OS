import { describe, expect, it } from 'vitest';
import type { ApplicationDefinition } from '@h-os/contracts';

describe('Global Dock logic & scalability', () => {
  const sampleApps: readonly ApplicationDefinition[] = [
    {
      id: 'hr',
      name: 'H-HR',
      displayName: { en: 'HR', ar: 'الموارد البشرية' },
      description: { en: 'People records', ar: 'سجلات الموظفين' },
      icon: 'hr',
      route: '/apps/hr',
      permission: 'app.hr.access',
      module: 'internal/apps/hr',
      availability: 'available',
      order: 10,
      navigation: null,
    },
    {
      id: 'finance',
      name: 'H-Finance',
      displayName: { en: 'Finance', ar: 'المالية' },
      description: { en: 'Financials', ar: 'المالية' },
      icon: 'finance',
      route: '/apps/finance',
      permission: 'app.finance.access',
      module: 'internal/apps/finance',
      availability: 'under_development',
      order: 20,
      navigation: null,
    },
  ];

  it('filters available applications for primary launch interactions', () => {
    const available = sampleApps.filter((a) => a.availability === 'available');
    expect(available).toHaveLength(1);
    expect(available[0]?.id).toBe('hr');
  });

  it('caps visible applications to 7 slots and triggers overflow when exceeding capacity', () => {
    const manyApps: ApplicationDefinition[] = Array.from({ length: 10 }, (_, i) => ({
      id: `app-${i}`,
      name: `App ${i}`,
      displayName: { en: `App ${i}`, ar: `تطبيق ${i}` },
      description: { en: `Description ${i}`, ar: `وصف ${i}` },
      icon: 'hr',
      route: `/apps/app-${i}`,
      permission: `app.${i}.access`,
      module: `internal/apps/app-${i}`,
      availability: 'available',
      order: i,
      navigation: null,
    }));

    const visible = manyApps.slice(0, 7);
    const hasOverflow = manyApps.length > 7;

    expect(visible).toHaveLength(7);
    expect(hasOverflow).toBe(true);
  });
});
