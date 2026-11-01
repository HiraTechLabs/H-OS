---
id: DEC-0006
title: Generate the architecture graph from the workspace instead of hand-maintaining it
status: accepted
date: 2026-10-29
tags:
  - graph
  - infra
  - docs
affects:
  - tools/graph/**
  - .caliper/graph/**
  - package.json
  - .github/workflows/**
relaxes: []
supersedes: null
review_by: ''
---

# Context

`GRAPH-001` requires a machine-readable `graph.json` with generated Mermaid views; `GRAPH-002`
requires structural facts to be generated from code and configuration and makes CI fail when the
committed graph differs; `GRAPH-003` requires the same pull request to update it.

None of that existed. Caliper's own graph command is not part of this repository, and a
hand-maintained graph would be stale after the first structural change, which is exactly the
failure mode `GRAPH-002` exists to prevent.

## Options considered

**A. Wait for the Caliper tool.** Rejected: bootstrap has no date for it, and every later app would
start with an absent or stale graph. A missing graph also breaks the resolver contract in
`.caliper/principles/README.md`, which returns graph neighbours with the task brief.

**B. Commit a hand-written `graph.json`.** Rejected: nothing computes it, so drift is silent and
CI can only diff against the same hand-written file.

**C. A dependency-free script in `tools/graph/generate.mjs`.** It reads `pnpm-workspace.yaml` for
the package set, each package's `package.json` for `@h-os` dependencies, the sources for
`<schema>Schema.table('name')` declarations, and `platform/contracts/src/events.ts` for the event
catalogue. Descriptions, ownership and external systems stay hand-written in
`.caliper/graph/overrides.json`, which is what `GRAPH-004` allows.

## Decision

Adopt **C**.

1. `pnpm graph` regenerates `.caliper/graph/graph.json` and `.caliper/graph/graph.md`. Both are
   committed and marked generated.
2. `pnpm governance` runs `generate.mjs --check` and fails when either file is stale, so a
   structural change without a regenerated graph cannot merge (`GRAPH-002`, `GRAPH-003`).
3. The generator rejects a `depends-on` edge between two apps that are not the platform owner:
   cross-app reach must go through `@h-os/contracts` (`GRAPH-006`). Today the check is vacuous
   because H-HR is the only app.
4. Source parsing is deliberately narrow and documented: tables must be declared as
   `<schema>Schema.table('name', ...)` and events as `export const XEventType = { ... } as const`.
   Changing either convention requires updating the generator in the same pull request.
5. `depends-on` edges come from runtime `dependencies` only; dev-only workspace links are not
   architectural dependencies.

## Consequences

- The graph cannot drift: CI compares regenerated output with the committed files.
- Additions are cheap: a new package, table or event appears without editing the graph.
- The generator is a heuristic reader of source text, not a TypeScript parser. A table declared
  through an alias or a computed name would be missed, so the conventions above are part of the
  build contract rather than a style preference.
- `subscribes` edges are not emitted: nothing consumes events yet. The generator gains them when
  the first consumer exists, before that consumer ships, not after.

## Rules affected

- `GRAPH-001` — `graph.json` plus generated Mermaid now exist.
- `GRAPH-002`, `GRAPH-003` — staleness is a CI failure.
- `GRAPH-004` — every node carries id, type, owner, path and owned data; edges carry a reason.
- `GRAPH-006` — app-to-app dependency edges are rejected by the generator.
