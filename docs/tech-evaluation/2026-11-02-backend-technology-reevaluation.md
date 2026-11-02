# H-OS backend technology re-evaluation

- **Date:** 2026-11-02
- **Status:** evaluation only. No technology is approved and no application code changed.
- **Decision:** `DEC-0008` (proposed); `DEC-0001` moved from `accepted` to `proposed`.
- **Owner:** project owner (HiraTechLabs).
- **Scope:** backend runtime and framework. Frontend, database, API style, container strategy and
  modular-monolith architecture are out of scope and unchanged.

This document is the evidence behind `DEC-0008`. It is deliberately longer than the Decision because
`DEC-004` requires Decisions to stay short and retrievable.

---

## 1. Method and evidence standard

Two evidence classes are used and never mixed:

1. **Measured in this repository** on 2026-11-02 — command outputs, file counts, the running NestJS
   baseline benchmark, memory and start-up numbers, governance results.
2. **Assessed from documented platform capabilities and H-OS requirements** — no invented
   benchmarks, no copied vendor numbers, no claims that one runtime is faster without measurement.

Where a claim depends on a library or version that must be verified during a spike, it is marked
**verify in spike** instead of being stated as fact.

### What was inspected

| Area | Paths |
|---|---|
| Rules | `.caliper/principles/CORE.md`, `business.md`, `clean-architecture.md`, `clean-code.md`, `security.md`, `performance.md`, `test.md`, `logs.md`, `git.md`, `decisions.md`, `graph.md`, `tech-stack.md`, `README.md`, `README.ar.md` |
| Decisions | `.caliper/decisions/DEC-0001…DEC-0007` (all read), `.caliper/decisions/DEC-0008` (this re-evaluation) |
| Graph | `.caliper/graph/graph.json`, `graph.md`, `overrides.json`, `tools/graph/generate.mjs` |
| Governance tooling | `tools/principles/validate.mjs`, `tools/arch/check.mjs`, `tools/README.md`, `package.json`, `turbo.json`, `pnpm-workspace.yaml`, `.github/workflows/ci.yml` |
| Composition root | `platform/api/src/main.ts`, `app.module.ts`, `auth/auth.controller.ts`, `health/health.controller.ts`, `platform/platform-account.controller.ts`, `bootstrap/seed.ts`, `bootstrap/seed-cli.ts` |
| Kernel | `platform/kernel/src/**` — auth guard/provider/session/rate limiter, account directory/management, RBAC permission service, audit, outbox, entity links, config, logger, errors, problem filter, Zod pipe, request context, DB client/provider/schema |
| H-HR backend | `apps/hr/api/src/**` — domain, application use cases and ports, Drizzle repositories, schema, controllers, `hr.module.ts` |
| Contracts | `platform/contracts/src/**` — Zod API schemas, permissions, event types, problem+json, entity links |
| Frontend coupling | `platform/client/src/client.ts`, `platform/client/src/permissions.ts`, `platform/web/src/**`, `apps/hr/web/src/**` (contract consumption, not implementation) |
| Infrastructure | `infra/compose/docker-compose.yml`, `infra/compose/initdb/001-extensions.sql`, `.env.example` |
| History | `docs/worklogs/2026-10-29-h-hr-phase-00-audit.md`, `…-phase-01-delivery.md`, `…-phase-01-hardening.md`, `git log` |
| App rules | `apps/hr/.caliper/**` (business, security, integrations, testing, workflows), `HR-DEC-0001`, `HR-DEC-0002` |

---

## 2. What H-OS requires from a backend

The comparison is only meaningful against these requirements, all of which are already rules.

| Requirement | Source | Consequence for the technology |
|---|---|---|
| Modular monolith, one deployable, one PostgreSQL, one schema per app | `tech-stack.md`, `STK-010`, `ARCH-015` | The framework must support in-process modules with enforceable boundaries; no microservice or broker workaround. |
| Dependencies point inward; domain imports no framework, ORM or HTTP type | `ARCH-001`, `CORE-002` | Framework types must stay in presentation/infrastructure; the domain is plain objects. |
| One use case per operation; controllers map and delegate | `ARCH-006`, `ARCH-009` | Cheap explicit DI/wiring for ~17 use cases per app and growing. |
| Authorization in the backend per permission **and** data scope, applied in SQL | `SEC-002`, `SEC-003`, `PERF-009` | Query construction must express `ltree` scope predicates; no in-memory filtering. |
| Transactions and append-only audit in the same transaction; outbox in the same transaction | `ARCH-007`, `ARCH-008`, `SEC-007` | Explicit transaction handles that can be passed to repositories, audit and outbox. |
| Effective dating with exclusion constraints; `ltree`; `btree_gist`; `pgcrypto` | `BIZ-003`, `STK-006` | First-class PostgreSQL access, `EXPLAIN`-able queries, no ORM abstraction that hides SQL. |
| Money is never a float; exact decimals and one rounding point | `CORE-005`, `BIZ-002`, `DEC-0005` (proposed) | Native decimal or a maintained decimal library carried through the API boundary. |
| REST, OpenAPI 3.1 generated from code, generated typed client, RFC 9457 errors | `STK-007` | Contract generation is an acceptance criterion, not a nice-to-have. |
| Background jobs for payroll runs, imports, reports with progress and idempotent retries | `PERF-006` | Real worker execution, not a request-scoped promise; CPU work must not block request handling. |
| Observability: structured JSON logs, OpenTelemetry spans, Prometheus metrics, trace propagation | `LOG-001`, `LOG-004`, `LOG-007` | Mature, first-party instrumentation. |
| Tests: unit domain, integration against real PostgreSQL (Testcontainers), contract tests | `TEST-001`, `TEST-007` | Language-appropriate Testcontainers support and HTTP-level tests. |
| Deploy as one container per customer or managed, same images | `STK-004`, `STK-009` | Small, non-root, pinned images; predictable memory and start-up. |
| Performance budgets: reads p95 < 300 ms, writes p95 < 1 s on reference hardware | `PERF-005` | Measured p95, not synthetic throughput. |
| Shared platform kernel: identity, sessions, authorization, audit, events, links, notifications | `ARCH-013` (extended by `DEC-0003`) | The kernel is re-implemented once per candidate; it is the main migration cost. |
| Frontend stays React + TypeScript with shared Zod contract types | `tech-stack.md`, `STK-008` | A non-TypeScript backend loses shared runtime schemas; OpenAPI becomes the only contract. |

The last row is the pivot. `@h-os/contracts` is not just types: the same Zod objects validate HTTP
input in `ZodValidationPipe` and drive React forms. That is the strongest structural argument for
keeping a TypeScript backend, and it is the main cost of every alternative.

---

## 3. Current backend, measured

### 3.1 Size and shape

Measured with `git ls-files` and `Select-String` on 2026-11-02:

| Fact | Value |
|---|---|
| Backend source files (`platform/api/src`, `platform/kernel/src`, `apps/hr/api/src`) | 73 |
| Backend source lines | 7,214 |
| Files importing `@nestjs/*` | 44 (60%) |
| `@Injectable()` declarations | 30 |
| `@Inject()` constructor injections | 170 |
| Controllers | 5 |
| H-HR use cases | 17 |
| PostgreSQL tables | 30 (10 platform + 20 HR) |
| Apps mounted in the deployable | 1 (H-HR) + platform |
| Nest packages installed | `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` 12.3.2 |
| Other runtime dependencies of the backend | `drizzle-orm`, `postgres`, `express` 5, `zod`, `argon2`, `pino`, `reflect-metadata` |

`reflect-metadata` and decorator metadata are load-bearing: DI is resolved at runtime, guards and
pipes are metadata-driven, and the encoding of every use case follows constructor injection.
NestJS is therefore not a thin HTTP adapter over a framework-free core; it is the DI and request
pipeline. The *domain* (`apps/hr/api/src/domain`, `platform/kernel/src/**` value objects) and the
*application ports* are framework-free, as `ARCH-001` requires, but the application services
themselves import `@nestjs/common` for `@Injectable`/`@Inject`.

### 3.2 NestJS-specific mechanisms in use

| Mechanism | Where | What an alternative must replace |
|---|---|---|
| Dynamic modules (`forRoot(config)`) | `AppModule`, `KernelModule` | Explicit composition root and lifetimes |
| `APP_GUARD` global deny-by-default | `app.module.ts` → `AuthGuard` | Middleware/filter pipeline with the same default |
| `APP_FILTER` catch-all | `ProblemFilter` | RFC 9457 mapper at the boundary |
| `@Controller`, `@Get/@Post/@Patch`, `@Param`, `@Query`, `@Body` | 5 controllers | Routing layer |
| `@Public()` metadata + `Reflector` | auth guard | Public-route registration and a test that lists them |
| `@CurrentActor()` param decorator | controllers | Request-scoped actor resolution |
| `ZodValidationPipe` (`PipeTransform`) | every body/query | Validation at the boundary |
| `@Injectable` + `@Inject(Symbol)` | 30 classes / 170 injections | DI wiring |
| `OnModuleInit/OnModuleDestroy` | outbox dispatcher, DB lifecycle | Application lifecycle hooks |
| `NestFactory.create` + Express 5 | `main.ts` | HTTP host, middleware, CORS, shutdown hooks |

### 3.3 Kernel surface that would have to be re-implemented

- Argon2id credential verification, session issuance, token hashing, idle/absolute expiry, rotation,
  revocation on termination and on org change.
- RBAC: accounts, roles, permissions, grants with `own|unit|subtree|all` scopes; deny-by-default.
- Access review semantics (`SEC-014`) and self-modification guards.
- Append-only audit with before/after snapshots and sensitive-key redaction, written inside the
  caller's transaction.
- Transactional outbox with in-process dispatch, attempt counters and failed-event visibility.
- Entity links `{app, type, id}` and notifications (link-to-authority only).
- Problem details mapping, request/trace context middleware, secure headers, CSRF origin guard,
  fixed-window login rate limiting, config validation at boot, pino redaction.
- The workflow engine required by `DEC-0003` (definitions, instances, tasks, delegation) does **not
  exist yet** — no `workflow_*` tables and no service. It is greenfield for any candidate, which
  slightly lowers switching cost but raises the bar for background/job support.

### 3.4 Documentation versus implementation

The task explicitly asked not to trust documentation. These gaps matter to the decision:

| Documented | Actual state on 2026-11-02 | Effect on the evaluation |
|---|---|---|
| `STK-007`: OpenAPI document generated from code and committed; typed client generated from it | No OpenAPI document exists; no Swagger/Nest OpenAPI dependency; `platform/client` is hand-written. | OpenAPI 3.1 generation is unproven for **every** candidate and becomes an acceptance criterion. |
| `STK-004`: multi-stage, non-root images; dev and prod use the same images | No Dockerfile exists; Compose runs PostgreSQL only. | Container size/start-up cannot be compared from this repository yet; must be built in the benchmark harness. |
| `tech-stack.md`: Redis + BullMQ when jobs need them | No Redis/BullMQ dependency; the only background mechanism is the in-process outbox poller (`setInterval`, 1 s, batch 50). | Background-job ergonomics are unproven for NestJS and greenfield for all candidates. |
| Quality tooling: dependency-cruiser, knip, Vitest, Testcontainers, Playwright, axe | Vitest and Testcontainers are real; boundary checks are the custom `tools/arch/check.mjs`; dependency-cruiser, knip and Playwright are not installed. | Tooling claims are partly aspirational; a language change must budget for real tooling work. |
| `DEC-0003`: kernel includes permissions and workflow | Permissions exist; workflow does not. | Approvals (Phase Two) are not blocked by the language decision, but the chosen stack must cover job/workflow needs. |
| GitHub Actions CI runs | Workflow file exists and is valid; it has never run (remote unreachable per the Phase One worklog). | CI results quoted here are local command runs, not GitHub checks. |

### 3.5 Current runtime behaviour worth knowing before comparing

- `SessionService.resolve` performs **four queries per authenticated request**: session, account,
  roles, grants. That dominates short authenticated endpoints today.
- A list request with `scope = 'all'` is those four queries plus one keyset query; with
  `subtree`/`unit` it adds employee-identity and org-path lookups.
- Request-scoped caching of the resolved scope is allowed by `PERF-009` and not implemented.
- The outbox poller runs in the API process. A payroll run or report implemented naively would run
  on the same event loop as HTTP traffic.

These are code-level facts, not framework limits, but they decide what the benchmark must hold
constant.

---

## 4. Evaluation model

Scores are informed judgments on a 1–5 scale, not measurements. Weights are a proposal for the owner
to change; they are shown so the conclusion can be re-derived rather than trusted.

| # | Dimension | Weight | Why this weight for H-OS |
|---|---|---|---|
| D1 | Domain and transactional correctness | 20 | Money, effective dating, audit and outbox correctness are the product. A fast wrong ledger is worthless. |
| D2 | Database productivity and SQL control | 15 | PostgreSQL is the primary database; scope predicates, `ltree`, exclusion constraints and `EXPLAIN` are daily work. |
| D3 | Reporting/analytical queries and CPU-bound jobs | 15 | Payroll runs, imports, exports and analytics are the expected heavy load (`PERF-006`). |
| D4 | Contract integrity with the TypeScript frontend | 15 | `STK-007`/`STK-008`: one contract, runtime validation, generated client. |
| D5 | Modular monolith and boundary enforcement | 10 | Seven apps in one deployable by design (`ARCH-002`, `ARCH-014`, `STK-010`). |
| D6 | Operational footprint and deployment | 10 | One container per customer or managed; memory and start-up are recurring cost (`STK-009`). |
| D7 | Ecosystem and long-term support | 5 | Enterprise integrations (OIDC, storage, mail, observability) must exist and be maintained. |
| D8 | Team productivity and hiring | 10 | A stack the team cannot staff is a permanent tax. |

---

## 5. Candidate assessment

### 5.1 NestJS on TypeScript (baseline)

**What it buys H-OS today.** One language across contracts, API and React; the same Zod schema
validates a request and types a form; Drizzle gives SQL-shaped, strongly typed queries over the same
PostgreSQL the rules require; decorator DI maps directly onto `ARCH-009`; guards, pipes and filters
map onto `SEC-001`, `SEC-004` and `STK-007`. The existing 7,214 lines are already structured by
domain/application/infrastructure/presentation, so the architecture survives a framework change —
but the wiring does not.

**Strengths for this platform.** Lowest migration cost (zero now); best contract story; fastest
feature iteration for a TypeScript team; large hiring pool; mature HTTP ecosystem; predictable
PostgreSQL access through Drizzle; test ergonomics are good (Vitest + Testcontainers already
working).

**Weaknesses that triggered the re-evaluation.**

1. **Single-threaded CPU work.** Payroll calculation, PDF/CSV export, large imports and in-process
   report assembly compete with request handling on one event loop. `PERF-005` allows 1 s for
   writes and defers slow work to jobs (`PERF-006`), but the job runner would still be Node unless
   it is a separate process or `worker_threads` (a design the repository does not have yet).
2. **Memory per instance.** Measured: 122 MB RSS idle after one request, 245 MB after a 60-second
   load run. For a per-customer container, that is the fixed cost before any business logic.
3. **Runtime DI and reflection.** 170 injections resolved at boot; errors surface at runtime rather
   than compile time; the decorator surface is invisible to plain TypeScript tooling.
4. **Ecosystem churn.** The framework majors move; decorator metadata, Express 5 and Node ABI
   changes are upgrade work that is not visible in business value.
5. **Analytical work in the API process.** If reporting is implemented in TypeScript instead of
   SQL, a single large report can stall every tenant request in that container.

**Important counter-evidence.** The measured baseline does **not** show a slow framework: health at
~900 rps with c=32 on a shared laptop, and the authenticated list cost is dominated by five database
round trips, not by NestJS. The weakest numbers (p95 277 ms at c=32) sit just inside the `PERF-005`
budget *with two employee rows*, which means the budget is being consumed by query fan-out, not data
volume. That is fixable in NestJS. Any replacement must be compared after fixing it, or the
comparison measures a bug.

**NestJS is a credible long-term answer only if** CPU-heavy work is executed in PostgreSQL or in
separate worker processes, the session fan-out is cached, and OpenAPI 3.1 plus container packaging
are actually delivered. Those are commitments, not language properties.

### 5.2 Go

**Fit.** Go is the cleanest match for a PostgreSQL-heavy business backend that must also run CPU-bound
batch work. `pgx` exposes the full protocol (batch, `COPY`, `LISTEN/NOTIFY`, `pgx.Tx`), `sqlc`
generates typed code from SQL (which suits `ARCH-005`: ORM types never leave infrastructure), and
goroutines give real parallelism inside one deployable without a broker. Manual wiring in a
composition root is the purest expression of `ARCH-009`. Static binaries, distroless images and
sub-100 ms start-up make `STK-004`/`STK-009` trivial.

**Strengths for H-OS.** Best measured-cost profile on paper and in practice for this workload class;
excellent concurrency for imports, exports and payroll batches; simple deployment; strong standard
library and first-class profiling (`pprof`); OTel, Prometheus and structured logging are mature;
`internal/` packages plus `depguard`/`go-arch-lint` can enforce `ARCH-002` mechanically; no runtime
reflection.

**Weaknesses for H-OS.**

1. **Contract sharing disappears.** Go cannot consume the Zod schemas. OpenAPI 3.1 becomes the
   single source of truth and the frontend must consume generated types plus a generated or
   hand-written runtime validator. This is a real cost for `STK-007`/`STK-008` and every form.
2. **Domain modelling is more verbose.** No sum types; nullable/optional fields use pointers;
   state machines, money and effective dating need explicit structs and constructors. `ARCH-012`
   value objects are achievable but wordier.
3. **No native decimal.** Money needs a maintained library (`shopspring/decimal` class) or string
   math, and the JSON boundary must not leak floats (`DEC-0005`). SQL `numeric` mapped to a decimal
   type works, but the type must be chosen and tested.
4. **Tooling outside the JS monorepo.** pnpm/Turborepo do not build Go; the graph generator parses
   TypeScript conventions; the architecture checker only scans `.ts/.tsx`. Both tools need
   language-specific extractors in the same change (`GRAPH-002`, `GRAPH-003`).
5. **Team.** Largest skill shift from the current TypeScript team; enterprise CRUD velocity is
   usually lower than NestJS/Spring for teams new to Go.

**Migration surface.** Kernel (~2,400 lines), 17 use cases, 6 repositories, 5 controllers, contracts,
the graph/arch tools, CI, Dockerfile, Testcontainers harness, and the typed client pipeline. Feasible
incremental path: a Go module behind the same HTTP contract, started with one read-only endpoint and
one write path, sharing PostgreSQL and the outbox table.

### 5.3 C# and ASP.NET Core

**Fit.** The closest enterprise feature parity to NestJS with fewer runtime surprises: built-in DI
with explicit lifetimes, middleware/filters, `System.Decimal` (money is native, `DEC-0005` becomes
simpler), `DateOnly`/`TimeOnly`, `async/await` throughout, Kestrel, first-party OpenAPI, EF Core or
Dapper for PostgreSQL (`Npgsql`), `BackgroundService`/Quartz/Hangfire for jobs, Serilog for JSON
logs, OpenTelemetry and health checks built in. `record` types and pattern matching model value
objects and state machines well. Architecture tests (NetArchTest/ArchUnitNET) can enforce module
boundaries.

**Strengths for H-OS.** Best balance of correctness tooling, performance and enterprise maintenance;
native decimal removes a dependency and a class of bugs; strong transaction ergonomics
(`NpgsqlTransaction` passed explicitly like the current `DbExecutor`); good reporting story through
Dapper/raw SQL; long-term support cadence; excellent observability; Testcontainers for .NET is
mature.

**Weaknesses for H-OS.** No shared Zod contracts — OpenAPI and codegen again; latest .NET language
and tooling require a Windows/Linux SDK in CI; EF Core can hide SQL and invites N+1 unless the team
keeps queries explicit (the rules already demand `EXPLAIN` and no N+1); baseline memory is larger
than Go but comparable to or lower than Node in steady state **verify in benchmark**; verbose DTO
mapping; a language shift for the current team.

**Migration surface.** Same functional surface as Go, plus a .sln/project layout and a new build
tool outside pnpm. Incremental path is the same: a new HTTP host behind the same contract, one
endpoint at a time, sharing the database.

### 5.4 Java and Spring Boot

**Fit.** The most complete enterprise platform: Spring Security covers sessions, OIDC and Keycloak
(the planned `AuthProvider` evolution), Spring JDBC/JPA covers persistence, Flyway/Liquibase cover
migrations, `BigDecimal` covers money, virtual threads (current LTS) remove the reactive tax for
high concurrency, and the JVM JIT is excellent for long-running CPU work such as payroll and
reporting. **Spring Modulith** and **ArchUnit** are unusually good fits for `ARCH-002`,
`ARCH-014`/`ARCH-015`: module boundaries, allowed dependencies, event publication and architecture
tests are first-class. Micrometer/Actuator/OTel cover `LOG-007`; Quartz/ShedLock cover jobs.

**Strengths for H-OS.** Strongest governance and boundary tooling for a modular monolith; richest
integration ecosystem (OIDC, LDAP, mail, messaging, reporting); best-in-class observability;
excellent long-term support; `BigDecimal` native; very strong testing story.

**Weaknesses for H-OS.** Heaviest operational footprint: JVM memory (hundreds of MB per instance),
slower start-up and larger images than Go/.NET — material for a per-customer container model
(`STK-009`) **verify in benchmark**; the most ceremony (beans, proxies, annotations); JPA/Hibernate
tempts framework types into the domain and hides SQL (`ARCH-001`, `ARCH-005`, `PERF-004`), so the
team must deliberately use JDBC/`JdbcTemplate` or a mapper boundary; the biggest build/tooling
change (Gradle/Maven outside pnpm); a language shift for the team.

**Migration surface.** Same functional surface plus a multi-module Gradle/Maven build; Spring
Modulith gives the best structural map of the seven future apps, which is a genuine architectural
benefit rather than a generic language claim.

### 5.5 Summary table (qualitative)

| Criterion | NestJS | Go | ASP.NET Core | Spring Boot |
|---|---|---|---|---|
| Shared Zod contracts with React | **best** | no | no | no |
| CPU-bound payroll/report work in-process | weak | **best** | strong | **best** (JIT) |
| Explicit SQL and PostgreSQL control | strong | **best** | strong (Dapper) | strong (JDBC) |
| Native exact decimal | library (`decimal.js`) | library | **native** | **native** |
| DI and modular boundaries | good | manual/explicit | **best built-in** | **best (Modulith/ArchUnit)** |
| Memory/start-up footprint | medium | **best** | good | weakest |
| Enterprise integration ecosystem | strong | good | **best** | **best** |
| Repository tooling today | **works** | rewrite needed | rewrite needed | rewrite needed |
| Team/skill continuity | **best** | weakest | medium | medium |
| Migration cost from today | **zero** | high | high | high |

---

## 6. Weighted comparison

Scores 1–5 (judgment). Weights from section 4.

| Dimension (weight) | NestJS | Go | ASP.NET Core | Spring Boot |
|---|---|---|---|---|
| D1 correctness (20) | 4 | 4 | 5 | 5 |
| D2 database/SQL (15) | 4 | 5 | 4 | 4 |
| D3 reporting/CPU (15) | 2 | 5 | 4 | 5 |
| D4 contracts (15) | 5 | 3 | 3 | 3 |
| D5 modularity (10) | 4 | 4 | 5 | 5 |
| D6 operations (10) | 4 | 5 | 4 | 2 |
| D7 ecosystem (5) | 5 | 3 | 5 | 5 |
| D8 team (10) | 5 | 2 | 3 | 3 |
| **Weighted score** | **4.00** | **4.00** | **4.10** | **4.05** |

Sensitivity (weights changed, scores unchanged):

| Scenario | NestJS | Go | ASP.NET Core | Spring Boot | Reading |
|---|---|---|---|---|---|
| Base weights | 4.00 | 4.00 | 4.10 | 4.05 | Statistically a tie; no winner. |
| Heavy payroll/reporting (D3 25, D4 10, D8 5) | 3.70 | **4.25** | 4.20 | **4.25** | Go/Spring pull ahead; NestJS clearly last. |
| Contract-first, small team (D4 25, D8 15, D3 10) | **4.25** | 3.65 | 3.95 | 3.95 | NestJS wins; switching is expensive. |
| Operations-constrained (D6 25, D3 15) | 3.95 | **4.20** | 4.10 | 3.75 | Go wins; Spring is hard to justify per-customer. |

**Conclusion of the matrix:** the answer is weight-sensitive, and the top three alternatives fall
inside a 0.1 band. A matrix cannot decide this; the benchmark and a spike must. Anyone who quotes
one score as "the answer" is quoting their own weights.

---

## 7. Benchmarks actually executed

### 7.1 What was measured, and what was not

**Executed:** a baseline load test of the existing NestJS application, plus build, start-up and
memory measurements on this workstation.

**Not executed:** Go, ASP.NET Core and Spring Boot. Measuring them requires implementing equivalent
applications, which this task forbids. No cross-language performance claim is made anywhere in this
document.

### 7.2 Environment (measured)

| Item | Value |
|---|---|
| Host | Windows 11 (win32), 13th Gen Intel Core i5-13450HX (10 cores / 16 threads), 16 GB RAM |
| Node.js | v22.20.0 (repo engine `>=22.11.0`; CI pins 22.11.0) |
| pnpm | 9.15.0 |
| PostgreSQL | 16.9 (Alpine), Docker container `h-os-postgres`, host port 5433, `postgres:16.9-alpine` |
| API | one `node dist/main.js` process, no cluster, pool max 10, `NODE_ENV=development`, `LOG_LEVEL=warn` |
| Data | 1 organization, 2 accounts, 2 employees, 30 tables — deliberately tiny |
| Client | 60-line Node `http` load generator (no dependency added); same machine as the server |
| Tooling | k6 is **not installed**; no external load generator was available |

### 7.3 Method

- Keep-alive connection pool of size `c`, closed-loop workers, fixed 10 s per run, 2 s unrecorded
  warm-up, zero errors reported by the client.
- Latency measured per request with `process.hrtime.bigint`, percentiles computed from the full
  sample set.
- Two endpoints: `GET /api/v1/health` (framework + one `select 1`) and
  `GET /api/v1/employees?limit=20` (global auth guard, session resolve, RBAC, data scope, keyset
  list).
- One login per session, cookie reused for all authenticated requests.
- Server RSS/CPU sampled before and after the matrix with `Get-Process`.

### 7.4 Results (measured 2026-11-02)

| Scenario | Concurrency | Requests | Throughput (rps) | p50 (ms) | p95 (ms) | p99 (ms) | Errors |
|---|---|---|---|---|---|---|---|
| health | 1 | 3,040 | 304.0 | 2.98 | 4.92 | 6.29 | 0 |
| health | 8 | 7,720 | 771.4 | 9.89 | 14.43 | 17.59 | 0 |
| health | 32 | 9,077 | 904.4 | 34.06 | 51.42 | 61.80 | 0 |
| employees list | 1 | 382 | 38.2 | 25.24 | 33.48 | 37.46 | 0 |
| employees list | 8 | 1,253 | 124.9 | 62.60 | 79.66 | 88.49 | 0 |
| employees list | 32 | 1,366 | 134.4 | 236.93 | 277.15 | 303.24 | 0 |

Operational measurements:

| Metric | Value |
|---|---|
| Process start → first successful health response (spawn, `localhost` DSN) | 3,951 / 4,127 / 4,198 / 3,590 ms |
| Same, DSN forced to `127.0.0.1` | 4,017 / 4,095 / 4,144 ms |
| Idle RSS after first request + 5 s (two fresh processes) | 122.1 / 122.2 MB, 16 threads |
| Long-running instance before the load matrix | 87.4 MB RSS, 32.3 s CPU |
| Same instance after the 60 s matrix | 244.6 MB RSS, 89.1 s CPU (no shrink observed) |
| Cold full monorepo build (`pnpm build --force`) | 38.7 s wall, turbo reports 36.284 s, 5/5 tasks, 0 cached |
| Backend build artifacts | api 0.06 MB + kernel 0.29 MB + hr-api 0.70 MB + contracts 0.17 MB ≈ 1.22 MB |
| Web build artifact | 3.43 MB (`platform/web/dist`) |

### 7.5 Interpretation

- **The framework is not the bottleneck for short endpoints.** ~900 rps health with c=32 on a
  laptop, and health p95 stays under 52 ms. This is not evidence that Node is "fast"; it is
  evidence that HTTP dispatch is not the problem.
- **Authenticated reads are dominated by fixed per-request work.** 26 ms at c=1 for five database
  round trips and two rows. The `PERF-005` read budget (300 ms p95) is met at c=1 (33 ms) and at
  c=8 (80 ms), but only just at c=32 (277 ms) with almost no data. Fixing the session fan-out is a
  prerequisite for any honest comparison and for the read budget at real data volumes.
- **Memory is non-trivial.** 122 MB idle and 245 MB after load is the per-container floor for this
  stack; a per-customer deployment multiplies it.
- **Start-up is ~4 s**, including first DB access and Windows/Docker overhead. A container image
  measurement on the target Linux host is still required; this number must not be compared with
  published start-up figures for other runtimes.
- **Build is acceptable** (≈39 s cold for the whole monorepo, backend artifacts ~1.2 MB).

### 7.6 Threats to validity (stated, not hidden)

1. Client and server share a 10-core laptop; both are CPU-contended. Throughput is a lower bound,
   and latency at c=32 includes client-side queuing.
2. The load generator is a small Node script, not k6. It is deterministic enough for a baseline but
   is not a standards-compliant load tool.
3. The dataset has two employee rows. The list query is not data-bound; the numbers say more about
   fixed overhead than about PostgreSQL under volume.
4. Only reads were measured. Transactional writes, reports and jobs are the workload that is most
   likely to differentiate candidates, and they were not executed (they would require a second
   implementation and, for writes, changes to the development dataset).
5. `NODE_ENV=development`, no clustering, default pool 10. Production tuning would change absolute
   numbers without changing the qualitative conclusions.
6. Virality: these numbers are **not** transferable to Linux containers or to the other candidates.

---

## 8. Proposed comparative benchmark (not executed)

This is the specification `DEC-0008` requires before acceptance. It is designed so that a win cannot
come from a faster machine, a bigger pool or a thinner feature set.

### 8.1 Environment

- **Candidate host:** identical dedicated Linux VM per candidate, 8 vCPU / 16 GB, same host class,
  CPU governor `performance`, no other workload. One container per candidate, same CPU/memory
  limits.
- **Load generator:** separate 4 vCPU VM on the same private network; k6 (open model, constant
  arrival) for HTTP; a small Go or k6 script for job drains. Never co-located with the server.
- **Database:** one dedicated PostgreSQL 16 instance (16 vCPU / 32 GB), identical `postgresql.conf`
  for every run: `shared_buffers=4GB`, `effective_cache_size=12GB`, `work_mem=32MB`,
  `maintenance_work_mem=1GB`, `max_connections=200`, `synchronous_commit=on`, `fsync=on`,
  `random_page_cost=1.1`, same extensions (`ltree`, `btree_gist`, `pgcrypto`), same collation.
- **Network:** same subnet, no TLS, keep-alive enabled, HTTP/1.1.

### 8.2 Dataset (identical snapshot for every candidate)

Deterministic generator, fixed seed, loaded with `COPY`, then `ANALYZE`:

| Table group | Volume |
|---|---|
| Organization units | 1,000 nodes, depth ≤ 6, valid `ltree` paths |
| Employees + persons + contacts | 200,000 active/terminated mix |
| Employment episodes + contracts | 300,000 |
| Effective-dated assignments + managers | 1,000,000 rows (history included) |
| Attendance days | 5,000,000 |
| Payroll lines (5 years) | 2,500,000 |
| Audit records | 500,000 |
| Accounts, roles, grants, sessions | 20,000 accounts, 50,000 sessions |
| Outbox events | 100,000 pending + 1,000,000 delivered |

Take a `pg_dump` after loading; restore the same snapshot before each candidate and each run.

### 8.3 Functional equivalence checklist

Every candidate implements the same operations, same validation, same permission checks, same
response shape, same error codes:

1. Session login/logout/me with opaque HttpOnly cookie and DB-backed sessions (no JWT shortcut).
2. Global deny-by-default auth, per-permission + data-scope enforcement in SQL.
3. Keyset-paginated employee list with filters (status, unit, job title, location, manager).
4. Employee profile read with field decryption and redaction.
5. Create employee: employee + person + contact + episode + contract + assignment + manager +
   status transition + audit + outbox, one transaction.
6. Change assignment: close previous effective-dated row, insert new, audit, outbox, one transaction.
7. Leave-request approval through the workflow engine (or a documented equivalent) with
   separation-of-duties.
8. Payroll calculation for a batch (CPU-bound, deterministic input/expected output).
9. Report: 12-month payroll summary by org unit with totals, plus CSV export.
10. Background job: enqueue 10,000 import rows, process with retries and idempotency, report progress.

A candidate that skips validation, authorization, audit or the outbox is disqualified, not "faster".

### 8.4 Scenarios and measurements

| ID | Scenario | Load shape | Primary metrics |
|---|---|---|---|
| S1 | `GET /health` | constant arrival, 10→500 rps | rps ceiling, p50/p95/p99, CPU per 1k requests |
| S2 | Authenticated employee list, `limit=20/50/100`, filters | 10→200 VUs, 5 min | p50/p95/p99, rps, error %, DB query time |
| S3 | Create employee (12 writes + audit + outbox) | 10→50 VUs, 5 min | p50/p95/p99, commits/s, lock waits, WAL bytes |
| S4 | Mixed 70% reads / 30% writes | 20→200 VUs, 5 min | p95/p99, error %, CPU, DB connections |
| S5 | Payroll run for 5,000 employees | 1 run × 3 | wall time, CPU seconds, peak RSS, p95 per employee |
| S6 | 10,000 queued jobs, 4 workers | drain | jobs/s, job p95 latency, retries, duplicates, lag |
| S7 | 12-month payroll report + CSV export (5M rows source) | 1 client × 5 | query time, `EXPLAIN (ANALYZE, BUFFERS)`, memory, rows/s |

Collected for every run: request throughput and p50/p95/p99/p99.9, error rate by status, server CPU
and RSS (and GC pauses where the runtime has a GC), container image size, cold start to first
healthy response, DB CPU, active connections, lock waits, temp bytes, WAL bytes, query plans for
S2/S3/S7, job success/retry counts, and audit/outbox row counts (correctness, not just speed).

### 8.5 Protocol and fairness controls

- 3 independent runs per scenario per candidate; discard the first 60 s of each run; report the
  **median** run and the spread.
- Same dataset snapshot, same pool size (10 and 20 tested), same log level (`info`, JSON), same
  feature flags, production build mode (`NODE_ENV=production` / `-c Release` / Go `-trimpath`),
  no profilers, no debuggers.
- Warm-up before measurement; separate cold-start measurement from warm throughput.
- Pin CPU and memory limits; record the host's CPU model and kernel for every run.
- Publish raw NDJSON results and the exact scripts; a result without a reproducible script is not
  accepted.
- No candidate may skip `synchronous_commit` or use `UNLOGGED` tables to win S3.

### 8.6 Decision rule (proposed)

A replacement advances only if it:

1. passes the functional equivalence checklist and the contract/audit tests;
2. is **≥25% better** than the current NestJS baseline on S2 or S4 p95 **and** is not worse on S3,
   **or** is ≥25% better on S5 + S7 with equal correctness;
3. keeps per-instance RSS and cold start within the deployment model's budget (owner input needed);
4. does not regress `PERF-005` (reads p95 < 300 ms, writes p95 < 1 s) under the 200k-employee dataset.

If no candidate clears (2), the correct outcome is to keep NestJS and fix its measured issues.

---

## 9. Architecture impact per candidate

Common to all: React/Vite/TanStack/Zustand/Tailwind/shadcn, PostgreSQL, REST, OpenAPI 3.1, Docker,
modular monolith, one deployable, no microservices, no Redis/broker introduced by this change.

### 9.1 What changes for *any* non-TypeScript backend

| Area | Change | Why it is unavoidable |
|---|---|---|
| Contracts | `@h-os/contracts` stops being shared runtime code. OpenAPI 3.1 becomes the source of truth; the frontend needs generated types **and** a runtime validator for forms. | React + Zod are TypeScript; no other language can execute the schemas. |
| Typed client | `platform/client` is replaced by generated client code. | `STK-007` requires a generated client. |
| Graph | `tools/graph/generate.mjs` parses `<schema>Schema.table('name', …)` and `export const XEventType = { … } as const`. A non-TS backend silently loses table/event nodes. | `GRAPH-002`/`GRAPH-003`: the generator must be extended or replaced in the same PR. |
| Architecture check | `tools/arch/check.mjs` scans only `.ts/.tsx` and a pnpm-package `BOUNDARIES` table. | `ARCH-001`/`ARCH-013` enforcement would otherwise be vacuous for the backend. |
| Build orchestration | Turborepo/pnpm only build JS packages; Go/.NET/Gradle need their own tasks and caching, and CI needs a second toolchain. | `STK-004`, CI pipeline. |
| Tests | Testcontainers harness and HTTP integration suite must be rewritten in the target language. | `TEST-001`, `TEST-007`. |
| Runtime packaging | New multi-stage Dockerfile, non-root user, pinned base image. | `STK-004` (already missing today). |
| Kernel | ~2,400 lines re-implemented: sessions, RBAC, audit, outbox, links, problem details, config, logging, security middleware. | `ARCH-013` surface. |
| Jobs/workflow | If the workflow engine is built after the language decision, it is built once in the winning stack. Doing it before the decision creates throwaway work. | `DEC-0003`, `PERF-006`. |

### 9.2 Go

- **Layout:** `apps/hr/api-go` as a Go module; `internal/domain`, `internal/application`,
  `internal/infrastructure`, `internal/http`, `cmd/api`. Boundaries enforced by `internal/` and
  `depguard`.
- **Contracts:** OpenAPI 3.1 generated (huma/oapi-codegen — **verify 3.1 output in spike**); frontend
  types via `openapi-typescript`; a generated Zod validator or a shared JSON Schema validator.
- **Persistence:** `pgx` + `sqlc`; keep the existing SQL migrations (goose/atlas) or generate from
  Drizzle DDL; transaction handle passed explicitly, mirroring `DbExecutor`.
- **Jobs:** goroutine workers with Postgres advisory locks, or a separate worker process — no Redis.
- **Costs:** graph/arch tooling, CI, DI wiring, decimal library, team ramp-up.
- **Architecture verdict:** compatible with every H-OS rule; strongest runtime fit; weakest contract
  continuity.

### 9.3 ASP.NET Core

- **Layout:** `apps/hr/api-dotnet` solution with `Domain`, `Application`, `Infrastructure`, `Api`
  projects; built-in DI; module boundaries via project references and architecture tests.
- **Contracts:** ASP.NET Core OpenAPI (3.1 support to be verified in the installed version);
  `openapi-typescript` for the frontend; FluentValidation or Zod-generated JSON Schema for forms.
- **Persistence:** Npgsql + Dapper for reads/reports and EF Core (or hand-written SQL) for writes;
  explicit `NpgsqlTransaction` for audit/outbox.
- **Jobs:** `BackgroundService` or Quartz; reports via Dapper + streaming CSV.
- **Costs:** second SDK in CI, OpenAPI/codegen pipeline, graph/arch parsers, DTO mapping, team.
- **Architecture verdict:** compatible; best enterprise parity; moderate operational footprint.

### 9.4 Spring Boot

- **Layout:** Gradle multi-module `apps/hr/api-java` with `domain`, `application`, `infrastructure`,
  `api`; Spring Modulith for module boundaries and ArchUnit for `ARCH-001`/`ARCH-002` tests.
- **Contracts:** springdoc OpenAPI (3.1 support to verify) + `openapi-typescript`.
- **Persistence:** Spring JDBC/`JdbcTemplate` or Spring Data JDBC for writes and reports; keep JPA
  out of the domain to preserve `ARCH-001`; Flyway for migrations.
- **Jobs:** Quartz or Spring Batch (Spring Batch is genuinely strong for payroll/imports);
  virtual threads for request concurrency.
- **Costs:** largest image/memory, JVM tuning, Gradle toolchain, graph/arch parsers, team.
- **Architecture verdict:** compatible and best-governed structurally; heaviest operationally.

### 9.5 NestJS (keep)

- **No structural change.** Close the measured gaps instead: cache the resolved session scope per
  request (`PERF-009`), move payroll/report/export work to a separate worker process or do it in
  SQL, generate and commit OpenAPI 3.1, add a multi-stage non-root Dockerfile, add the missing
  contract tests, and decide the job runner (BullMQ needs Redis, which `STK-010` currently defers —
  a Decision is required).
- **Architecture verdict:** compatible today; the risks are operational discipline, not rules.

---

## 10. Cost, risk and timing

| Risk | Effect | Mitigation |
|---|---|---|
| Benchmark measures a bug, not a runtime | Wrong winner | Fix session fan-out first; identical functional checklist; S5/S7 included |
| Contract drift after losing Zod | Runtime/API mismatches in production | OpenAPI 3.1 as source of truth; generated client + validator; contract tests in CI |
| Tooling blind spots (`graph`, `arch`) | Boundary violations and a stale graph | Extend both tools in the migration PR (`GRAPH-002`, `ARCH-003`) |
| Half-migrated backend | Two stacks, double maintenance, `STK-012` violation | Strangler path with one writer per endpoint, or a cut-over branch; never both live long-term |
| Payroll correctness during rewrite | Financial and legal exposure | Keep the same SQL constraints and money rules; property-based and golden-file payroll tests |
| Team ramp-up | Slower delivery for 1–2 quarters | Spike first, hire/train before committing, keep frontend untouched |
| Migration cost grows with apps | Rewriting before COS/H-Finance is far cheaper than after 4 apps | Decide before the next app's backend starts |

**Timing.** The migration surface is 7,214 lines, 30 tables and one app. Every future app multiplies
the kernel reuse and the number of use cases to port. If a change is going to happen, the cheapest
window is now; if it is not justified, the cheapest decision is to keep NestJS and fix its measured
issues. Both are coherent; drifting without deciding is not.

---

## 11. Advisory recommendation

This is advice to the project owner, not an approval.

1. **Do not switch on reputation, and do not keep NestJS by inertia.** The measured evidence does
   not show a runtime ceiling; it shows fixed per-request database work and a real memory floor.
2. **Shortlist two candidates for the benchmark: ASP.NET Core and Go.** They cover the two plausible
   futures — enterprise parity with native decimals and built-in DI (.NET), versus maximum
   throughput and minimal footprint (Go). Spring Boot is technically excellent and the best
   structural fit for seven modules, but its memory/start-up profile conflicts with per-customer
   containers unless the owner accepts that cost.
3. **Keep NestJS in the benchmark as the control**, after fixing the session fan-out and moving one
   representative CPU-heavy job out of the request process. Comparing against the current
   implementation as-is would flatter every challenger.
4. **On current, unmeasured evidence, ASP.NET Core is the best risk-adjusted replacement** — native
   `decimal`, mature DI/modularity, strong async and reporting, enterprise support — with **Go as
   the strongest challenger** if S5/S7 show a decisive throughput or memory advantage and the team
   accepts the contract and skill cost. **Spring Boot** is the right answer only if the organization
   commits to JVM operations and values Spring Modulith/ArchUnit governance above footprint.
5. **NestJS remains a legitimate long-term answer** if: reporting and payroll run in PostgreSQL or
   isolated workers, the session/scope fan-out is cached, OpenAPI 3.1 and container images are
   delivered, and the owner accepts ~120–250 MB per instance. If those conditions are unacceptable,
   the decision should be to migrate, not to keep patching.
6. **Sequence:** approve/reject the benchmark spec → run it (2–3 weeks) → one spike per finalist
   behind the same OpenAPI contract → accept a replacement Decision with a migration plan → migrate
   before the next app's backend starts.

No candidate is approved. No backend code was written or migrated.

---

## 12. Open questions for the project owner

1. Deployment model: one container per customer, or a managed multi-tenant deployment? (Memory
   weight, D6.)
2. Expected peak payroll size and report window for the first two years? (S5/S7 data volumes.)
3. Is a non-TypeScript backend team realistic to hire or train within two quarters? (D8; if not, the
   matrix changes materially.)
4. Must the answer be settled before the leave engine (Phase Two), or can the leave engine proceed on
   NestJS while the benchmark runs? (Sequencing risk.)
5. Is the shared Zod contract a fixed architectural commitment, or may OpenAPI 3.1 + codegen replace
   it? (D4; the single biggest cost of every alternative.)
6. Does the owner want a dedicated `reopened` decision status added to `DEC-002` and the validator,
   instead of reusing `proposed`? (See `DEC-0008`, option B.)

---

## 13. References

- `.caliper/decisions/DEC-0001-backend-stack.md` (now `proposed`, text unchanged)
- `.caliper/decisions/DEC-0008-backend-technology-reevaluation.md`
- `.caliper/principles/tech-stack.md` (`STK-001`, `STK-012`)
- `.caliper/principles/clean-architecture.md`, `performance.md`, `security.md`, `test.md`, `logs.md`
- `.caliper/graph/graph.json`, `.caliper/graph/graph.md`
- `tools/graph/generate.mjs`, `tools/arch/check.mjs`, `tools/principles/validate.mjs`
- `platform/api/src/**`, `platform/kernel/src/**`, `apps/hr/api/src/**`, `platform/contracts/src/**`
- `docs/worklogs/2026-10-29-h-hr-phase-00-audit.md`, `…-phase-01-delivery.md`,
  `…-phase-01-hardening.md`
- `docs/worklogs/2026-11-02-backend-technology-reevaluation.md` (this task's log)
