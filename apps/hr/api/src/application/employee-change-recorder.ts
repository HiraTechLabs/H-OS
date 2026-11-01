import { Inject, Injectable } from '@nestjs/common';
import { AuditService, CLOCK, ID_GENERATOR, OutboxService } from '@h-os/kernel';
import type { Actor, Clock, DbExecutor, IdGenerator } from '@h-os/kernel';
import { TIMELINE_REPOSITORY } from './ports.js';
import type { TimelineRepository } from './ports.js';

export interface RecordedChange {
  /** Stable audit action, e.g. `hr.employee.status_changed`. */
  readonly action: string;
  readonly employeeId: string;
  readonly effectiveOn: string;
  readonly summaries: { readonly en: string; readonly ar: string };
  readonly reason: string | null;
  readonly before?: Readonly<Record<string, unknown>>;
  readonly after?: Readonly<Record<string, unknown>>;
  readonly event?: {
    readonly type: string;
    readonly version: number;
    readonly payload: Readonly<Record<string, unknown>>;
  };
  readonly relatedType?: string | null;
  readonly relatedId?: string | null;
}

/**
 * Writes the business audit record, the employee timeline entry and the outbox event inside the
 * same transaction as the state change, so history, audit and events can never diverge
 * (SEC-007, HHR-EMP-006, ARCH-007). Operational logs are never used as audit evidence (LOG-006).
 */
@Injectable()
export class EmployeeChangeRecorder {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(TIMELINE_REPOSITORY) private readonly timeline: TimelineRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async record(
    executor: DbExecutor,
    actor: Actor,
    organizationId: string,
    change: RecordedChange,
  ): Promise<void> {
    const recordedAt = this.clock.now();
    await this.audit.record(executor, actor, organizationId, {
      action: change.action,
      subject: { app: 'hr', type: 'employee', id: change.employeeId },
      ...(change.before ? { before: change.before } : {}),
      ...(change.after ? { after: change.after } : {}),
      ...(change.reason ? { reason: change.reason } : {}),
    });
    await this.timeline.add(executor, {
      id: this.ids.uuid(),
      organizationId,
      employeeId: change.employeeId,
      eventType: change.event?.type ?? change.action,
      occurredOn: change.effectiveOn,
      recordedAt,
      summaryEn: change.summaries.en,
      summaryAr: change.summaries.ar,
      actorAccountId: actor.accountId,
      reason: change.reason,
      relatedType: change.relatedType ?? null,
      relatedId: change.relatedId ?? null,
    });
    if (change.event) {
      await this.outbox.enqueue(executor, organizationId, {
        type: change.event.type,
        version: change.event.version,
        subject: { app: 'hr', type: 'employee', id: change.employeeId },
        payload: change.event.payload,
      });
    }
  }
}
