---
id: DEC-0004
title: Approve the H-OS design tokens, shell baseline and accessibility target
status: accepted
date: 2026-10-29
tags:
  - ui
  - a11y
  - i18n
affects:
  - platform/web/**
  - packages/ui/**
  - .caliper/principles/ui-ux.md
relaxes: []
supersedes: null
---

# Context

`UX-005` forbids hardcoded colors, spacing, fonts and shadows and names `@h-os/ui` as the only
component source. `UX-014` proposes a palette (Deep Navy `#172554`, Teal `#0D9488`, background
`#F8FAFC`, text `#334155`, warning `#D97706`) but states plainly that it *"is a proposal for
evaluation and documentation only and does not constitute an approved architectural decision"*, and
requires semantic success/warning/error/info colors to be defined separately with contrast
validated. `STK-011` blocks any visualization library until a Decision records need, alternatives,
accessibility impact and maintenance cost.

Nothing can be rendered — not even a login page — until tokens are approved. This is therefore a
hard prerequisite for any H-HR screen.

## Options considered

**A. Approve the proposed palette as the v1 light-mode baseline**, add validated semantic tokens,
and record the dark-mode path as documented-but-out-of-scope.

**B. Commission a full brand and design-system exercise first.** Rejected for v1: it delays every
phase behind work that produces no verifiable HR behaviour, and the proposal already covers the
required roles.

**C. Let each app pick tokens.** Rejected: violates `UX-005` and `UX-001` (one design language).

## Decision

Adopt **A**:

1. `@h-os/ui` exposes Tailwind theme tokens only: color (surface, on-surface, primary, accent,
   plus semantic success/warning/error/info), spacing scale, radius, typography, elevation,
   focus-ring and motion duration. No component may use a raw hex, `px`-literal color, or
   `left`/`right` (`UX-006`).
2. Primary `#172554`, accent `#0D9488`, background `#F8FAFC`, body text `#334155`,
   warning `#D97706` are adopted as the baseline palette. Semantic success/error/info values are
   chosen and contrast-validated to WCAG 2.2 AA against their intended backgrounds **before** the
   tokens are merged, and the validated pairs are recorded in the package README.
3. Light mode is the shipped baseline; dark mode is documented as a token-mapping exercise and is
   not implemented in v1.
4. Accessibility target is WCAG 2.2 AA (`UX-007`), enforced by axe in CI (`TEST-012`), with
   reduced-motion respected by every transition (`UX-012`, `UX-015`), and motion under 200 ms.
5. Charts: **no charting library is approved.** H-HR v1 uses tables, calendar grids, timeline
   lists and `ltree`-backed hierarchy views built from design-system primitives, each with a
   textual or tabular alternative (`HHR-UX-009`). A charting Decision is raised only when a
   concrete approved requirement cannot be met without one.

## Consequences

- Every app inherits one validated token set; H-HR gets a lawful starting point for its screens.
- Semantic colors are constrained to contrast-checked pairs, so "warning orange on white" cannot
  drift into an inaccessible tint.
- No visualization dependency enters the lockfile, keeping `STK-011` satisfied and the app chunk
  within the 200 KB budget (`PERF-007`).
- Dark mode remains a documented path; adding it later is a token remap, not a rewrite.

## Rules affected

- `UX-005` — tokens now have approved values.
- `UX-014` — the palette moves from proposal to approved baseline; the accessibility requirements of
  that rule become enforceable.
- `STK-011` — no visualization library is added; the four required considerations are recorded here
  for the deferred case.
- `UX-007`, `UX-012`, `TEST-012`, `HR-UX-013` — target and enforcement stated.
