import { defineConfig } from 'vitest/config';

/**
 * Unit tests only. They never touch a database or the network; integration coverage lives in the
 * composition root (`platform/api`) where a full HTTP application can be booted.
 */
export default defineConfig({
  test: {
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
  },
});
