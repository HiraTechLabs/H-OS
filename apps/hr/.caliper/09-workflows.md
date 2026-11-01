# H-HR Workflow Principles

## HHR-WF-001 — Explicit State Machines

Before implementing a significant workflow, define its states, valid transitions, actors, preconditions, side effects, cancellation/reversal behavior, and audit requirements.

## HHR-WF-002 — Approval Delegation

Support time-bounded delegation and reassignment of approvals. Preserve the original approver, delegate, reason, and delegation period.

## HHR-WF-003 — Notifications Are Not the Source of Truth

Notifications must link to authoritative requests or tasks. Missing or duplicated notifications must not change workflow state.

## HHR-WF-004 — Termination Checklist

A termination workflow should coordinate:

- Final employment date.
- Pending leave and attendance.
- Final payroll and settlement.
- Document retention.
- Asset and custody return.
- Account deprovisioning.
- Pending approvals and delegated responsibilities.

Track each downstream action's owner and status.

## HHR-WF-005 — Rehire

Support rehire without accidentally duplicating the employee or erasing prior employment history. Define employment-episode behavior in an approved domain decision.

## HHR-WF-006 — Bulk Operations

Bulk imports and updates require validation previews, duplicate detection, row-level errors, permission checks, confirmation, and audit records.

## HHR-WF-007 — Data Quality

Provide reports for missing required fields, expired documents, invalid reporting relationships, schedule conflicts, unassigned approvals, failed integrations, and unresolved payroll/attendance exceptions.

## HHR-WF-008 — HR Operations Dashboard

Provide an authorized HR operations view for pending approvals, upcoming contract/probation dates, leave and attendance exceptions, payroll run status, and failed integrations.