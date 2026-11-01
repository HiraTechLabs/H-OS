import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const folder = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const client = postgres(url, { max: 1, onnotice: () => undefined });
try {
  // One database, several schemas: each owning module keeps its own migration journal so an
  // independent app migration can never be mistaken for an already-applied platform migration.
  await migrate(drizzle(client), {
    migrationsFolder: folder,
    migrationsTable: '__drizzle_migrations_hr',
  });
  console.error(`hr migrations applied from ${folder}`);
} finally {
  await client.end({ timeout: 5 });
}
