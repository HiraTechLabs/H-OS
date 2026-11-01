---
id: DEC-0005
title: Store money as fixed-precision decimals with an explicit rounding policy
status: proposed
date: 2026-10-29
tags:
  - money
  - db
  - domain
affects:
  - apps/hr/**
  - platform/contracts/**
  - .caliper/principles/business.md
relaxes: []
supersedes: null
---

# Context

`BIZ-002` allows either integer minor units or fixed-precision decimals, always with a currency
code. `HHR-PAY-013` requires decimal-safe arithmetic, explicit currency precision and an approved
rounding policy, and forbids binary floating point. `CORE-005` repeats the ban.

The repository never states the currency, the payroll frequency, or where rounding happens. All
three are schema-visible: a salary column typed `numeric(18,4)` cannot later become `bigint` minor
units without a data migration across every payroll table.

## Options considered

**A. `numeric(18,4)` in PostgreSQL, carried as `Decimal` in TypeScript** (a fixed-precision decimal
type at the application boundary), currency code on every monetary row, explicit rounding at
defined boundaries.

**B. `bigint` minor units** (e.g. fils/piastres). Rejected: exact for a single currency, but
percentage-of-basic allowances and proration produce sub-minor-unit intermediates that must be
rounded per step, which multiplies rounding decision points and makes explanations harder to
justify to an employee. It also makes a future currency-with-3-decimals change a data migration.

**C. PostgreSQL `money` type.** Rejected: locale-dependent parsing and display, not
fixed-precision by specification, and widely discouraged.

**D. `float8`/`number`.** Forbidden by `CORE-005`.

## Decision

Adopt **A**.

1. PostgreSQL type `numeric(18,4)` for amounts and rates; `numeric(10,4)` for quantities
   (leave days/hours, overtime hours).
2. TypeScript never uses `number` for money. A `Money` value object wraps a decimal string plus a
   currency code; arithmetic goes through `decimal.js` (already the de-facto choice for
   Drizzle + TS decimals) and is confined to the domain layer.
3. Rounding is half-up to the currency's minor-unit precision, applied **once**, at the boundary
   where a value becomes a payable amount (a payslip line or a payslip total). Intermediate
   calculations keep four decimals. The rounding method and the precision live in one domain
   constant and are recorded on every `payslip_line` as `rounding`.
4. Every monetary row carries `currency` (ISO 4217). Currency is **not** hardcoded; the
   organization's payroll currency is configuration, defaulted to the single company currency
   once approved.
5. Persistence speaks decimal strings, never JS numbers, so no value passes through binary floating
   point in the ORM or the JSON boundary.

## Consequences

- Exact arithmetic end to end, with a single, auditable rounding point.
- A dependency is added to the backend (`decimal.js`) and to the DB layer (`pg` numeric handling).
  Justification: TypeScript has no native decimal type, and hand-rolled fixed-point arithmetic is
  more error-prone than a maintained library (`CODE-010`).
- `numeric(18,4)` supports a very large payroll; the four-decimal scale absorbs percentage
  intermediates without intermediate rounding.
- The **currency itself remains unapproved**. Until the payroll Decision names it, the system runs
  with a configured currency and no statutory components.

## Rules affected

- `BIZ-002` — representation chosen and documented.
- `CORE-005`, `HHR-PAY-013` — decimal-safe enforcement point defined.
- `BIZ-012` — the rounding rule becomes a named, tested domain rule.
- `ARCH-012` — `Money` becomes a value object with invariants in its constructor.
