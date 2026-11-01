import {
  CryptoIdGenerator,
  LocalAuthProvider,
  createDatabase,
  loadConfig,
} from '@h-os/kernel';
import { seedPlatform } from './seed.js';

/**
 * Seeds the platform from environment configuration. Safe to run repeatedly: it never resets an
 * existing administrator password and never duplicates roles or permissions.
 */
async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const handle = createDatabase(config.databaseUrl, { max: 1 });
  try {
    const result = await seedPlatform(
      handle.db,
      config,
      new CryptoIdGenerator(),
      new LocalAuthProvider(),
    );
    process.stdout.write(
      `${JSON.stringify({ event: 'bootstrap.seeded', ...result })}\n`,
    );
  } finally {
    await handle.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  process.stderr.write(`${JSON.stringify({ event: 'bootstrap.failed', message })}\n`);
  process.exitCode = 1;
});
