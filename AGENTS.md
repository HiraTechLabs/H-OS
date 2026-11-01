# AGENTS.md

Entry point for coding agents. The authoritative rules live in `.caliper/`; this file only records
what is true about **this** repository and the commands that actually work.

## Read order

1. `.caliper/principles/CORE.md` — the one-page digest.
2. The task brief the resolver builds from `.caliper/principles/*.md` plus `apps/*/.caliper/`.
3. `.caliper/decisions/` — filtered by `affects` and `tags`, not read in full.
4. `.caliper/graph/graph.md` — neighbours of the modules you are about to touch.

## Layout

```
platform/contracts   shared Zod schemas, permissions, event types (the only cross-app import)
platform/kernel      identity, sessions, authorization, audit, outbox, problem details
platform/api         composition root: one Nest application mounting every app module
platform/client      browser API client, session provider, permission helpers
platform/i18n        i18next instance and the shell catalog (en, ar)
platform/ui          design tokens and primitives (DEC-0004)
platform/web         the single web shell (DEC-0004)
apps/hr/api          H-HR backend module
apps/hr/web          H-HR screens
apps/hr/docs         H-HR specifications (ui-spec.md)
apps/hr/.caliper     H-HR rules and decisions
infra/compose        PostgreSQL for local development
tools/               graph generator, principle validator, architecture checker
```

## Commands

```bash
pnpm install
pnpm build          # tsc + vite, one chunk per screen
pnpm lint           # eslint per package
pnpm typecheck      # tsc --noEmit per package
pnpm test           # unit + HTTP integration (Testcontainers PostgreSQL)
pnpm governance     # graph freshness + principle/decision validity + import boundaries
pnpm verify         # lint, typecheck, test, build, governance
```

Local stack:

```bash
docker compose -f infra/compose/docker-compose.yml up -d   # PostgreSQL 16 on host port 5433
pnpm db:migrate
pnpm db:seed
pnpm --filter @h-os/api start      # http://localhost:3100
pnpm --filter @h-os/web dev        # http://localhost:5173, proxies /api to 3100
```

The API reads configuration from the environment (`.env.example` documents every key). It validates
at boot and fails fast rather than starting half-configured.

## Working agreements

- **Never report a command as passing unless it ran.** Quote the command and the real output.
- **No new dependency category without an accepted Decision** (`DEC-001`). The approved stack is in
  `.caliper/principles/tech-stack.md` and `DEC-0001`/`DEC-0004`.
- **Money is never floating point.** `DEC-0005` is still `proposed`; payroll work waits for it.
- **History is append-only.** Effective-dated rows are closed with a `validTo`, never updated in
  place. Audit rows are never edited.
- **Authorization is server-side.** Route guards and hidden buttons are convenience; every use case
  checks a permission and a data scope.
- **All copy goes through i18next**, `hr.` prefix for H-HR. English and Arabic catalogs must keep
  identical keys and placeholders; a parity test enforces it.
- **Logical CSS properties only** (`ms-`, `me-`, `ps-`, `pe-`, `border-s`, `start-`, `end-`).
- **Structure changes regenerate the graph** (`pnpm graph:generate`) and update the same commit.
- **Migrations are code.** Change the Drizzle schema, run `pnpm db:generate`, commit the SQL.
- **Secrets and PII never reach logs**, audit summaries, event payloads or test fixtures.

## Where to write

| Artefact | Location |
|---|---|
| Worklog per phase | `docs/worklogs/YYYY-MM-DD-<scope>.md` |
| Architecture decision | `.caliper/decisions/DEC-NNNN-<slug>.md` |
| App decision | `apps/<app>/.caliper/decisions/<APP>-DEC-NNNN-<slug>.md` |
| App rules | `apps/<app>/.caliper/principles/*.md` (H-HR's deltas are still prose specs in `apps/hr/.caliper/*.md`; move them under `principles/` when they become rule-grammar files) |
| UI specification | `apps/<app>/docs/ui-spec.md` |

Run `pnpm governance` before proposing a merge; it fails on a stale graph, a malformed rule, an
unknown tag, an unbacked rule relaxation, or an import that crosses a package boundary.
