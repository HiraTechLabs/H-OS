---
id: HR-DEC-0001
title: Model employment as episodes on one permanent employee identity, with an explicit lifecycle state machine
status: accepted
date: 2026-10-29
tags:
  - domain
  - db
  - org-tree
affects:
  - apps/hr/api/**
  - apps/hr/.caliper/01-employee-records.md
relaxes: []
supersedes: null
---

# Context

`HHR-DOM-001` requires an immutable internal Employee ID. `HHR-DOM-003` requires defined lifecycle
states and transitions but declares its list a *"candidate"* set that must be settled in an approved
domain decision. `HHR-WF-005` requires rehire to work *"without accidentally duplicating the
employee or erasing prior employment history"* and explicitly defers *"employment-episode
behavior"* to an approved domain decision. `HHR-DOM-002` separates employee from login account.

Three facts are therefore unmodelled and block the Phase One schema: what a rehire is, which
statuses exist, and what may follow what.

## Options considered

**A. One `employee` row for life; each tenure is an `employment_episode`.** Rehire appends a new
episode to the same employee.

**B. One `employee` row per tenure** (a "rehired employee" is a new employee with the same national
ID). Rejected: breaks the stable internal ID, splits the person's history, and makes leave/payroll
continuity across service dates incoherent.

**C. Single employment record mutated on rehire.** Rejected: overwrites history, which `BIZ-003`
and `HHR-DOM-004` forbid.

## Decision

Adopt **A**.

**Identity.** `employee.id` (uuid) is the permanent internal identity and is never reissued.
`employee.employee_number` is a business-facing sequence value, unique per organization and
immutable; it is **not** the primary key. National ID, email, phone and username are attributes,
never identifiers. An employee may exist with no account and with no manager
(`HHR-DOM-002`, `HHR-ORG-002`).

**Episodes.** `employment_episode` carries `episode_no`, `employment_type`, `start_date`,
`end_date`, `probation_end_date`, `end_reason`. Exactly one episode may be open per employee
(`EXCLUDE (employee_id =) WHERE end_date IS NULL`). Rehire creates episode *n+1* with a new
`start_date` after the previous `end_date`; prior episodes, contracts, assignments, payslips and
leave ledger entries are untouched.

**Lifecycle state machine** (`employee_status_transition`, append-only):

| State | Meaning | Allowed next |
|---|---|---|
| `pending_start` | hired, start date not reached | `active`, `cancelled` |
| `active` | serving | `probation`, `suspended`, `notice_period`, `terminated` |
| `probation` | serving, in probation window | `active`, `notice_period`, `terminated` |
| `suspended` | employed, not serving | `active`, `notice_period`, `terminated` |
| `notice_period` | serving notice | `terminated`, `active` (notice withdrawn) |
| `terminated` | employment ended | `pending_start` (rehire, new episode only) |
| `retired` | ended by retirement | `pending_start` (rehire, new episode only) |
| `cancelled` | offer withdrawn before start | `pending_start` (new episode only) |

Every transition records `from`, `to`, `effective_at`, `recorded_at`, `actor_id`, `reason` and an
optional `approval_ref`. `terminated` is terminal **for the episode**, not for the employee;
re-entering it without a new episode is rejected by the domain, not just by the UI.

**Deferred, not invented:** `inactive` is *not* introduced as a state. If operations need a
"temporarily not working" concept it is `suspended` with a reason, because `HHR-DOM-009` forbids
attaching legal meaning to a state without an approved rule.

## Consequences

- Rehire is a first-class, testable operation with no duplicate person and no history loss.
- Payroll and leave can compute "service start" per episode (`min(episode.start_date)` for
  continuity) and "service in current episode", each explicitly.
- The exclusion constraint makes a second open episode impossible at the database level, not only
  in code.
- `inactive` and any statutory leave status remain undefined on purpose, pending jurisdiction
  approval.

## Rules affected

- `HHR-DOM-001`, `HHR-DOM-003`, `HHR-WF-005` — now decide rather than defer.
- `BIZ-003` — episodes are effective-dated and never overwritten.
- `HHR-DOM-002` — employee/account separation preserved structurally.
- `BIZ-015` — H-HR remains the single owner of employment state.
