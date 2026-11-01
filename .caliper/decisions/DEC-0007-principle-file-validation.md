---
id: DEC-0007
title: Validate principle and decision files mechanically in the repository
status: accepted
date: 2026-10-29
tags:
  - decision
  - infra
affects:
  - tools/principles/**
  - .caliper/**
  - apps/hr/.caliper/**
  - .github/workflows/**
relaxes: []
supersedes: null
review_by: ''
---

# Context

`.caliper/principles/README.md` defines a machine grammar for rules
(`### <ID> [<level>|<enforce>] <tags>`) and states that the resolver ignores anything it cannot
parse. A rule with a typo therefore disappears silently: no error, no test, no signal. The same
applies to decision front matter (`DEC-002`), to `relaxes` pointing at a non-existent rule
(`DEC-006`), and to a tag outside the fixed vocabulary.

The repository has no Caliper binary to perform these checks, and CI is the only place where every
contributor's change passes.

## Options considered

**A. Review-only.** Rejected: `README.md` already says to minimise `review`-enforced rules because
review misses mechanical errors, and a dropped rule is invisible in a diff.

**B. Adopt the Caliper CLI as a build dependency.** Not available in this repository, and the
bootstrap decision set does not authorise a new toolchain dependency (`DEC-001`).

**C. A dependency-free validator in `tools/principles/validate.mjs`.** It parses the same files the
resolver will read and fails on anything the grammar forbids, plus the decision front matter
contract.

## Decision

Adopt **C**. `pnpm governance` runs the validator, and CI runs `pnpm governance`.

The validator enforces:

1. Rule headings match the grammar; the id is `<DOMAIN>-<NNN>`; ids are unique across parent and
   app principle sets.
2. `level` is `must` or `should`; `enforcement` is one of `lint`, `arch-test`, `test`, `ci`,
   `review`.
3. Every tag belongs to the fixed vocabulary; a new tag fails until a Decision adds it.
4. `overrides:` and `relaxes:` name a declared rule; `relaxes:` is followed by `decision: DEC-NNNN`.
5. Decision front matter carries `id`, `title`, `status`, `date`, `tags`, `affects`, `relaxes` and
   `supersedes`; the id matches the file name; ids are unique; `status` is a known value.
6. A decision that relaxes a rule has a `review_by` date (`DEC-006`); a `superseded` decision names
   its successor.

## Consequences

- A malformed rule, an unknown tag or an unbacked relaxation fails the build instead of vanishing.
- The validator is the authority until the Caliper resolver exists. It must accept exactly what the
  resolver accepts; when the resolver lands, its grammar wins and this script becomes a fast local
  pre-check rather than the source of truth.
- Adding a tag costs one Decision, which is the intent of `README.md`.
- The validator does not judge rule quality, only shape. `DEC-005` and Review remain responsible for
  whether a rule is worth having.

## Rules affected

- `DEC-002` — front matter contract checked.
- `DEC-006` — relaxation without an accepted, dated decision fails.
- `.caliper/principles/README.md` — the grammar and the tag vocabulary gain an executable check.
