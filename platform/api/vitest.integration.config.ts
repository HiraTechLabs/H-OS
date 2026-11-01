import { defineConfig } from 'vitest/config';

/**
 * Integration tests boot the real HTTP application against a disposable PostgreSQL container and
 * apply the real migrations. Nothing is mocked: authorization, persistence, audit and outbox are
 * exercised end to end. The same config also runs the fast unit suites under `test/unit`.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    hookTimeout: 180_000,
    testTimeout: 60_000,
    pool: 'forks',
    fileParallelism: false,
    reporters: ['default'],
  },
});
