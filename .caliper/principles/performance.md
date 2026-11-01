# Performance Principles (PERF)

### PERF-001 [must|review] perf
Measure before optimizing. A performance change includes before/after evidence.

### PERF-002 [must|test] db, perf
No N+1 queries. Critical list endpoints have integration tests that assert the number of queries.

### PERF-003 [must|ci] api, perf
Every list endpoint is paginated (cursor or keyset) with a maximum page size. No unbounded queries.

### PERF-004 [must|review] db, migration, perf
Indexes are designed from real query patterns. Every foreign key is indexed. Heavy new queries are checked with EXPLAIN. Migrations on large tables are non-blocking.

### PERF-005 [must|ci] api, perf
Budgets on reference hardware: standard reads p95 under 300 ms, writes p95 under 1 s. Slower work runs asynchronously.

### PERF-006 [must|test] jobs, perf
Long operations (payroll runs, imports, reports) run as background jobs with progress reporting and idempotent retries.

### PERF-007 [must|ci] ui, perf
Frontend budgets: shell initial JavaScript at most 250 KB gzip; each app chunk at most 200 KB gzip; app switching feels instant (prefetch on hover or intent); long tables are virtualized.

### PERF-008 [should|review] perf
Cache only with an owner and an explicit invalidation strategy. A cache never bypasses permission checks.

### PERF-009 [should|test] org-tree, permissions, perf
Resolve data scope from the org tree with `ltree` and indexes, not recursive traversal per request. Cache the resolved scope per session and invalidate it on org-change events.

### PERF-010 [should|ci] infra, perf
Containers declare resource limits. Critical paths have a load test (k6) before each release.

### PERF-011 [must|review] ui, db, perf
Large datasets, tables, dashboards, organization trees, charts and exports must be rendered with deliberate strategies such as pagination, virtualization, tree search, expansion/collapse, partial loading and targeted detail views. Performance budgets are set from measured baselines or approved Decisions and enforced in CI. Performance improvements include evidence when practical.
