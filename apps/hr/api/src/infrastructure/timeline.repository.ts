import { Inject } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DATABASE } from '@h-os/kernel';
import type { Database, DbExecutor } from '@h-os/kernel';
import type { TimelineRecord, TimelineRepository } from '../application/ports.js';
import { employeeTimeline } from './schema.js';

export class DrizzleTimelineRepository implements TimelineRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async add(
    executor: DbExecutor,
    entry: {
      id: string;
      organizationId: string;
      employeeId: string;
      eventType: string;
      occurredOn: string;
      recordedAt: Date;
      summaryEn: string;
      summaryAr: string;
      actorAccountId: string | null;
      reason: string | null;
      relatedType: string | null;
      relatedId: string | null;
    },
  ): Promise<void> {
    await executor.insert(employeeTimeline).values({
      id: entry.id,
      organizationId: entry.organizationId,
      employeeId: entry.employeeId,
      eventType: entry.eventType,
      occurredOn: entry.occurredOn,
      recordedAt: entry.recordedAt,
      summaryEn: entry.summaryEn,
      summaryAr: entry.summaryAr,
      actorAccountId: entry.actorAccountId,
      reason: entry.reason,
      relatedType: entry.relatedType,
      relatedId: entry.relatedId,
    });
  }

  async list(employeeId: string, limit: number): Promise<readonly TimelineRecord[]> {
    const rows = await this.db
      .select()
      .from(employeeTimeline)
      .where(eq(employeeTimeline.employeeId, employeeId))
      .orderBy(desc(employeeTimeline.occurredOn), desc(employeeTimeline.recordedAt))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      occurredOn: row.occurredOn,
      recordedAt: row.recordedAt,
      summaryEn: row.summaryEn,
      summaryAr: row.summaryAr,
      reason: row.reason,
      actorAccountId: row.actorAccountId,
    }));
  }
}
