---
id: DEC-0003
title: Define the v1 platform kernel surface, including the workflow engine
status: accepted
date: 2026-10-29
tags:
  - auth
  - permissions
  - events
  - audit
  - infra
affects:
  - platform/api/**
  - platform/contracts/**
  - .caliper/principles/clean-architecture.md
relaxes:
  - ARCH-013
supersedes: null
review_by: 2027-10-29
---

# Context

H-HR is required by principle to reuse platform capabilities that do not exist yet: identity,
authorization, audit, events, entity links, notifications, and approvals. `ARCH-013` restricts the
kernel to *"identity, org-scope, events, audit, links, notifications"*. `BIZ-007` requires that
*"approvals run on the platform workflow engine"*, and `HHR-WF-001/002/004`, `HHR-LEV-010`,
`HHR-ATT-007` and `HHR-PAY-010` all depend on approvals, delegation, escalation and
separation of duties.

Two rules therefore cannot both hold: either approvals belong to the kernel (extending the
`ARCH-013` list) or every app builds its own approval engine (which the same rules forbid).

## Options considered

**A. Extend the kernel with a minimal workflow engine** (definitions, instances, tasks, delegation)
plus permissions/RBAC. The kernel exposes interfaces; apps declare approval chains and subscribe to
task outcomes.

**B. Put a workflow engine in each app.** Rejected: duplicates approval semantics, violates
`BIZ-007` and `CORE-013`, and makes cross-app escalation consistent only by accident.

**C. Put the workflow engine in a fourth application (`H-Workflow`).** Rejected for v1: it is a
new app whose only consumer would be the kernel, and it buys distribution the modular monolith
does not need (`STK-010`).

**D. Defer approvals; implement leave/attendance without them.** Rejected: `HHR-LEV-010` requires a
request not to be permanently pending, so approvals are on the critical path of Phase Two.

## Decision

Adopt **A**, scoped tightly to what H-HR needs:

- `AuthProvider` interface with a local argon2id implementation (`SEC-006`), sessions with
  rotation, deny-by-default global auth guard (`SEC-001`).
- RBAC: `account`, `role`, `permission`, `role_permission`, `account_role`.
- `OrgScopeResolver` **interface owned by the kernel and implemented by H-HR infrastructure**, so
  the platform never reads `hr` tables while `BIZ-006` still makes the org tree the backbone of
  scope. Scope values: `own`, `subtree`, `unit`, `all` (`SEC-003`).
- Audit recorder: append-only, actor/request-id/before/after, redaction-aware (`SEC-007`, `LOG-006`).
- Transactional outbox with in-process dispatch, versioned event schemas in `platform/contracts`
  (`ARCH-007`).
- Entity links: typed references `{app, type, id}` (`BIZ-011`, `ARCH-014`).
- Notifications: link-to-authority only, never the state holder (`HHR-WF-003`).
- Workflow: `workflow_definition`, `workflow_instance`, `workflow_task`,
  `approval_delegation`. No scripting language, no BPMN. Transitions are declared data; the engine
  enforces separation of duties and delegation windows, and records every decision.

Explicitly **out** of the kernel: payroll rules, leave accrual, attendance calculation, any HR
entity (`ARCH-013` spirit, `CORE-012`).

## Consequences

- `ARCH-013`'s list grows by two items (permissions, workflow). This relaxation is recorded here
  and must be re-reviewed by 2027-10-29.
- The kernel stays a library inside `platform/api`; it remains one deployable.
- H-HR can implement approvals without inventing its own engine, and H-Asset/H-Finance can reuse
  the same tasks later.
- `OrgScopeResolver` as an app-implemented interface is the one deliberate inversion in the
  kernel; it keeps the dependency direction clean while honouring `BIZ-006`.
- A future extraction into a separate workflow service stays possible because only interfaces are
  used.

## Rules affected

- `ARCH-013` — **relaxed**: kernel surface extended with permissions and workflow.
- `BIZ-007` — satisfied: approvals, delegation windows and no-self-approval live in one engine.
- `SEC-001`, `SEC-002`, `SEC-003`, `SEC-007` — enabled by the kernel.
- `ARCH-007`, `ARCH-009` — outbox and interface-based DI unchanged.
- `CORE-013` — no app gains a private approval implementation.
