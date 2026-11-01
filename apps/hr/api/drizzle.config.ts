import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infrastructure/schema.ts',
  out: './migrations',
  schemaFilter: ['hr'],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://h_os:h_os@localhost:5433/h_os',
  },
});
