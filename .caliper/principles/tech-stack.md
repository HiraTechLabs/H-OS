# Tech Stack Principles (STK)

The committed stack for H-OS. Caliper must not ask for a stack preset; this file is the preset. Deviation requires a Decision.

Status: the backend technology is **Go**, accepted in DEC-0009 superseding DEC-0001 and DEC-0008.

## Committed stack

| Area | Choice |
|---|---|
| Architecture | Modular monolith, one deployable, one PostgreSQL, one schema per app |
| Backend | Go (standard library net/http, pgx/v5) |
| ORM / migrations | SQL migrations, pgx/v5 |
| Database | PostgreSQL with extensions `ltree`, `btree_gist`, `pgcrypto` |
| API | REST, OpenAPI 3.1 generated from code, generated typed client, `/api/v1`, errors as RFC 9457 problem+json |
| Frontend | React, TypeScript strict, Vite, TanStack Router and Query, Zustand (UI state only), react-hook-form + zod |
| UI | Tailwind CSS + shadcn/ui (Radix) in one shared package `@h-os/ui`, i18next (en, ar), RTL from day one |
| Tables / grids | TanStack Table; a grid engine for spreadsheet-like screens is chosen by Decision when Rooms starts |
| Auth | Behind an `AuthProvider` interface; local provider first (argon2id), OIDC/Keycloak provider later |
| Events | Transactional outbox in PostgreSQL, in-process bus first, external broker later by Decision |
| Jobs / cache | Redis + BullMQ, introduced only when the first feature needs them (by Decision) |
| File storage | `FileStorage` interface; local disk in dev, S3-compatible in production |
| Observability | pino logs, OpenTelemetry, Prometheus, Grafana, Loki |
| Quality tooling | ESLint, Prettier, dependency-cruiser, knip, Vitest, Testcontainers, Playwright, axe |
| Monorepo | pnpm workspaces + Turborepo |
| Delivery | Docker, Docker Compose, GitHub Actions |
| AI | Provider-agnostic `AiProvider` interface, accessed only through H-AI |

## Repository layout

```
H-OS/
├── .caliper/
│   ├── principles/            parent principles (these files)
│   ├── decisions/             DEC-NNNN-*.md
│   └── graph/                 graph.json + generated views
├── backend/
│   ├── cmd/server/            backend entrypoint and composition root
│   └── internal/              platform kernel and apps modules
├── platform/
│   ├── api/                   host app, composition root, kernel (identity, org-scope, events, audit, links)
│   ├── web/                   H-OS shell (launcher, top bar, command palette, notifications)
│   └── contracts/             OpenAPI, event schemas, shared types
├── apps/
│   └── hr/
│       ├── .caliper/principles/   H-HR deltas only
│       ├── api/               backend module
│       └── web/               frontend module (lazy-loaded by the shell)
├── infra/                     compose files, images, later Helm
└── docs/                      human docs (en + ar), glossary
```

## Rules

### STK-001 [must|review] *
The stack above is committed. Adding or replacing any technology needs a Decision first.

### STK-002 [must|ci] deps, infra
Versions: use the current LTS of runtime and framework at project creation, record them in a Decision, pin exact versions in lockfiles, and upgrade in dedicated PRs.

### STK-003 [must|test] config
All runtime configuration comes from environment variables, validated by a schema at boot. The app fails fast on invalid or missing config. No config values hardcoded.

### STK-004 [must|ci] infra
The whole system starts locally with one command through Docker Compose. Images are multi-stage, run as non-root, and use pinned base images. Dev and prod use the same images.

### STK-005 [must|arch-test] auth, files, events, ai, infra
Auth provider, event bus, file storage, mail and AI provider are accessed only through interfaces defined in the platform kernel. Concrete implementations live in infrastructure and are swappable by configuration.

### STK-006 [must|review] db, migration
Each app owns one PostgreSQL schema. Migrations are SQL files committed with the code and reviewed. Use exclusion constraints (`btree_gist`) to forbid overlapping effective-dated rows, and `ltree` for tree structures.

### STK-007 [must|ci] api
The OpenAPI document is generated from code and committed; the typed client is generated from it; a breaking change to it fails CI unless the API version is bumped.

### STK-008 [must|lint] ui
Server state lives in TanStack Query, never copied into Zustand. Zustand holds UI-only state. Forms use react-hook-form with zod schemas shared with the contract types where possible.

### STK-009 [must|review] infra
H-OS is deployable as single-tenant per customer and as a managed deployment, from the same code and images. Differences are configuration only.

### STK-010 [must|review] *
Not allowed without a Decision: splitting into microservices, GraphQL, a second ORM, a second UI library, a second state library, storing auth tokens in `localStorage`, running a message broker or Kubernetes before a requirement demands it.

### STK-011 [must|review] ui, docs
Any additional charting, dashboard, diagramming, or visualization library beyond the committed stack requires a Decision that documents the business need, alternatives, accessibility implications, and maintenance cost. The initial visual direction remains a proposal for evaluation until a Decision accepts it.

### STK-012 [must|review] decision, deps, api
The backend runtime and framework are an open question (`DEC-0008`). Until a replacement Decision is accepted, the existing NestJS application is the reference implementation, new backend work follows this stack, and no second backend stack, framework or runtime may be introduced.
