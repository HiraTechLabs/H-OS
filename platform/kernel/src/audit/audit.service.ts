import { Inject, Injectable } from '@nestjs/common';
import type { DbExecutor } from '../db/client.js';
import { auditRecord } from '../db/schema.js';
import { CLOCK, ID_GENERATOR } from '../clock.js';
import type { Clock, IdGenerator } from '../clock.js';
import { currentRequestContext } from '../http/request-context.js';
import type { Actor } from '../auth/actor.js';

/**
 * Keys that must never reach the audit store in clear form (SEC-008, HHR-SEC-006).
 * Sensitive values are recorded as changed-vs-unchanged, not as values.
 */
const SENSITIVE_KEYS: readonly string[] = [
  'nationalid',
  'national_id',
  'passport',
  'passportnumber',
  'passport_number',
  'iban',
  'bankaccount',
  'bank_account',
  'salary',
  'basicamount',
  'basic_amount',
  'netamount',
  'net_amount',
  'password',
  'passwordhash',
  'medicalnotes',
  'medical_notes',
  'token',
];

export function redactSnapshot(
  value: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | null {
  if (!value) return null;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      result[key] = entry === null || entry === undefined ? null : '[redacted]';
    } else {
      result[key] = entry;
    }
  }
  return result;
}

export interface AuditSubject {
  readonly app: string;
  readonly type: string;
  readonly id: string;
}

export interface AuditInput {
  readonly action: string;
  readonly subject: AuditSubject;
  readonly before?: Readonly<Record<string, unknown>>;
  readonly after?: Readonly<Record<string, unknown>>;
  readonly reason?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /**
   * Writes an append-only audit record inside the caller's transaction so a state change and its
   * audit entry can never diverge (SEC-007). Operational logs are never used as audit evidence.
   */
  async record(
    executor: DbExecutor,
    actor: Actor | null,
    organizationId: string,
    input: AuditInput,
  ): Promise<void> {
    const context = currentRequestContext();
    await executor.insert(auditRecord).values({
      id: this.ids.uuid(),
      organizationId,
      actorAccountId: actor?.accountId ?? null,
      action: input.action,
      subjectApp: input.subject.app,
      subjectType: input.subject.type,
      subjectId: input.subject.id,
      before: redactSnapshot(input.before),
      after: redactSnapshot(input.after),
      reason: input.reason ?? null,
      requestId: context?.requestId ?? 'system',
      traceId: context?.traceId ?? this.ids.uuid(),
      occurredAt: this.clock.now(),
    });
  }
}
