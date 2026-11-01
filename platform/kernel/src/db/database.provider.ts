import type { Provider } from '@nestjs/common';
import { createDatabase } from './client.js';
import type { DatabaseHandle } from './client.js';
import type { AppConfig } from '../config.js';
import { CONFIG } from '../config.js';

export const DATABASE = Symbol('H_OS_DATABASE');
export const DATABASE_HANDLE = Symbol('H_OS_DATABASE_HANDLE');

/** Creates the single connection pool of the modular monolith (one database, many schemas). */
export function databaseProviders(): readonly Provider[] {
  return [
    {
      provide: DATABASE_HANDLE,
      inject: [CONFIG],
      useFactory: (config: AppConfig): DatabaseHandle => createDatabase(config.databaseUrl),
    },
    {
      provide: DATABASE,
      inject: [DATABASE_HANDLE],
      useFactory: (handle: DatabaseHandle) => handle.db,
    },
  ];
}
