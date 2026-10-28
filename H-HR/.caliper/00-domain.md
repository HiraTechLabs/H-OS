# H-HR Domain Principles

## HHR-DOM-001 — Stable Employee Identity

Every employee must have an immutable internal Employee ID. National ID, email, phone number, and login username must not serve as the primary internal identifier.

## HHR-DOM-002 — Employee and Account Separation

An employee record is distinct from a login account. An employee may exist without an account, and an account may exist without representing an employee.

## HHR-DOM-003 — Controlled Employment Lifecycle

Employment status must use defined states and permitted transitions. Candidate states include pending start, active, probation, suspended where applicable, notice period, terminated, retired, and inactive. Final states and transitions must be recorded in an approved domain decision.

## HHR-DOM-004 — Historical Accuracy

Employment, salary, department, branch, location, manager, job title, work schedule, and cost-center assignments must preserve historical values.

Every important change must record:

- Previous and new values.
- Effective date.
- Recorded or approval timestamp.
- Actor.
- Reason.
- Approval reference when applicable.

## HHR-DOM-005 — Effective Dating

Distinguish the date a change becomes effective from the date the system records or approves it. Support future-dated changes and controlled retroactive corrections.

## HHR-DOM-006 — Preserve Business History

Do not silently delete approved employment, attendance, leave, compensation, payroll, or approval records. Use traceable cancellation, reversal, supersession, or correction workflows.

## HHR-DOM-007 — Configurable Policies

Leave rules, schedules, overtime, payroll components, deduction rules, approval chains, and notification policies should be configurable where practical.

Policies must support versioning and effective dates when changing them could affect historical calculations.

## HHR-DOM-008 — Separate Facts from Decisions

Keep raw attendance events separate from reviewed corrections, approved overtime, payroll inputs, calculated payroll, and finalized payroll.

A raw attendance event must never directly cause an unreviewed financial deduction.

## HHR-DOM-009 — No Invented Legal Rules

Do not assume any country's tax, social insurance, leave entitlement, overtime premium, deduction limit, or payroll calendar. Production formulas require approved rules, effective dates, and test cases.

## HHR-DOM-010 — Single Source of Truth

Every business entity must have one authoritative owning application. Other applications use stable IDs, published APIs/events, or controlled projections instead of independently editing duplicated authoritative data.

## HHR-DOM-011 — Integration Boundaries

H-HR must not read or write private tables belonging to another H-OS application. Integrations must use approved contracts.

## HHR-DOM-012 — Employee Self-Service

Employees may view their own permitted information and submit requests. Changes to protected fields must follow the required review and approval process rather than overwriting authoritative data directly.

## HHR-DOM-013 — Manager Scope

Managers may access only employees and fields within their authorized scope. An employee may have no direct manager; the system must not invent one.

## HHR-DOM-014 — Correctness Before Convenience

When usability conflicts with payroll correctness, historical accuracy, privacy, or authorization, preserve correctness and provide a clear explanation to the user.