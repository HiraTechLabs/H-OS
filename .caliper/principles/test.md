# Test Principles (TEST)

### TEST-001 [must|ci] testing
Test pyramid: unit tests for domain logic (fast, no I/O), integration tests for use cases against a real PostgreSQL via Testcontainers, and a small set of Playwright end-to-end tests for critical journeys only.

### TEST-002 [must|ci] testing
Every use case has tests. Every bug fix starts with a failing regression test that is committed with the fix.

### TEST-003 [must|ci] testing
Coverage gates ratchet upward and never drop: domain layer at least 90% lines, whole project at least 80%.

### TEST-004 [must|test] permissions, testing
Every permission has an allow test and a deny test, including each data scope (own, subtree, unit, all).

### TEST-005 [must|review] testing
Tests are deterministic: inject a clock and random sources, no real network, no sleeps, no order dependence.

### TEST-006 [must|review] testing
Test names state behavior. Structure is arrange, act, assert. One behavior per test.

### TEST-007 [must|ci] api, events, testing
Architecture tests (dependency-cruiser) and contract tests (OpenAPI, event schemas) run in CI. A breaking contract change fails the build.

### TEST-008 [must|review] testing
Do not mock what you own. Use fakes for repositories in unit tests and mock only external boundaries.

### TEST-009 [should|ci] money, testing
Run mutation testing periodically on critical domain modules (payroll, ledger, approvals).

### TEST-010 [must|ci] migration, testing
Migrations apply from an empty database and from the previous release snapshot. Each migration is backward-compatible with the previous app version (expand, then contract).

### TEST-011 [must|review] testing
Use test data builders. No shared mutable fixtures. No production data in tests.

### TEST-012 [should|ci] ui, a11y, i18n, testing
Key screens have axe accessibility checks and run in both LTR and RTL.

### TEST-013 [must|test] ui, testing
Navigating between apps in the shell is covered by an end-to-end test: no full reload, no re-login, shell state preserved.

### TEST-014 [must|ci] ui, i18n, testing, a11y
Critical screens and workflows are tested in both English LTR and Arabic RTL, across representative narrow, medium and wide viewports, with localization and accessibility assertions. Responsive navigation, dashboard states and permission-scoped widgets are included in automated checks.
