import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { EntityRef } from '@h-os/contracts';
import type { DbExecutor } from '../db/client.js';
import { DATABASE } from '../db/database.provider.js';
import { entityLink } from '../db/schema.js';
import { CLOCK, ID_GENERATOR } from '../clock.js';
import type { Clock, IdGenerator } from '../clock.js';
import type { EventSubject } from '../outbox/outbox.service.js';

/**
 * Cross-app links are typed references resolved here, never URL strings or cross-schema joins
 * (BIZ-011, ARCH-014). H-HR stores `archive:document` and `asset:asset` links.
 */
@Injectable()
export class EntityLinkService {
  constructor(
    @Inject(DATABASE) private readonly db: DbExecutor,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async link(
    executor: DbExecutor,
    organizationId: string,
    source: EventSubject,
    targets: readonly EntityRef[],
  ): Promise<void> {
    if (targets.length === 0) return;
    await executor
      .insert(entityLink)
      .values(
        targets.map((target) => ({
          id: this.ids.uuid(),
          organizationId,
          sourceApp: source.app,
          sourceType: source.type,
          sourceId: source.id,
          targetApp: target.app,
          targetType: target.type,
          targetId: target.id,
          createdAt: this.clock.now(),
        })),
      )
      .onConflictDoNothing();
  }

  async targetsOf(
    organizationId: string,
    source: EventSubject,
    targetApp?: string,
  ): Promise<readonly EntityRef[]> {
    const conditions = [
      eq(entityLink.organizationId, organizationId),
      eq(entityLink.sourceApp, source.app),
      eq(entityLink.sourceType, source.type),
      eq(entityLink.sourceId, source.id),
    ];
    if (targetApp) conditions.push(eq(entityLink.targetApp, targetApp));
    const rows = await this.db
      .select({
        app: entityLink.targetApp,
        type: entityLink.targetType,
        id: entityLink.targetId,
      })
      .from(entityLink)
      .where(and(...conditions));
    return rows;
  }
}
