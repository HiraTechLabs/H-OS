import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { and, asc, isNull, lt, sql } from 'drizzle-orm';
import type { DbExecutor } from '../db/client.js';
import { DATABASE } from '../db/database.provider.js';
import { outboxEvent } from '../db/schema.js';
import { CLOCK, ID_GENERATOR } from '../clock.js';
import type { Clock, IdGenerator } from '../clock.js';
import { currentRequestContext } from '../http/request-context.js';

export const MAX_DELIVERY_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 1_000;
const BATCH_SIZE = 50;

export interface EventSubject {
  readonly app: string;
  readonly type: string;
  readonly id: string;
}

export interface DomainEventDraft {
  readonly type: string;
  readonly version: number;
  readonly subject: EventSubject;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly correlationId?: string | null;
  readonly occurredAt?: Date;
}

export interface OutboxEnvelope {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly organizationId: string;
  readonly subject: EventSubject;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly occurredAt: Date;
  readonly traceId: string;
}

export type EventHandler = (event: OutboxEnvelope) => Promise<void>;

/**
 * Transactional outbox (ARCH-007). Events are written in the same transaction as the state change
 * and dispatched in-process. Handlers must be idempotent: delivery is at-least-once.
 */
@Injectable()
export class OutboxService {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async enqueue(
    executor: DbExecutor,
    organizationId: string,
    draft: DomainEventDraft,
  ): Promise<string> {
    const id = this.ids.uuid();
    const context = currentRequestContext();
    await executor.insert(outboxEvent).values({
      id,
      organizationId,
      type: draft.type,
      version: draft.version,
      subjectApp: draft.subject.app,
      subjectType: draft.subject.type,
      subjectId: draft.subject.id,
      payload: draft.payload,
      traceId: context?.traceId ?? this.ids.uuid(),
      correlationId: draft.correlationId ?? null,
      occurredAt: draft.occurredAt ?? this.clock.now(),
    });
    return id;
  }
}

@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private readonly handlers = new Map<string, EventHandler[]>();
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(@Inject(DATABASE) private readonly db: DbExecutor) {}

  register(type: string, handler: EventHandler): void {
    const existing = this.handlers.get(type) ?? [];
    existing.push(handler);
    this.handlers.set(type, existing);
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      void this.dispatchOnce();
    }, POLL_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Exposed so tests can drive delivery deterministically instead of sleeping. */
  async dispatchOnce(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let delivered = 0;
    try {
      const pending = await this.db
        .select()
        .from(outboxEvent)
        .where(and(isNull(outboxEvent.publishedAt), lt(outboxEvent.attempts, MAX_DELIVERY_ATTEMPTS)))
        .orderBy(asc(outboxEvent.occurredAt))
        .limit(BATCH_SIZE);

      for (const row of pending) {
        const envelope: OutboxEnvelope = {
          id: row.id,
          type: row.type,
          version: row.version,
          organizationId: row.organizationId,
          subject: { app: row.subjectApp, type: row.subjectType, id: row.subjectId },
          payload: (row.payload ?? {}) as Readonly<Record<string, unknown>>,
          occurredAt: row.occurredAt,
          traceId: row.traceId,
        };
        const handlers = this.handlers.get(row.type) ?? [];
        try {
          for (const handler of handlers) {
            await handler(envelope);
          }
          await this.db
            .update(outboxEvent)
            .set({ publishedAt: new Date(), attempts: row.attempts + 1 })
            .where(sql`${outboxEvent.id} = ${row.id} and ${outboxEvent.publishedAt} is null`);
          delivered += 1;
        } catch (error) {
          const code = error instanceof Error ? error.name : 'unknown_error';
          await this.db
            .update(outboxEvent)
            .set({ attempts: row.attempts + 1, lastErrorCode: code })
            .where(sql`${outboxEvent.id} = ${row.id}`);
          this.logger.warn({ event: 'outbox.delivery_failed', type: row.type, code });
        }
      }
    } finally {
      this.running = false;
    }
    return delivered;
  }

  /**
   * Failed events are never deleted or marked as delivered: they stay visible with their attempt
   * count so an operator can retry or reconcile (HHR-INT-008/009).
   */
  async failedEvents(): Promise<readonly { id: string; type: string; attempts: number }[]> {
    const rows = await this.db
      .select({ id: outboxEvent.id, type: outboxEvent.type, attempts: outboxEvent.attempts })
      .from(outboxEvent)
      .where(isNull(outboxEvent.publishedAt));
    return rows;
  }
}
