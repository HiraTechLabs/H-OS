---
id: DEC-0008
title: Re-evaluate the H-OS backend runtime and framework
status: proposed
date: 2026-11-02
tags:
  - decision
  - api
  - db
  - perf
  - infra
  - deps
  - docs
affects:
  - .caliper/principles/tech-stack.md
  - .caliper/principles/README.md
  - .caliper/principles/README.ar.md
  - .caliper/graph/overrides.json
  - platform/api/**
  - platform/kernel/**
  - apps/**
  - docs/tech-evaluation/**
relaxes: []
supersedes: null
---

# Context

`DEC-0001` accepted NestJS on TypeScript on 2026-10-29, before any backend code existed. H-HR
Phase One was then built on it: 73 backend source files, 7,214 lines, 44 files importing
`@nestjs/*`, five controllers, 17 use cases and 30 tables. The decision is no longer accepted as
final. The concern is not that NestJS performs badly today; it is that the long-term workload of a
multi-application business platform (payroll runs, analytical reporting, exports, large
transactional imports) is CPU-bound work on a single-threaded runtime, and that this cost grows
with every app added to the same deployable.

The repository has no review status for decisions. `DEC-002` allows only `proposed`, `accepted`,
`superseded` and `rejected`; `DEC-003` forbids editing an accepted decision except for its status;
`DEC-001` requires a Decision before any tech-stack change.

# Options considered

**A. Status-only downgrade of `DEC-0001` plus this new `proposed` Decision.** `DEC-0001` keeps its
original text, context, options and consequences; only its front-matter `status` changes from
`accepted` to `proposed`. This Decision records why, names the candidates and the evidence required
before anything is replaced. No candidate is approved and the stack table is not changed.

**B. Invent a `reopened` or `under review` status.** Rejected: `DEC-002` defines the vocabulary and
`tools/principles/validate.mjs` enforces it, so a fifth status is a governance change of its own,
with a resolver impact, for a distinction `proposed` already expresses. If a dedicated review status
is wanted, it needs its own Decision and validator change first.

**C. Mark `DEC-0001` `superseded` by this Decision.** Rejected: `superseded` asserts that a
successor is in force, and the validator requires the superseded decision to name its successor.
Nothing is in force yet, and the current implementation would be left without an operative record.

**D. Leave `DEC-0001` accepted and evaluate quietly.** Rejected by the project owner's instruction:
the decision is explicitly not final, and an accepted decision that is being questioned misleads the
resolver, which returns accepted decisions to every task brief.

# Decision

Adopt **A**.

1. `DEC-0001` is now `proposed` and is the *implemented baseline*, not an approved destination. Its
   original reasoning is preserved unchanged (`DEC-003`).
2. This Decision is `proposed`. It compares Go, C# + ASP.NET Core, Java + Spring Boot and NestJS
   (baseline) against H-OS requirements; the full evaluation is
   `docs/tech-evaluation/2026-11-02-backend-technology-reevaluation.md`.
3. **No backend technology is approved.** Until a replacement Decision is `accepted`, the existing
   NestJS application remains the reference implementation, new backend work follows the committed
   stack (`STK-001`), and no second backend stack may be introduced (`STK-012`).
4. Acceptance requires the comparative benchmark in the evaluation document (or a documented,
   owner-approved reason to skip it) plus a migration plan that preserves the kernel surface,
   contracts, event catalogue and audit guarantees.
5. On acceptance, this Decision supersedes `DEC-0001` and that status changes in the same pull
   request.

# Consequences

- The backend question is visibly open in the principles, the graph and the decision log, without
  rewriting history.
- The resolver no longer returns `DEC-0001` as an accepted decision. `STK-001`, `STK-012` and
  `tech-stack.md` carry the operative rule, so implementers still see the committed stack.
- The measured NestJS baseline (throughput, latency, memory, start-up) is recorded, so the next
  decision is argued against evidence rather than reputation.
- No application code, migration, dependency or container changes in this Decision.
- `DEC-0003` (kernel surface), `DEC-0005` (money) and the frontend stack are unaffected. A backend
  language change would require re-validating `DEC-0005`, because the chosen decimal representation
  is carried by TypeScript today.

# Rules affected

- `STK-001` — the stack is still committed; this Decision records that one row is under review.
- `STK-002` — the runtime version pin is now provisional until the replacement is accepted.
- `STK-007` — OpenAPI 3.1 from code is currently unmet (no document is generated or committed); it
  becomes an acceptance criterion for whichever candidate wins.
- `STK-012` — new: no second backend stack and no candidate adoption before this Decision is accepted.
- `DEC-001`, `DEC-002`, `DEC-003` — the lifecycle constraint and the status-only edit are recorded
  here; no rule is relaxed.

## Open questions for the project owner

1. Is the target deployment one container per customer, or a managed multi-tenant deployment? The
   answer changes the memory-per-instance weighting.
2. What is the expected peak payroll size and reporting window in the first two years?
3. May a 2–3 week spike per shortlisted candidate run before `COS` starts, or is the answer required
   before the leave engine?
4. Is a non-TypeScript backend team realistic to hire or train, or is the single-language monorepo a
   fixed constraint?
