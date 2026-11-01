# Access and Integration Principles

## HHR-INT-001 — Integration-First Design

Design H-HR to integrate with H-OS and other applications through explicit contracts while remaining usable before all downstream applications are complete.

Never simulate an integration success that did not occur.

## HHR-INT-002 — Published Contracts Only

Use approved APIs, events, or integration contracts. Never access another application's private tables or internal domain classes directly.

## HHR-INT-003 — Identity and Permissions

H-HR provides approved employee and organizational information to the identity/access layer when required. The identity/access layer owns authentication and final authorization.

Department, manager, and job title alone must not grant broad permissions without an explicit policy.

## HHR-INT-004 — Joiner, Mover, Leaver

Support auditable workflows for:

- New employee onboarding.
- Account provisioning.
- Department or manager changes.
- Branch or location transfers.
- Temporary assignments.
- Suspension.
- Termination.
- Rehire.
- Account revocation failures.

Track the status of each downstream action.

## HHR-INT-005 — H-Archive

H-Archive owns archived files and document versions. H-HR maintains the approved employee-document references and HR-specific classification.

## HHR-INT-006 — H-Asset

H-Asset owns asset inventory and asset movements. H-HR may display linked assets and custody status and coordinate onboarding/offboarding checklists through approved contracts.

## HHR-INT-007 — H-Finance

H-Finance owns accounting entries and ledger postings. H-HR owns payroll calculations and payroll source records within the approved scope.

## HHR-INT-008 — Reliable Integration

Where asynchronous delivery is used, support durable delivery where appropriate, idempotent processing, bounded retries, safe failure visibility, and reconciliation.

Do not claim cross-application atomicity unless it is actually implemented.

## HHR-INT-009 — Partial Failure

If one HR operation triggers several downstream actions, clearly show which succeeded, failed, or remain pending.

A failure in a downstream application must not be hidden or represented as success.

## HHR-INT-010 — Integration Observability

Track correlation ID, operation status, timestamps, attempts, safe error summaries, and retry/reconciliation actions.

Never log credentials, complete identity numbers, bank details, medical information, or full payroll payloads.