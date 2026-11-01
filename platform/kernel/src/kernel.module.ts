import { Global, Inject, Injectable, Module } from '@nestjs/common';
import type { DynamicModule, OnApplicationShutdown, Provider } from '@nestjs/common';
import type { AppConfig } from './config.js';
import { CONFIG } from './config.js';
import { CLOCK, CryptoIdGenerator, ID_GENERATOR, SystemClock } from './clock.js';
import { DATABASE, DATABASE_HANDLE, databaseProviders } from './db/database.provider.js';
import type { DatabaseHandle } from './db/client.js';
import { AUTH_PROVIDER, LocalAuthProvider } from './auth/auth-provider.js';
import { SessionService } from './auth/session.service.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AccountDirectoryService } from './auth/account-directory.service.js';
import { AccountManagementService } from './auth/account-management.service.js';
import { PermissionService } from './rbac/permission.service.js';
import { AuditService } from './audit/audit.service.js';
import { OutboxDispatcher, OutboxService } from './outbox/outbox.service.js';
import { EntityLinkService } from './links/entity-link.service.js';

@Injectable()
export class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_HANDLE) private readonly handle: DatabaseHandle) {}

  async onApplicationShutdown(): Promise<void> {
    await this.handle.close();
  }
}

/**
 * The kernel stays small on purpose: identity, authorization, org-scope inputs, audit, events,
 * links. Business logic never moves in here (ARCH-013, CORE-012).
 */
@Global()
@Module({})
export class KernelModule {
  static forRoot(config: AppConfig): DynamicModule {
    const providers: Provider[] = [
      { provide: CONFIG, useValue: config },
      ...databaseProviders(),
      DatabaseLifecycle,
      { provide: CLOCK, useClass: SystemClock },
      { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
      { provide: AUTH_PROVIDER, useClass: LocalAuthProvider },
      SessionService,
      AuthGuard,
      AccountDirectoryService,
      AccountManagementService,
      PermissionService,
      AuditService,
      OutboxService,
      OutboxDispatcher,
      EntityLinkService,
    ];

    return {
      module: KernelModule,
      global: true,
      providers,
      exports: [
        CONFIG,
        DATABASE,
        DATABASE_HANDLE,
        CLOCK,
        ID_GENERATOR,
        AUTH_PROVIDER,
        SessionService,
        AuthGuard,
        AccountDirectoryService,
        AccountManagementService,
        PermissionService,
        AuditService,
        OutboxService,
        OutboxDispatcher,
        EntityLinkService,
      ],
    };
  }
}
