# H-HR — Phase One hardening and acceptance review

- **Date:** 2026-10-29
- **Branch:** `chore/platform-repo-bootstrap` (one commit `730cc77`; all bootstrap and Phase One
  work is **uncommitted** in the working tree as staged renames plus untracked files)
- **Task:** Review and harden the delivered platform bootstrap and H-HR Phase One before the leave
  engine. No leave, attendance, payroll or new HR features.
- **Status of this document:** initial evidence log (part 1). Findings, changes and final results
  are appended below as they happen; nothing in here is committed.

---

## 1. Repository state (measured, not assumed)

| Fact | Value |
|---|---|
| Branch | `chore/platform-repo-bootstrap` |
| Commits | `730cc77 chore(repo): import H-OS parent and H-HR principles` (only commit; `main` points to the same commit) |
| Stash | empty |
| Remote | `origin = https://github.com/HiraTechLabs/H-OS.git` (fetch and push) |
| Remote reachability | git reports "Repository not found" — investigated separately in part 2 |
| Uncommitted work | staged renames `H-OS/…` → root `.caliper/…` and `H-HR/…` → `apps/hr/.caliper/…`; untracked: `platform/`, `apps/hr/{api,web,docs}`, `apps/hr/.caliper/decisions/`, `.caliper/decisions/DEC-0002…0007`, `.caliper/graph/`, `docs/`, `AGENTS.md`, workspace/tooling configs, `infra/`, `.github/` |
| Docker | `h-os-postgres` running (PostgreSQL 16, host port 5433) |
| Preserved | **nothing discarded, reset or removed; no commit or merge created** |

The uncommitted tree is exactly the delivered Phase One work. It must survive this task intact.

## 2. Files reviewed before editing

### Governing documents

- `AGENTS.md` (rete root), `.caliper/principles/CORE.md`
- `.caliper/principles/security.md` (SEC-001…015 actually read), plus `git.md`, `test.md` tagging
  knowledge from the CORE digest and delivery reports
- `.caliper/decisions/DEC-0001…DEC-0007` (statuses confirmed: 0001–0004, 0006, 0007 accepted;
  0005 **proposed**; no accepted decision was modified)
- `apps/hr/.caliper/06-security-privacy.md`, `apps/hr/.caliper/05-access-integrations.md`,
  `apps/hr/.caliper/00-domain.md`, `apps/hr/.caliper/decisions/HR-DEC-0001`,
  `HR-DEC-0002`
- `docs/worklogs/2026-10-29-h-hr-phase-01-delivery.md` and
  `docs/worklogs/2026-10-29-h-hr-phase-00-audit.md`
- `.github/workflows/ci.yml`, `.env.example`, `infra/compose/docker-compose.yml`

### Platform kernel (security surface)

- `platform/kernel/src/auth/session.service.ts` — session issue/resolve/revoke, lockout, idle
  timeout, `revokeAllForAccount`, `disableAccount`
- `platform/kernel/src/auth/auth.guard.ts` — default-deny global guard, `@Public()` opt-out
- `platform/kernel/src/auth/auth-provider.ts` — argon2id (m=19456, t=2, p=1), fail-closed verify
- `platform/kernel/src/auth/actor.ts`, `platform/kernel/src/auth/account-directory.service.ts`
- `platform/kernel/src/rbac/permission.service.ts` — deny-by-default, scope widening helper
- `platform/kernel/src/audit/audit.service.ts` — in-transaction audit, sensitive-key redaction
- `platform/kernel/src/outbox/outbox.service.ts` — enqueue + dispatcher, attempts/last-error
- `platform/kernel/src/db/schema.ts` (10 platform tables), `db/client.ts`, `db/database.provider.ts`
- `platform/kernel/src/http/problem.filter.ts`, `http/zod-validation.pipe.ts`,
  `http/request-context(.middleware).ts`
- `platform/kernel/src/config.ts`, `errors.ts`, `kernel.module.ts`, `index.ts`

### Composition API and H-HR backend

- `platform/api/src/main.ts` (CORS, cookie plumbing absent here), `app.module.ts`
- `platform/api/src/auth/auth.controller.ts` (login/logout/me, cookie flags)
- `platform/api/src/bootstrap/seed.ts`, `seed-cli.ts` (roles, permissions, bootstrap admin)
- `platform/api/test/integration/hr-phase-one.test.ts` (11 HTTP tests, Testcontainers)
- `apps/hr/api/src/hr.module.ts`, `application/ports.ts`
- `apps/hr/api/src/presentation/employee.controller.ts`, `organization.controller.ts`
- `apps/hr/api/src/application/hr-actor-scope.service.ts` and every employee/organization use case
  (create, list, get-profile self, update, change-status, change-assignment, change-manager,
  link-account, emergency contact, document reference; organization create cases)
- `apps/hr/api/src/infrastructure/employee.repository.ts` (scope conditions in SQL), employment,
  assignment, organization, timeline repositories, `field-cipher.ts`, `schema.ts`
- `apps/hr/api/src/domain/*` (employment-status machine, business-date, employee-number,
  org-unit-path ltree helpers)
- `apps/hr/api/src/application/employee-change-recorder.ts`, `profile-mapper.ts`

### Web shell, contracts, tooling

- `platform/contracts/src/identity.ts`, `hr/employee.ts`, `problem.ts`, `events.ts`
- `platform/client/src/{client,session,permissions,format}.ts`
- `platform/web/src/{router,App,main}.tsx`, `shell/*`, `screens/*`
- `apps/hr/web/src/**` (screens, navigation, i18n catalogs)
- `tools/graph/generate.mjs`, `tools/principles/validate.mjs`, `tools/arch/check.mjs`

## 3. Development database fixtures (measured, preserved)

Queried via `docker exec h-os-postgres psql -U h_os -d h_os`:

| Record | Origin | Disposition |
|---|---|---|
| `hr.branch HQ` (23:33:19) | created by the earlier delivery session (`db:seed`/bootstrap via UI create flow) | seed/reference data; keep |
| `hr.branch QA-BR` "QA Branch"/"فرع الاختبار" | manual UI smoke test (delivery report §4) | manual smoke-test artifact; **kept**, not deleted |
| `EMP-00001`, `EMP-00002` employees | manual UI smoke test | manual smoke-test artifacts; kept |
| `employee_status_transition` rows: `active→notice_period` "Resignation received", `notice_period→active` "QA localisation check", `→active` "QA localisation check revert" | manual UI smoke test (the last two are the reported status-history changes) | append-only history; **not rewritten** |

Nothing in this table is production data. No automatic deletion performed.

## 4. Initial security-review observations (to be confirmed/acted on)

1. **Account-link permission mismatch (confirmed by source).** The delivery report §2 states
   `POST /employees/:id/account-link` checks `platform.account.manage`; the code
   (`link-account.use-case.ts:34`) checks only `hr.employee.update`. Same for the optional
   `accountId` in `create-employee`. Fix planned: require `platform.account.manage` in addition to
   the employee permission, with regression tests.
2. **No account-management API (known limitation #1 in the delivery report).** `platform.account.manage`
   exists as a permission and `DEC-0003` (accepted) scopes RBAC account tables into the kernel;
   the minimum create/assign/revoke/disable capability is implementable under existing decisions.
3. **SEC-011 CSRF.** State-changing cookie requests rely on `SameSite=Lax` only. Origin-check
   middleware for unsafe methods planned (no new framework).
4. **SEC-011 auth rate limiting.** Per-account lockout exists (5 attempts/15 min, delivered);
   there is no per-IP limiter, so an attacker gets unbounded network attempts against unknown
   accounts. A small in-process fixed-window limiter on `POST /auth/login` planned.
5. **Secure headers** (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`) are not set.
6. **`registerFailedAttempt` is a read-modify-write** — concurrent failures can lose counts. Small
   atomic-SQL fix planned.
7. Verified-strong already: session token 256-bit random, stored only as SHA-256 hash, unique
   index; HttpOnly/SameSite cookie; idle timeout + absolute TTL; revocation on termination
   (SEC-014, tested); grants resolved per request; argon2id OWASP parameters; indistinguishable
   wrong-password/unknown-email responses (tested, plus dummy hash burn for row-less lookups);
   fail-closed argon2 verify; audit written inside the state-change transaction (SEC-007) with
   redaction and tested absence of PII in audit rows; outbox in the same transaction with
   attempt counters and failure visibility; deny-by-default guard + use-case checks; data scope
   applied in SQL (`ltree <@`), not in memory; masked identifiers and encrypted sensitive columns
   with an HMAC lookup hash; Zod strict schemas at every boundary; RFC 9457 with generic 500
   bodies and production-only diagnostics in logs.

## 5. Plan

1. Fix 1, 3, 4, 5, 6 with regression tests (kernel unit tests + extended HTTP integration suite).
2. Implement the minimum account-management capability (create, list, assign/revoke role,
   disable) in the kernel + composition API, audited, with escalation/self-modification guards
   and integration tests covering administration, role assignment, linking, self-service and
   restricted scope — replacing the raw-SQL account creation in the integration test.
3. Record ambiguities that need a human decision instead of a silent rule.
4. Re-run lint, typecheck, test, build, governance; regenerate the graph if structure changed.
5. Investigate the unreachable `origin` without exposing credentials.
6. Append final results and acceptance verdict to this file.

Everything above describes work **before** the first code edit; the changes themselves follow.

---

# Part 2 — changes, evidence and verdict (2026-10-30)

## 6. Security findings and their resolution

| # | Finding | Severity | Resolution | Test evidence |
|---|---|---|---|---|
| S-1 | `link-account` and employee-create-with-`accountId` checked only `hr.employee.update`, not `platform.account.manage` — diverged from the delivery report and from the declared RBAC model | high | Both use cases now require `platform.account.manage` in addition to the employee permission | Integration: denied administration test (hr_officer link attempt → 403) |
| S-2 | No account-management capability existed (`platform.account.manage` was a dead permission) | high (feature gap, not exploit) | Minimum capability per DEC-0003: `AccountManagementService` in the kernel (list / create / assignRole / revokeRole / disable), scope `all` required, org-confined, self-modification forbidden, audited in-transaction; `PlatformAccountController` exposing `GET/POST /api/v1/platform/accounts`, `POST :id/roles`, `DELETE :id/roles/:roleCode`, `POST :id/disable`. No outbox event, no UI screen (minimum only) | Integration: create/list/duplicate/weak-password/unknown-role, denied administration, self-modification guards, role assign/revoke, disable-revokes-sessions, audit-trail content — 12 new tests |
| S-3 | CSRF: cookie-authenticated state-changing requests relied on `SameSite=Lax` only (form-based cross-site POSTs still carry cookies) | high | `securityHeadersMiddleware` + `createCsrfOriginGuard(config)`: unsafe methods with an `Origin` header must match the API origin or `CORS_ORIGINS`; wired in `platform/api/src/main.ts` and mirrored in the integration harness | Integration: attacker origin → 403; allowlisted origin reaches credential check (401); kernel unit: 5 guard cases |
| S-4 | Unbounded unauthenticated login attempts per source address | medium | `FixedWindowRateLimiter` (in-kernel, in-process) wired into `AuthController.login` **before** `authenticate`; `LOGIN_RATE_LIMIT` config (default 20, documented in `.env.example`) | Kernel unit: window/isolation/reset; API unit: controller-level blocking before credentials; Phase One integration suite ran ~250 credential requests against the same route without tripping it |
| S-5 | No baseline secure headers | low | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `Referrer-Policy: same-origin` on every response | Integration: `sets baseline secure headers on every response`; kernel unit: header values |
| S-6 | `registerFailedAttempt` was read-modify-write (lost concurrent counts) | medium | Atomic single-statement increment + `case` lock decision (see §7 for the two defects this rewrite itself introduced, now fixed and tested) | Integration: wrong-password path returns 401 and writes the counter (suite green end to end) |
| S-7 | Duplicate account creation silently succeeded (HTTP 201 with a fabricated `accountId`) because `onConflictDoNothing` masked the unique violation; the "unique index is the authority" catch was unreachable | high (data integrity) | Plain insert in `create`; `isUniqueViolation` fixed to walk the drizzle `cause` chain (`DrizzleQueryError` hides `23505`) | Diagnostic run: `PostgresError code=23505 duplicate key ... "account_email_unique"` at depth `[1]` of the error chain; integration: duplicate → 409 `conflict` |

Verified strong (from part 1, unchanged): hashed-at-rest session tokens, HttpOnly/SameSite cookie
with TTL + idle timeout, deny-by-default guard, SQL-level data scoping (`ltree <@`), audited
in-transaction state changes without PII/credentials, argon2id with OWASP parameters and
indistinguishable credential errors, Zod strict boundaries, RFC 9457 with generic 500 bodies.

**Documented ambiguity (not invented):** which role holder may grant which role (dynamic
assignment policy) is organization policy, not code. Nothing beyond the static guards
(`platform.account.manage` @ `all`, org confinement, no self-modification) is enforced; a human
decision is required before code is added. Noted in the service header comment.

## 7. Defects introduced and caught during this hardening (full-cycle evidence)

The rewrites above first landed with three real defects that the test pipeline caught in order:

1. `registerFailedAttempt` embedded a `Date` in a raw drizzle `sql` template →
   `TypeError: The "string" argument must be ... Received an instance of Date` from postgres.js
   (wrong-password login returned 500 instead of 401; reproduced empirically with a
   throwaway Testcontainers probe against the exact statement, then the probe file was deleted).
   Fix: pass the lock instant as an ISO string. Second failure mode found the same way:
   `PostgresError 42804 — column "locked_until" is of type timestamp with time zone but
   expression is of type text` (postgres.js binds a bare string param as text); final fix adds an
   explicit `::timestamptz` cast in the `case` expression and documents why in the code.
2. S-7 (conflict masking) — diagnosed with the same probe method (error-chain dump showing
   `DrizzleQueryError → PostgresError 23505`).
3. Kernel unit `security-shield.test.ts` bugs (test code, never executed before): the response
   mock stored header names as passed while assertions read lowercase (mock now lowercases, like
   Express); "`createCsrfOriginGuard(...).length`" returned the handler arity (3), not the
   allowlist (now asserts via `csrfAllowedOrigins(...)`); `const { limiter } = limiter(3)` hit a
   TDZ shadow (helper renamed `createLimiter`). The rate-limit unit test also asserted the
   wrong boundary — the limiter admits `limit` attempts and blocks attempt `limit+1`; tests now
   state that boundary explicitly.

## 9. Changed files

**Kernel (`platform/kernel`)**

- `src/auth/account-management.service.ts` — **new** (see S-2)
- `src/auth/rate-limiter.ts` — **new** (`FixedWindowRateLimiter`, `RateLimiterClock`)
- `src/http/security.middleware.ts` — **new** (see S-3, S-5)
- `src/auth/session.service.ts` — `revokeAllForAccountWithin` (transactional session sweep),
  atomic `registerFailedAttempt` with the timestamptz-cast fix (S-6, §7)
- `src/errors.ts` — `RateLimitedError` (429 `rate_limited`)
- `src/config.ts` — `LOGIN_RATE_LIMIT` parsed (`z.coerce`, 1..1000, default 20)
- `src/kernel.module.ts`, `src/index.ts` — new symbols registered/exported
- `test/security-shield.test.ts` — **new** (9 tests); `test/helpers/express-mocks.ts` — **new**

**Contracts (`platform/contracts`)**

- `src/identity.ts` — `CreateAccountRequestSchema`, `RoleAssignmentRequestSchema`,
  `AccountStatusSchema`, `AccountSummarySchema`, `AccountListResponseSchema`

**Composition API (`platform/api`)**

- `src/platform/platform-account.controller.ts` — **new**
- `src/app.module.ts`, `src/main.ts` — controller registration; shield middleware wired
- `test/unit/auth-controller.test.ts` — **new** (rate limiting at the controller boundary)
- `test/integration/hr-phase-one.test.ts` — 7 new tests, raw-SQL account creation replaced by the
  accounts API, `origin` option on the `api()` helper, shield middleware mirrored in `beforeAll`
- `vitest.integration.config.ts` — include broadened to `test/**/*.test.ts` (unit tests now run)

**H-HR (`apps/hr/api`)**

- `src/application/employee/link-account.use-case.ts`, `create-employee.use-case.ts` —
  `platform.account.manage` required (S-1)

**Root**

- `.env.example` — `LOGIN_RATE_LIMIT=20` documented
- `.caliper/graph/graph.json`, `graph.md` — regenerated (`pnpm graph:generate`; still untracked,
  still no commit)

**Not an acceptance-worthy change:** `docs/worklogs/…` (this file, part 1 + 2).

## 9. Verification (commands actually run, outputs quoted)

| Command | Result |
|---|---|
| `pnpm --filter @h-os/api typecheck` / `pnpm --filter @h-os/hr-api typecheck` | pass (clean tsc) |
| `pnpm typecheck` | `Tasks: 12 successful, 12 total` |
| `pnpm lint` | `Tasks: 9 successful, 9 total` |
| `pnpm test` | `Tasks: 12 successful, 12 total` — kernel 9 tests; api **20** (18 integration + 2 unit); hr-api 37; web-client 7; hr-web 4; i18n 6 |
| `pnpm build` | `Tasks: 5 successful, 5 total` (kernel/contracts/hr-api tsc builds up to date or cache-hit; api tsc build passes; web `vite` build ends `✓ built in 3.00s`; only pre-existing `"use client"` bundler notices) |
| `pnpm graph:generate` | `Wrote .caliper/graph/graph.json and graph.md (19 nodes, 28 edges).` — unchanged counts: the graph is package-level and no package was added |
| `pnpm governance` | `graph:check` → `Architecture graph is current (19 nodes, 28 edges).`; `principles:check` → `Governance is valid: 157 rules across 1 principle sets, 7 decisions.`; `arch:check` → `Architecture is valid: 9 packages checked.` |

Final `pnpm test` integration excerpt (after all fixes):

```
 ✓ test/integration/hr-phase-one.test.ts (18 tests) 9431ms
 ✓ test/unit/auth-controller.test.ts (2 tests) 9ms
 Test Files  2 passed (2)
      Tests  20 passed (20)
```

## 10. Git and remote investigation (no credentials exposed)

Measured (safe probes only):

- `git remote -v` → `origin = https://github.com/HiraTechLabs/H-OS.git` (fetch and push)
- `git ls-remote origin HEAD` with `GIT_TERMINAL_PROMPT=0` →
  `remote: Repository not found.` then `fatal: repository 'https://github.com/HiraTechLabs/H-OS.git/' not found`
- Anonymous GitHub API: `GET /repos/HiraTechLabs/H-OS` → **404**; `GET /orgs/HiraTechLabs` → **404**
- Credential helper is Windows Credential Manager (`git config credential.helper` → `manager`);
  a non-interactive `git credential fill` probe would have opened a UI prompt, so it was aborted —
  no credential was read, stored or printed
- `gh` CLI is not installed, so no authenticated API check was possible

Interpretation: both URLs are **404 for anonymous requests**; an anonymous 404 cannot distinguish
"a private repo I cannot see" from "no such repo/org". The credentialed `git ls-remote` also failed,
which means either no valid stored credential exists for github.com or the authenticated identity
lacks access (or the repo genuinely does not exist yet). This requires a human with access.

**Actions NOT taken:** no `fetch`, no `push`, no LFS, no remote URL change, no commits, no merges,
no stashes, no discards. The working tree at the end of this task holds the same staged renames
plus untracked Phase One work (55 `git status --porcelain` entries, committed base still `730cc77`).

The remote blocker needs exactly one human action: create/secure the `HiraTechLabs/H-OS` GitHub
repository (or run `git ls-remote origin` interactively once so Credential Manager can
authenticate and we learn the real failure). Nothing in the code should change because of this.

## 11. Acceptance verdict

**Locally: Phase One hardening is acceptance-ready.** All required gates pass (`lint`, `typecheck`,
`test`, `build`, `governance`), every security finding from part 1 is fixed with regression tests,
one additional high-severity data-integrity bug (S-7) was found and fixed en route, and the
development fixtures documented in part 1 were left untouched.

**Globally: two human decisions remain possible blockers.**

1. The GitHub remote is unreachable (`Repository not found`) — creation/access decision needed
   before anything can be committed and pushed; CI (`.github/workflows/ci.yml`) cannot run until
   the repository exists.
2. The dynamic role-assignment policy (who may grant which role) is documented as organization
   policy, not enforced by code — an explicit decision is requested before the leave engine phase.

Next step on approval: start the leave engine per `apps/hr` planning documents — not before.
