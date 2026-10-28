# H-HR Testing and Performance

## HHR-TEST-001 — Domain Testing

Test employee lifecycle transitions, effective-dated assignments, leave accrual and ledger calculations, schedules, attendance exceptions, payroll formulas, rounding, deductions, finalization, and retroactive corrections.

## HHR-TEST-002 — Edge Cases

Include tests for overlapping and concurrent leave requests, duplicate attendance events, overnight shifts, missing punches, future-dated and retroactive salary changes, closed payroll periods, negative net pay, and failed integrations.

## HHR-TEST-003 — Authorization Tests

Test HR, manager, employee, payroll, auditor, and unauthorized access scenarios. Include attempts by employee A to read or modify employee B's information.

## HHR-TEST-004 — Integration Tests

Test contract compatibility, duplicate delivery, retries, partial failure, idempotency, and reconciliation.

## HHR-TEST-005 — UI Tests

Test Arabic RTL, English LTR, desktop/tablet/phone layouts, employee self-service, leave requests, attendance corrections, approval routing, and error states.

## HHR-TEST-006 — Payroll Golden Cases

Maintain approved, non-sensitive payroll examples with expected earnings, deductions, rounding, and net results. Formula changes require reviewed expected results.

## HHR-PERF-001 — Bounded Data Access

Paginate large employee lists and histories. Avoid N+1 queries, unbounded exports, and fetching sensitive fields when they are not needed or authorized.

## HHR-PERF-002 — Measurable Performance

Define performance targets using the existing H-OS performance policy and actual application stack. Measure employee search/list, profile loading, leave calendars, attendance calculations, payroll calculations, and history views with representative data.

## HHR-PERF-003 — Payroll Correctness

Payroll calculations must be deterministic and reproducible. Optimization must preserve exact monetary arithmetic and auditability.

## HHR-PERF-004 — Large Visualizations

Organization charts, calendars, and long timelines must remain usable with realistic data. Use filtering, pagination, virtualization, or progressive loading when measurements justify them.