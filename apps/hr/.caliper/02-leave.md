# Leave Management Principles

## HHR-LEV-001 — Configurable Leave Types

Support configurable leave types, potentially including:

- Annual leave.
- Sick leave.
- Emergency leave.
- Unpaid leave.
- Parental leave.
- Maternity and paternity leave where applicable.
- Bereavement leave.
- Marriage leave.
- Study or examination leave.
- Work-injury leave.
- Compensatory time off.
- Company-specific leave categories.

These are examples, not a declaration of legal entitlement. The actual types and rules must be approved.

## HHR-LEV-002 — Leave Policy Configuration

A leave policy may define:

- Eligibility criteria.
- Minimum service period.
- Probation eligibility.
- Accrual frequency.
- Annual or monthly entitlement.
- Proration for joining or leaving mid-period.
- Carryover rules.
- Carryover expiration.
- Maximum balance.
- Minimum request duration.
- Maximum continuous duration.
- Required supporting documents.
- Approval requirements.
- Negative-balance exceptions.
- Treatment during unpaid leave or suspension.
- Settlement during termination.

Policies must be versioned and effective-dated.

## HHR-LEV-003 — Accrual and Balance Ledger

Track opening balances, accruals, approved usage, reservations if used, cancellations, expiry, transfers, adjustments, and termination settlement.

A displayed balance must be reconcilable to its underlying transactions. Do not rely only on a manually edited balance field.

## HHR-LEV-004 — Leave Units and Calendar

Support full days, half days, and hours when allowed by policy.

Calculate duration using the employee's applicable schedule and work calendar. Handle holidays, weekly rest days, part-time work, shift changes, and overnight shifts.

## HHR-LEV-005 — Request Lifecycle

Define explicit states and transitions, including draft, submitted, pending approval, returned for information, approved, partially approved where allowed, rejected, cancelled, in progress, completed, and corrected or reversed.

The system must validate permitted transitions and record who performed each action.

## HHR-LEV-006 — Overlapping Requests

Detect overlapping requests by employee and applicable time window. Define whether partial overlap, concurrent requests, or requests across different leave types are allowed.

Prevent concurrent approvals from consuming the same available balance.

## HHR-LEV-007 — Insufficient Balance

Define behavior when an employee has insufficient balance: reject, allow unpaid leave, allow an approved exception, or use another configured policy. Do not silently create a negative balance.

## HHR-LEV-008 — Retroactive and Future Requests

Support future leave and define the handling of retrospective leave requests, including required reason, evidence, approval, and effect on attendance and payroll.

## HHR-LEV-009 — Cancellation and Modification

Define rules for cancellation or modification before leave starts, after it starts, and after it ends.

Recalculate reservations and balances through traceable transactions. Preserve the original request and approval history.

## HHR-LEV-010 — Approval Routing

Support configurable approval chains, manager approval, HR review, additional approval thresholds, time-bounded delegation, escalation, reassignment, and inactive approvers.

An absent or departed manager must not leave a request permanently pending.

## HHR-LEV-011 — Attendance Interaction

Approved leave affects only the applicable absence window. Attendance events occurring during approved leave must be flagged for review rather than silently discarded.

## HHR-LEV-012 — Sensitive Leave Information

Restrict medical documents and sensitive reasons. Managers should see only the information necessary to make an approval decision.

## HHR-LEV-013 — Notifications and Reports

Support employee balances, pending requests, team leave calendars, upcoming leave, expiring carryover, policy exceptions, and approval history.

Notifications must not expose sensitive medical or personal information.

## HHR-LEV-014 — Historical Balance Reconstruction

The system must be able to explain a balance at a past date, including the applicable policy version and every transaction that contributed to it.