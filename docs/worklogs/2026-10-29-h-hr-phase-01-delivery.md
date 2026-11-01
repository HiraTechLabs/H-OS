# H-HR — Phase One delivery (bootstrap + employee/organization foundation)

- **Date:** 2026-10-29
- **Branch:** `chore/platform-repo-bootstrap` (baseline import commit `730cc77` on `main`)
- **Approved scope:** platform bootstrap + Phase One only. No leave, attendance, payroll or
  self-service extensions in this delivery.
- **Companion documents:** `docs/worklogs/2026-10-29-h-hr-phase-00-audit.md` (audit and plan),
  `apps/hr/docs/ui-spec.md` (screens and states).

---

## 1. What shipped

### 1.1 Platform bootstrap

| Area | Delivered |
|---|---|
| Workspace | pnpm workspace (`platform/*`, `apps/*`, `apps/*/*`), Turborepo task graph, one strict `tsconfig.base.json`, ESLint 9 flat config, Prettier |
| Kernel (`platform/kernel`) | Identity and sessions, argon2id passwords, roles and permissions, deny-by-default global guard, org-scope resolution, audit recorder, transactional outbox with dispatcher, problem-details filter, request/trace context, field cipher |
| Contracts (`platform/contracts`) | Zod schemas and types for identity, HR employees, organization, events, links, problem details, permission constants |
| Composition API (`platform/api`) | One Nest application mounting kernel + H-HR, health endpoint, bootstrap seeding, session cookie auth |
| Shared web packages | `@h-os/i18n` (catalogs, resolver), `@h-os/ui` (tokens + primitives), `@h-os/web-client` (fetch client, session provider, permission helpers, formatters) |
| Shell (`platform/web`) | One React application: TanStack Router routes, TanStack Query, session gate, sign-in, launcher, navigation, language switcher, mobile drawer, forbidden/not-found/boot states |
| Repository tooling | Architecture graph generator, principle/decision validator, import-boundary checker, GitHub Actions workflow |
| Infrastructure | `infra/compose/docker-compose.yml` (PostgreSQL 16, host port 5433), `.env.example` |

### 1.2 H-HR Phase One

| Area | Delivered |
|---|---|
| Employee records | Create, list/search (cursor pagination, 6 filters), profile, effective-dated update, status change, assignment change, manager change, account link, emergency contacts, document references, audit timeline |
| Employment model | Employment episodes with an 8-state lifecycle (`pending_start`, `active`, `probation`, `suspended`, `notice_period`, `terminated`, `retired`, `cancelled`), contracts, half-open effective ranges `[validFrom, validTo)` (`HR-DEC-0001`) |
| Organization | Branches, work locations, org units with materialized path, job titles, job grades, work schedules with per-weekday hours and unpaid breaks |
| Security | Server-side authorization on every operation, data-scope resolution per caller, masked identifiers (`****7890`), field encryption for national ID and passport, session revocation on employment end |
| UI | Directory, create form, profile with 8 sections and inline action panels, organization with 6 tabs and 6 create forms, self-service entry, shell integration, Arabic/RTL |
| Tests | 37 H-HR unit tests, 11 HTTP integration tests, 6 i18n, 7 web-client, 4 catalog-parity |

### 1.3 Database

Two Drizzle migrations, applied to the local database and committed:

- `platform/kernel/migrations/0000_careful_celestials.sql` — `platform` schema: organization,
  account, role, permission, role_permission, account_role, session, audit_record, outbox_event,
  entity_link (10 tables).
- `apps/hr/api/migrations/0000_magenta_vargas.sql` — `hr` schema: branch, work_location, org_unit,
  org_unit_history, job_title, job_grade, work_schedule, employee, employee_person,
  employee_contact, emergency_contact, employment_episode, employment_contract,
  employee_org_assignment, employee_manager_assignment, employee_status_transition,
  employee_account_link, employee_document_ref, employee_timeline, employee_number_sequence
  (20 tables).

Each module keeps its own journal (`__drizzle_migrations` and `__drizzle_migrations_hr`), so the
apps migrate independently while sharing one database.

## 2. Authorization coverage

Every business endpoint is guarded and additionally checks a permission with a data scope:

| Endpoint group | Permission | Scope behaviour |
|---|---|---|
| `GET /employees`, `GET /employees/:id` | `hr.employee.read` | `all` sees everyone; narrower scopes restrict to the caller's subtree or self |
| `GET /employees/me` | `hr.employee.read` | Resolves the caller's own record; unlinked account gets 403 |
| `POST /employees` | `hr.employee.create` | Assignment must fall inside the caller's scope |
| `PATCH /employees/:id` | `hr.employee.update` | Same scope check as read |
| `POST /employees/:id/status` | `hr.employee.change_status` | also validates the lifecycle transition in the domain |
| `POST /employees/:id/assignment`, `/manager` | `hr.employee.update` | Target unit/manager must be inside scope |
| `POST /employees/:id/account-link` | `platform.account.manage` | One employee per account, one account per employee |
| `POST /employees/:id/emergency-contacts`, `/documents` | `hr.employee.update` | — |
| `GET /organization` | `hr.organization.read` | Caller sees the structure it may assign into |
| `POST /organization/*` (6 endpoints) | `hr.organization.manage`, scope `all` | Org-unit creation additionally requires the parent inside scope; roots require `all` |
| Identity fields (national ID, passport, date of birth) | `hr.employee.read.sensitive` | Without it the profile omits the identity section; values are masked before leaving the server |
| Audit timeline | returned with the profile | Entries carry actor and reason; no PII in the payload |

The integration suite proves the scope rules end to end, including a self-service account that gets
403 for another employee and for a create attempt.

## 3. Verified commands

Run on Windows 11, Node 22, pnpm 9.15.0, PostgreSQL 16 in Docker (`h-os-postgres`, host port 5433).

| Command | Result |
|---|---|
| `pnpm lint` | **9/9 tasks pass**, 0 errors |
| `pnpm typecheck` | **12/12 tasks pass** |
| `pnpm test` (`turbo run test --force`, no cache) | **12/12 tasks pass**, 0 cached: hr-api **37**, api **11**, i18n **6**, web-client **7**, hr-web **4** = 65 tests; kernel and ui exit 0 with no test files |
| `pnpm build` | **5/5 tasks pass**; shell bundle plus one chunk per HR screen, CSS contains design tokens and component classes |
| `pnpm governance` | graph current (19 nodes, 28 edges), **157 rules / 7 decisions valid**, **9 packages** within import boundaries |
| `pnpm --filter @h-os/hr-api test` | 6 files, 37 tests pass |
| `pnpm --filter @h-os/api test` | 1 file, 11 tests pass (Testcontainers PostgreSQL) |

No test, lint or build result in this document is inferred; each row is a command that ran in this
session.

## 4. Live UI smoke test

Environment: Vite dev server on `http://localhost:5173` proxying `/api` to the API on
`http://localhost:3100`, seeded database, bootstrap administrator `admin@h-os.local`.

| Flow | Result |
|---|---|
| Sign in | Succeeds; shell renders launcher with three app cards |
| Employee directory | Real seeded rows (`EMP-00001`, `EMP-00002`), status badges, search/filter/pagination controls |
| Employee profile | All eight sections render; masks show `****`; timeline, assignment and manager history present |
| Organization → Units tab | Table plus create-unit panel with dependent branch/parent selects |
| Organization → Branches → create | Created `QA-BR` ("QA Branch" / "فرع الاختبار"); the list refreshed from the server without a reload |
| `/me` unlinked account | Explained empty state ("Your account is not linked to an employee record") instead of a raw 403 |
| Arabic switch | `<html lang="ar" dir="rtl">`, translated navigation, tables, badges, pagination and form labels |
| Console | No application errors; the only entries are the expected 401 on the first anonymous `/auth/me` and the expected 403 from `/me` for an unlinked account |

RTL geometry was checked numerically (no horizontal overflow, brand at the trailing edge, `dir="rtl"`
on the document) and with element-level screenshots; full-viewport captures of an RTL document are
offset by the desktop capture pipeline, so they were not used as evidence.

The smoke test created one branch (`QA-BR`) and two status-history rows in the local development
database. No production data exists.

## 5. Defects found and fixed during verification

| Defect | Fix |
|---|---|
| Profile rendered literal `{{from}}`/`{{to}}` text: two table headers reused a sentence key | Headers now use the label key `hr.profile.range`; the unused sentence keys were removed |
| Audit summary leaked status codes ("changed from active to notice_period") | `employmentStatusLabel()` in the domain maps status codes to bilingual labels; summaries now read "from active to notice period" |
| TanStack `lazyRouteComponent` logged `use() ... did not call use()` on every navigation | Screens load through `React.lazy` with one `Suspense` boundary inside the shell |
| Search filter panel's selected tab was styled with an inline colour instead of a class | Added `.hos-tab` / `.hos-tab[aria-selected]` to `@h-os/ui` |
| `useForm().watch()` triggered React Compiler warnings | Switched to `useWatch()` |
| Lint: type-only Nest imports, useless regex escape, duplicate `hos-select` class | Fixed at the source; `@Inject(...)` added where a value import was needed |
| `@h-os/kernel test` failed with "no test files found" | `--passWithNoTests`, matching the other packages |
| Scheduler warned "no output files" for `test` tasks | `outputs: []` declared in `turbo.json` |

Rows written to the audit timeline before the label fix still contain the old codes: history is
never rewritten, by design. The seeded development rows were left unchanged.

## 6. Decisions

| Decision | Status | Effect |
|---|---|---|
| `DEC-0001` backend stack | accepted | Nest + Drizzle + PostgreSQL, chosen earlier |
| `DEC-0002` repository layout | accepted | Principles and decisions at the git root; `platform/`, `apps/`, `docs/` |
| `DEC-0003` kernel scope | accepted | Workflow belongs to the kernel; relaxes `ARCH-013` for the approved scope |
| `DEC-0004` design tokens and shell | accepted | One shell, tokens in `@h-os/ui`, no second UI framework |
| `DEC-0005` money and rounding | **proposed** | Blocks payroll work; nothing in Phase One stores money |
| `DEC-0006` architecture graph generator | accepted (new) | `tools/graph/generate.mjs`; graph generated, checked in CI |
| `DEC-0007` principle file validation | accepted (new) | `tools/principles/validate.mjs`; grammar and front matter enforced |
| `HR-DEC-0001` episodes and lifecycle | accepted | Employment episodes with 8 states |
| `HR-DEC-0002` payroll engine | accepted | Jurisdiction-neutral engine; not implemented yet |

## 7. Known limitations

1. **No second login of a restricted role.** The bootstrap seeder creates only the administrator
   account; there is no account-management API yet, so a scoped-role account cannot be created
   through the product. The self-service scope rules are covered by the integration test, not by a
   manual browser sign-in.
2. **Rehire is modelled but not exposed.** The lifecycle accepts `terminated → pending_start`; the
   status endpoint deliberately rejects `toStatus: 'pending_start'` until the rehire operation
   (new episode, new assignment) exists.
3. **Organization structure is create-only.** No rename, move or archive for units, branches,
   locations, titles, grades or schedules.
4. **Document references only.** No upload, no file bytes, no archive service; the reference is an
   archive id owned by a future service.
5. **No export, import or bulk operations.** `hr.employee.export` is defined but unused.
6. **No end-to-end browser automation.** The Playwright/axe suite is planned for the last phase; this
   delivery was smoke-tested manually through the in-app browser.
7. **Remote unreachable.** `origin` returns "Repository not found" from this machine, so no PR, no CI
   run and no merge happened; the GitHub Actions workflow is committed but has never executed.
8. **Development credentials.** The local password and session secret are development-only values in
   `.env.example` and the local start script; they are not production configuration.

## 8. Payroll and legal assumptions

- Nothing in this delivery calculates pay, tax, social insurance or leave entitlement, so no
  jurisdiction-specific rule is asserted.
- Working time is stored as schedule data (start, end, unpaid break, rest days) without interpreting
  labour-law limits.
- Employment statuses, end reasons and document classifications are organization-defined strings and
  lists, not statutory codes.
- `DEC-0005` (money representation) remains proposed; payroll cannot start until it is accepted with a
  currency and a rounding policy.

## 9. Recommended next task

**Leave engine (phase 5 in the plan), starting with the accrual model**: leave types, policy versions,
an append-only ledger and balance reconstruction. It is the next module that can be built without
`DEC-0005`, and it exercises the effective-dating and audit machinery already delivered.

Before that, one small hardening task is worth doing: add the account-management endpoints
(`platform.account.manage` already exists as a permission) so a scoped account can be created and the
permission matrix can be exercised against the UI rather than only against the HTTP tests.
