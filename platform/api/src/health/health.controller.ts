import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { CLOCK, DATABASE, Public } from '@h-os/kernel';
import type { Clock, Database } from '@h-os/kernel';

export interface HealthStatus {
  readonly status: 'ok' | 'degraded';
  readonly database: 'up' | 'down';
  readonly checkedAt: string;
}

/**
 * Liveness/readiness probe. It is public because infrastructure must reach it before anyone can
 * sign in, and it exposes no business data (SEC-012).
 */
@Controller('api/v1/health')
export class HealthController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Public()
  @Get()
  async check(): Promise<HealthStatus> {
    let database: 'up' | 'down' = 'up';
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      database = 'down';
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      checkedAt: this.clock.now().toISOString(),
    };
  }
}
