# Git Principles (GIT)

### GIT-001 [must|ci] git
Trunk-based development. `main` is always releasable and protected: no direct pushes, merge only through a pull request with required checks.

### GIT-002 [must|ci] git
Branch names: `<type>/<app>-<short-description>` with type in `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`. Example: `feat/hr-org-unit-crud`. Branches are short-lived.

### GIT-003 [must|ci] git
Conventional Commits with the app as scope: `feat(hr): add org unit creation`. The body explains why and references the request ID.

### GIT-004 [must|review] git
One change, one purpose. Pull requests stay small (about 400 changed lines or fewer, excluding generated files and migrations). Split larger work.

### GIT-005 [must|ci] git
A pull request merges only when CI is green (lint, types, tests, arch-tests, contract tests, security scans), the Review model's per-rule verdict is attached, and a human has approved. Production deployment also requires human approval.

### GIT-006 [must|ci] git, decision, graph
Every PR links its Decision (if any), updates the Graph when structure changed, and updates documentation (en and ar where user-facing).

### GIT-007 [must|ci] git, migration, db
Migrations are forward-only, ship in the same PR as the code that needs them, and follow expand-then-contract so the previous release keeps working.

### GIT-008 [should|ci] git
Squash merge into `main` for a linear history. Releases are semantic-version tags on `main` with a generated changelog. Dev deploys from `main`; Prod deploys from a tag.

### GIT-009 [must|review] git
Hotfixes branch from the released tag as `fix/<app>-<description>`, are merged back to `main`, and follow the same checks.

### GIT-010 [must|ci] git, config
Never commit secrets, build artifacts, dependency folders, local environment files or large binaries.
