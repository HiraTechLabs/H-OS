import { Module } from '@nestjs/common';
import type { DynamicModule, Provider } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthGuard, KernelModule, ProblemFilter } from '@h-os/kernel';
import type { AppConfig } from '@h-os/kernel';
import { HrModule } from '@h-os/hr-api';
import { AuthController } from './auth/auth.controller.js';
import { HealthController } from './health/health.controller.js';
import { PlatformAccountController } from './platform/platform-account.controller.js';

/**
 * The composition root. It wires the platform kernel and the H-HR module and applies the
 * cross-cutting rules once: every request is authenticated unless explicitly public, and every
 * failure is rendered as problem+json (SEC-001, STK-007).
 */
@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    const providers: Provider[] = [
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_FILTER, useClass: ProblemFilter },
    ];

    return {
      module: AppModule,
      imports: [KernelModule.forRoot(config), HrModule],
      controllers: [AuthController, HealthController, PlatformAccountController],
      providers,
    };
  }
}
