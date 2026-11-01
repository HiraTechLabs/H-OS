# H-HR Security and Privacy

## HHR-SEC-001 — Least Privilege

Use deny-by-default authorization. Enforce permissions on the server for every sensitive read, update, export, and workflow action. Hiding a button is not security.

## HHR-SEC-002 — Field-Level Access

Control sensitive fields independently, including salary, bank/payment details, identity numbers, medical documents, disciplinary records, and confidential HR notes.

## HHR-SEC-003 — Employee and Organizational Scope

Enforce employee self-service scope, branch scope, department scope, and manager reporting scope on the server.

Test attempts to access another employee's data by changing an ID, URL, or API parameter.

## HHR-SEC-004 — Sensitive Exports

Bulk exports and reports require explicit permissions, minimum necessary fields, and audit records.

## HHR-SEC-005 — Audit Trail

Audit high-risk profile changes, permission changes, compensation changes, payroll actions, leave adjustments, attendance corrections, approvals, exports, and integration retries. Sensitive reads should be audited where required.

## HHR-SEC-006 — Safe Logging

Never log passwords, tokens, secret keys, complete identity numbers, bank details, medical information, or full payroll payloads.

## HHR-SEC-007 — Retention

Define retention, archival, legal hold, and deletion/anonymization rules by data category and applicable law. Do not retain sensitive information indefinitely by default.

## HHR-SEC-008 — Authentication

Use the existing H-OS identity/authentication architecture. Do not build a separate identity provider inside H-HR without an approved architecture decision.

## HHR-SEC-009 — High-Risk Actions

Apply appropriate confirmation, approval, or re-authentication for salary changes, payroll finalization, termination, bulk export, and permission changes according to the global security principles.