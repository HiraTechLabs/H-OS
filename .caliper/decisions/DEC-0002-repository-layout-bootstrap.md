---
id: DEC-0002
title: Fix the repository layout and bootstrap the pnpm monorepo at the git root
status: accepted
date: 2026-10-29
tags:
  - tech-stack
  - infra
  - graph
affects:
  - .caliper/principles/tech-stack.md
  - package.json
  - pnpm-workspace.yaml
  - platform/**
  - apps/**
relaxes: []
supersedes: null
---

# Context

`tech-stack.md` defines the monorepo layout with `platform/`, `apps/hr/`, `infra/`, `docs/` and
the parent `.caliper/` at the repository root. `graph.md` and `decisions.md` also assume
`.caliper/graph/` and `.caliper/decisions/` at the root. The H-HR principles assume
`apps/hr/.caliper/principles/`.

The actual working tree is:

```
H-OS/                <- git root, zero commits
├── H-OS/.caliper/   <- parent principles + DEC-0001
└── H-HR/.caliper/   <- H-HR principle deltas
```

The parent `.caliper/` is one level too deep, the H-HR deltas are not under `apps/hr/`, and there
is no workspace manifest. Paths are load-bearing here: the graph generator's output location, the
principle resolver's app path, the CI working directories and every import path all derive from
them. Picking one silently would bake a mistake into every later PR.

## Options considered

**A. Promote the existing nested `H-OS/` content to the git root, and keep H-HR deltas where they
are for now.** Move `H-OS/.caliper/` → `.caliper/`. Leave `H-HR/.caliper/` in place until
`apps/hr/` exists, then move it in the bootstrap PR.

**B. Keep the nesting and make `H-OS/` the workspace root** (i.e. `H-OS/H-OS/package.json`).
Rejected: the git root and the workspace root would differ, so every CI action, Docker build
context and editor root needs a `cd`, and `.caliper/` would still not be where its own rules say.

**C. Delete `H-HR/` and rewrite the principles into `apps/hr/.caliper/principles/` immediately.**
Rejected for this PR: it mixes a content migration with a structure change and makes review of the
principle text impossible (`GIT-004`, one change one purpose).

**D. Leave the layout alone and configure the tooling around it.** Rejected: it contradicts
`tech-stack.md` and `graph.md`, and would need a Decision every time someone reads the docs.

## Decision

Adopt **A**.

1. Repository root becomes the monorepo root: `package.json`, `pnpm-workspace.yaml`, `turbo.json`,
   `tsconfig.base.json`, `.caliper/`, `platform/`, `apps/`, `infra/`, `docs/`.
2. Move the current `H-OS/.caliper/` content to `.caliper/` (principles and `DEC-0001` preserved
   verbatim; only paths change).
3. H-HR deltas move to `apps/hr/.caliper/` in the same PR that first creates `apps/hr/`
   (plan row 4). Until then `H-HR/.caliper/` stays as the source of truth for those files.
4. `tech-stack.md` §"Repository layout" is updated to describe the final tree once step 3 lands.

## Consequences

- One root for git, pnpm, Turborepo, CI, Docker build context and the editor — no `cd` anywhere.
- `.caliper/` sits where `graph.md`, `decisions.md` and `README.md` already say it does.
- A short-lived period where `.caliper/principles` and `H-HR/.caliper` are not co-located; the
  resolver must be given an explicit app path during that window.
- History: the repository has no commits, so this is a file move with no rewrite risk.

## Rules affected

- `STK-001` (stack committed): layout clarified, no technology change.
- `STK-004` and `STK-010`: unaffected, but the workspace root is now unambiguous for Compose and CI.
- `GRAPH-001`, `GRAPH-002`: `.caliper/graph/` finally has a valid root.
- `CORE-011`: structural change, recorded here as required.
