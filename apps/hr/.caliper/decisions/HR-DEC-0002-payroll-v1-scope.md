---
id: HR-DEC-0002
title: Ship a jurisdiction-neutral payroll engine and defer all statutory components
status: accepted
date: 2026-10-29
tags:
  - money
  - domain
  - audit
affects:
  - apps/hr/api/**
  - apps/hr/.caliper/04-compensation-payroll.md
relaxes: []
supersedes: null
---

# Context

The mission requires payroll, deductions and net payable amounts to be calculated inside H-HR,
while `HHR-DOM-009`, `HHR-PAY-014`, `BIZ-012` and the task brief forbid inventing tax, social
insurance, overtime premium, deduction-limit or leave-entitlement rules. No jurisdiction,
currency, payroll frequency, or statutory scheme appears anywhere in the repository. No approved
golden payroll cases exist (`HHR-TEST-006`).

This must be resolved before Phase Four, because the presence or absence of statutory lines changes
the payroll schema, the component catalog, the calculation pipeline and the payslip contract.

## Options considered

**A. Build the engine, ship zero statutory components, and make every component configuration.**
Payroll v1 computes gross-to-net from configured earnings and deductions only. Statutory rules are
added later behind a versioned rule set with approved sources and golden cases.

**B. Wait for the jurisdiction before writing any payroll code.** Rejected: blocks the whole of
Phase Four behind an external input, and delays the parts that are jurisdiction-independent
(periods, cut-off, snapshots, determinism, finalization, reversal, payslips, finance hand-off).

**C. Ship placeholder tax/social-insurance percentages so screens look complete.** Rejected
outright: violates `HHR-DOM-009`, `HHR-PAY-014` and the brief, and would produce plausible-looking
wrong money.

**D. Use an external payroll-rules engine.** Rejected for v1: a new dependency category and a new
data-ownership question, with no approved need (`STK-001`, `CORE-012`).

## Decision

Adopt **A**.

**In scope for v1**

- `payroll_period` with configurable `cut_off_at`; `payroll_run` with the `HHR-PAY-006` state
  machine: `draft → calculating → calculated → under_review → approved → finalized`, plus
  `validation_failed`, `posted_to_finance`, `partially_integrated`, `reversed`, `cancelled`.
- Deterministic calculation: identical inputs, `calculation_version` and `rule_set_version` produce
  an identical `result_hash`.
- Input snapshot per employee (attendance summary, leave summary, approved overtime, effective
  compensation rows, deductions) frozen at calculation time (`HHR-PAY-005`).
- Earnings from the configurable catalog: basic, fixed allowances, variable allowances, bonuses,
  commissions, **approved** overtime.
- Deductions: unpaid-leave and approved-absence adjustments, recurring deductions, one-time
  deductions. Each deduction declares precedence, optional cap and rounding.
- Every `payslip_line` stores quantity, rate, amount, `rule_version` and a human-readable
  `explanation` so gross → each deduction → net is answerable (`HHR-PAY-005`).
- Finalization locks the run; corrections are new adjustment/reversal documents linked to the
  original line (`HHR-PAY-009`). No update path to a finalized row.
- Negative net pay is **reported**, never clamped to zero (`HHR-PAY-008`).
- Finance hand-off through the outbox as `hr.payroll.finalized.v1`, with delivery tracking and
  idempotency; H-Finance stays the ledger owner (`HHR-PAY-011`, `HHR-INT-007`).

**Explicitly out of scope until separately approved**

| Component | Requires |
|---|---|
| Income tax / withholding | jurisdiction, brackets, exemptions, effective date, rounding, golden cases |
| Social insurance (employee/employer) | scheme, caps, bases, effective date, golden cases |
| Statutory deduction limits and protections | law text, cap semantics, precedence |
| Overtime premium multipliers | approved policy per day type, golden cases |
| End-of-service / gratuity | jurisdiction formula, service rules |
| Advances and loans | confirmed business scope, instalment and cap rules |
| Multi-currency payroll | approved requirement |
| Bank file / WPS export format | approved bank or regulator specification |

The `pay_component.category` enum reserves `statutory` so the schema does not need restructuring
later, but no statutory component may be **created** without an approved rule set; the domain
rejects `category = 'statutory'` rows whose `rule_set_version` is not approved.

**Currency.** Payroll currency is organization configuration; the concrete value is still awaiting
approval and is recorded by the first approved payroll golden case.

## Consequences

- Phase Four can proceed and be fully verified without a legal answer, and no number is invented.
- Payslips in v1 are honest: they show exactly the configured earnings and deductions and nothing
  that pretends to be a tax calculation.
- Adding statutory rules later is additive (a new rule-set version + new components), not a schema
  migration, because the component catalog and the snapshot are already generic.
- `HHR-PAY-014` is satisfiable: production statutory behaviour is blocked by an explicit guard, not
  by a promise.

## Rules affected

- `HHR-DOM-009`, `HHR-PAY-014` — no jurisdiction-specific rule is encoded.
- `BIZ-012` — every rule is named and traceable to its source; the v1 sources are configuration.
- `CORE-005`, `HHR-PAY-013` — decimal-safe, single rounding point (see `DEC-0005`).
- `HHR-PAY-006`, `HHR-PAY-009` — finalization and reversal semantics fixed here.
- `HHR-PAY-010` — separation of duties enforced by the workflow engine (`DEC-0003`).
