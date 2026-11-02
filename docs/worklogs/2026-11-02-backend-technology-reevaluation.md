# Backend technology re-evaluation — governance changes and baseline evidence

- **Date:** 2026-11-02
- **Branch:** `refactor/platform-backend-technology-reevaluation` (created from `86d1f08`,
  `chore/platform-repo-bootstrap`; `main` is still at `730cc77`)
- **Task:** reopen `DEC-0001` (NestJS on TypeScript), evaluate Go, C# + ASP.NET Core and Java +
  Spring Boot against H-OS requirements, update governance, measure the current baseline, and stop
  before any implementation.
- **Status:** evaluation complete. No backend code, migration, dependency, container, frontend or
  database change. No technology approved.

---

## 1. Starting state

| Fact | Value |
|---|---|
| Branch on entry | `chore/platform-repo-bootstrap` at `86d1f08 MVP` (`main` at `730cc77`) |
| Working tree on entry | clean except one uncommitted modification to `DEC-0001` |
| That modification | an appended `## Re-evaluation Status` body note plus a stray `<EOF>` marker, written without a status change |
| Governance on entry | `pnpm governance` passed (graph 19 nodes/28 edges, 157 rules, 7 decisions, 9 packages) |

The uncommitted note was an out-of-band edit to an `accepted` Decision. `DEC-003` allows an accepted
Decision to be edited **only for its status**, so the note was removed and the reopening was recorded
through the mechanism the repository actually supports (a new `proposed` Decision plus a status-only
edit). The committed text of `DEC-0001` is byte-identical to `86d1f08` except `status`.

## 2. What was inspected

Governing documents: `AGENTS.md`, every `.caliper/principles/*.md` (`CORE`, business, clean
architecture, clean code, security, performance, test, logs, git, decisions, graph, tech stack, UI/UX
overview, README and README.ar), `DEC-0001…DEC-0007`, `HR-DEC-0001/0002`, all `apps/hr/.caliper/*.md`.

Implementation: `platform/api/src/**`, `platform/kernel/src/**`, `apps/hr/api/src/**`,
`platform/contracts/src/**`, `platform/client/src/{client,permissions}.ts`, `platform/web/src/**`
(consumption only), `apps/hr/web/src/**` (consumption only), `infra/compose/**`, `.env.example`,
`.github/workflows/ci.yml`, `tools/**`, `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`.

History and graph: `docs/worklogs/2026-10-29-*.md`, `.caliper/graph/{graph.json,graph.md,overrides.json}`,
`git log`, `git status`.

Measured backend shape (2026-11-02): 73 backend source files, 7,214 lines, 44 files importing
`@nestjs/*`, 30 `@Injectable()`, 170 `@Inject()`, 5 controllers, 17 H-HR use cases, 30 tables
(10 platform + 20 HR), one app mounted.

## 3. Decision changes

| File | Change |
|---|---|
| `.caliper/decisions/DEC-0001-backend-stack.md` | `status: accepted` → `status: proposed`. Nothing else. |
| `.caliper/decisions/DEC-0008-backend-technology-reevaluation.md` | **new**, `status: proposed`; records why the decision is reopened, the four candidates, the lifecycle constraint, the conditions for acceptance and the open questions. `supersedes: null` until accepted. |
| `.caliper/principles/tech-stack.md` | status paragraph now says the backend row is under re-evaluation (`DEC-0001` proposed, `DEC-0008`), no replacement approved; new rule `STK-012` forbids introducing a second backend stack while the question is open. Table row unchanged. |
| `.caliper/principles/README.md` | one sentence: the backend choice is under re-evaluation, with the Decision references. |
| `.caliper/principles/README.ar.md` | the same statement in Arabic. |
| `.caliper/graph/overrides.json` | hand-written description of `@h-os/api` now says NestJS is the implemented baseline and the runtime is under re-evaluation. |
| `.caliper/graph/graph.json` | regenerated (`pnpm graph:generate`); only that description changed. No node/edge change. |
| `docs/tech-evaluation/2026-11-02-backend-technology-reevaluation.md` | **new** full evaluation, benchmark evidence and benchmark specification. |
| `docs/worklogs/2026-11-02-backend-technology-reevaluation.md` | this log. |

### Why `proposed` and not a review status

`DEC-002` defines exactly four statuses (`proposed`, `accepted`, `superseded`, `rejected`); the
validator enforces them. There is no `reopened`/`under review` status. Options were:

- **A (chosen):** status-only downgrade of `DEC-0001` to `proposed` plus a new `proposed` Decision.
  Smallest compliant change; history untouched; the resolver stops returning the backend decision as
  settled, while `STK-001`/`STK-012`/`tech-stack.md` keep the operative rule.
- **B (rejected):** invent `reopened` and extend `DEC-002` + `tools/principles/validate.mjs`. A
  governance-vocabulary change is larger than the problem and deserves its own Decision.
- **C (rejected):** mark `DEC-0001` `superseded` now. `superseded` asserts a successor is in force;
  the validator requires the superseded Decision to name its successor, and nothing is approved.
- **D (rejected):** leave it `accepted` and evaluate quietly; that is what the owner explicitly
  rejected.

The limitation is documented in `DEC-0008` (option B) and section 12 of the evaluation.

## 4. Graph note

`GRAPH-001` allows node types `app`, `module`, `service`, `datastore`, `event`, `contract`,
`external-system`. Decisions and technology choices are not graph node types, and the generator
derives structure from workspace manifests, Drizzle table declarations and the event catalogue.
There was therefore no structural change to record. Per `GRAPH-004`, the status is reflected in the
hand-written `@h-os/api` description; `graph.md` is unchanged, `graph.json` differs only in that
string, and `pnpm graph:check` passes.

## 5. Baseline measurement (executed)

Full method, results and threats to validity are in
`docs/tech-evaluation/2026-11-02-backend-technology-reevaluation.md` §7. Summary:

| Scenario | c | rps | p50 | p95 | p99 | errors |
|---|---|---|---|---|---|---|
| `GET /api/v1/health` | 1 | 304.0 | 2.98 ms | 4.92 ms | 6.29 ms | 0 |
| `GET /api/v1/health` | 8 | 771.4 | 9.89 ms | 14.43 ms | 17.59 ms | 0 |
| `GET /api/v1/health` | 32 | 904.4 | 34.06 ms | 51.42 ms | 61.80 ms | 0 |
| `GET /api/v1/employees?limit=20` | 1 | 38.2 | 25.24 ms | 33.48 ms | 37.46 ms | 0 |
| `GET /api/v1/employees?limit=20` | 8 | 124.9 | 62.60 ms | 79.66 ms | 88.49 ms | 0 |
| `GET /api/v1/employees?limit=20` | 32 | 134.4 | 236.93 ms | 277.15 ms | 303.24 ms | 0 |

Operational: process spawn → first successful health 3.59–4.20 s; idle RSS 122.1/122.2 MB with 16
threads; 87.4 MB → 244.6 MB RSS across the 60 s load matrix; cold full build 38.7 s wall (turbo
36.284 s, 0 cached); backend artifacts ≈1.22 MB.

Method notes:

- Environment: Windows 11, i5-13450HX (10C/16T), 16 GB; Node v22.20.0; PostgreSQL 16.9 in the
  existing `h-os-postgres` container; one API process, pool 10, `NODE_ENV=development`.
- The API was already running (PID 7760, started 2026-11-01 21:53) and was reused. `pnpm build` was
  a cache hit and no source file changed, so it served the committed build. It was not restarted and
  no data was written; the two employees and two accounts are the Phase One development fixtures.
- Client: a 60-line Node `http` script kept in
  `C:\Users\Mohamed\AppData\Local\Temp\opencode\hos-loadgen.mjs`, outside the repository. **k6 is
  not installed**, so this is a baseline generator, not a standards-compliant load tool.
- Data volume is two employee rows. The authenticated numbers measure fixed per-request work (four
  session/RBAC queries + one keyset query), not PostgreSQL under volume. Client and server share
  the same CPU. Numbers are not transferable to Linux containers or to other runtimes.
- No Go, .NET or Spring candidate was benchmarked: doing so requires implementing them, which the
  task forbids. The comparative benchmark is specified, labelled **proposed**, and not executed.

## 6. Validation commands (actually run, on this branch)

| Command | Result |
|---|---|
| `pnpm governance` (before changes) | graph current (19 nodes, 28 edges); 157 rules, 7 decisions; 9 packages |
| `pnpm graph:generate` | `Wrote .caliper/graph/graph.json and graph.md (19 nodes, 28 edges).` |
| `pnpm governance` (after changes) | graph current (19 nodes, 28 edges); `Governance is valid: 158 rules across 1 principle sets, 8 decisions.`; `Architecture is valid: 9 packages checked.` |
| `pnpm lint` | `Tasks: 9 successful, 9 total` (6 cached) |
| `pnpm typecheck` | `Tasks: 12 successful, 12 total` (9 cached) |
| `pnpm test` | `Tasks: 12 successful, 12 total`; api 20 tests (18 integration + 2 unit), hr-api 37 tests, all other suites cached |
| `pnpm build` | `Tasks: 5 successful, 5 total` (fully cached) |
| `pnpm build --force` | `Tasks: 5 successful, 5 total`, 0 cached, turbo 36.284 s; wall 38.7 s |

## 7. Governance defect found (not fixed — needs its own Decision)

`tools/principles/validate.mjs` rejects a decision that sets `review_by` without relaxing a rule
(`DEC-006`). `DEC-0001` does exactly that (`relaxes: []`, `review_by: 2027-10-29`) and should fail,
but the validator passes.

Root cause, reproduced with a standalone Node script: `parseFrontMatter` slices the front matter up
to the `\n` before the closing `---`, leaving a trailing `\r` on the last line of a CRLF file. The
key regex `^([a-z_]+):\s*(.*)$` cannot match because `.` does not match `\r` and `$` (without the
`m` flag) only matches end of input. **The last front-matter line is therefore silently dropped on
CRLF files.** For `DEC-0001` that line is `review_by`, so the invalid relaxation metadata is
invisible to CI. `DEC-0003`, `DEC-0006` and `DEC-0007` are unaffected in practice (valid or empty
`review_by`), but the parser behaviour is wrong for any future last-line key.

Fixing it means editing `tools/principles/validate.mjs` (or normalising line endings), which is a
governance-tooling change and needs its own Decision; it was out of scope here. It is recorded now so
the owner can approve the fix. Until then, do not rely on `review_by` validation for CRLF files.

## 8. Git state

- Branch: `refactor/platform-backend-technology-reevaluation`, created from `86d1f08`.
- The user-suggested `REFACTOR/backend-technology-reevaluation` does not satisfy `GIT-002`
  (`<type>/<app>-<desc>`, lowercase type, app segment), so the conventional form was used.
- `git ls-remote origin HEAD` now succeeds (`86d1f08…`), contrary to the Phase One worklog's
  "Repository not found"; the remote is reachable for reads. No fetch, push or merge was performed
  before this log was written.
- No PR exists yet. `gh` is not installed, so a PR cannot be opened from here without an API token.
- No commit to `main`; `main` remains at `730cc77`.

## 9. What was deliberately not changed

- No backend implementation, migration, dependency, lockfile, Dockerfile, Compose service, CI step,
  frontend file or database row.
- No historical Decision was rewritten or deleted; no candidate was marked accepted.
- No Redis, broker, microservice or second runtime was introduced (`STK-010`, `STK-012`).
- The development database fixtures were not modified, apart from the login session row created to
  authenticate the benchmark (normal application behaviour, not a data edit).

## 10. Open questions

Repeated from `DEC-0008` for visibility: deployment model (per-customer containers vs managed
multi-tenant), expected payroll/report volumes, whether a non-TypeScript team is realistic, whether
the leave engine may proceed on NestJS while the benchmark runs, whether shared Zod contracts are a
fixed commitment, and whether a dedicated review status should be added to `DEC-002`.
