import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

export type Database = PostgresJsDatabase<Record<string, never>>;

type TransactionCallback = Parameters<Database['transaction']>[0];
export type Transaction = Parameters<TransactionCallback>[0];

/** Anything that can run a query: the pool or an open transaction. */
export type DbExecutor = Database | Transaction;

export interface DatabaseHandle {
  readonly db: Database;
  readonly close: () => Promise<void>;
}

export function createDatabase(url: string, options?: { max?: number }): DatabaseHandle {
  const client = postgres(url, {
    max: options?.max ?? 10,
    onnotice: () => undefined,
  });
  const db = drizzle(client);
  return {
    db,
    close: async () => {
      await client.end({ timeout: 5 });
    },
  };
}
