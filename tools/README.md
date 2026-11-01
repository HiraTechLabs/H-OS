# Repository tools

Small, dependency-free Node scripts that keep the repository's own rules true. They run in CI
through `pnpm governance` and are safe to run locally.

| Command | Script | Enforces |
|---|---|---|
| `pnpm graph:generate` | `tools/graph/generate.mjs` | Writes the architecture graph (`GRAPH-001`, `DEC-0006`). |
| `pnpm graph:check` | `tools/graph/generate.mjs --check` | Fails when the committed graph is stale (`GRAPH-002`, `GRAPH-003`). |
| `pnpm principles:check` | `tools/principles/validate.mjs` | Rule grammar, tag vocabulary, override/relaxation targets, decision front matter (`DEC-002`, `DEC-006`, `DEC-0007`). |
| `pnpm arch:check` | `tools/arch/check.mjs` | Import boundaries and declared dependencies between workspace packages (`ARCH-001`, `ARCH-013`). |
| `pnpm governance` | all three checks | The CI gate. |

## Architecture graph

`tools/graph/generate.mjs` derives structure from the repository:

- packages from `pnpm-workspace.yaml`, dependencies from each `package.json`;
- owned tables from `<schema>Schema.table('name', ...)` declarations;
- events from `export const XEventType = { ... } as const` in `platform/contracts/src/events.ts`.

Descriptions, ownership labels and external systems are hand-written in
`.caliper/graph/overrides.json`; everything else is generated. Regenerate after adding a package,
table, event or dependency — CI fails otherwise.

Source parsing is intentionally narrow. If a table or event stops following the two conventions
above, the graph silently loses a node, so change the generator in the same pull request.

## Boundaries

`tools/arch/check.mjs` holds one table, `BOUNDARIES`, mapping each package to the workspace
packages it may import. The composition roots (`@h-os/api`, `@h-os/web`) may also import the app
packages they host. A new package must be added to that table or the check fails, which is
deliberate: a package without a declared boundary has no boundary.
