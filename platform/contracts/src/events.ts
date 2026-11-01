import { z } from 'zod';
import { EntityRefSchema } from './links.js';

/**
 * Domain events travel through the transactional outbox and are published in the same
 * transaction as the state change (ARCH-007). Payloads are non-sensitive by construction:
 * they never carry national IDs, bank details or amounts (SEC-008, LOG-003).
 */
export const EVENT_SCHEMA_VERSION = 1;

export const HrEventType = {
  EMPLOYEE_CREATED: 'hr.employee.created.v1',
  EMPLOYEE_UPDATED: 'hr.employee.updated.v1',
  EMPLOYEE_STATUS_CHANGED: 'hr.employee.status-changed.v1',
  EMPLOYEE_EPISODE_STARTED: 'hr.employment-episode.started.v1',
  EMPLOYEE_EPISODE_ENDED: 'hr.employment-episode.ended.v1',
  ASSIGNMENT_CHANGED: 'hr.assignment.changed.v1',
  MANAGER_CHANGED: 'hr.manager.changed.v1',
  ACCOUNT_LINKED: 'hr.account-linked.v1',
} as const;

export type HrEventType = (typeof HrEventType)[keyof typeof HrEventType];

export const PlatformEventType = {
  ORG_SCOPE_CHANGED: 'platform.org-scope.changed.v1',
} as const;

export type PlatformEventType = (typeof PlatformEventType)[keyof typeof PlatformEventType];

export const EventEnvelopeSchema = z.strictObject({
  id: z.uuid(),
  type: z.string().min(1).max(120),
  version: z.number().int().min(1),
  occurredAt: z.string(),
  organizationId: z.uuid(),
  subject: EntityRefSchema,
  traceId: z.string().min(1).max(64),
  correlationId: z.string().min(1).max(64).nullable(),
  payload: z.record(z.string(), z.unknown()),
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

export interface EmployeeCreatedPayload {
  readonly employeeId: string;
  readonly employeeNumber: string;
  readonly employmentEpisodeId: string;
  readonly effectiveFrom: string;
}
