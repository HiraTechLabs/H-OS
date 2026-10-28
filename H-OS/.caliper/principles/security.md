# Security Principles (SEC)

### SEC-001 [must|arch-test] api, auth
Every endpoint requires authentication by default through a global guard. Public endpoints are marked explicitly and listed in a test.

### SEC-002 [must|test] api, permissions
Authorization is checked in the backend at the use-case level for every operation, per permission and data scope. Each permission has tests for allow and deny.
Why: hiding UI elements is not protection.

### SEC-003 [must|test] permissions, org-tree, db
Data scope (own, subtree, unit, all) is applied in the query, derived from the org tree. Never fetch everything and filter in memory.

### SEC-004 [must|lint] api
Validate all external input at the boundary with a schema. Reject unknown fields. Never build SQL by string concatenation.

### SEC-005 [must|ci] config
No secrets in the repository or images. Secret scanning runs in CI. Secrets come from the environment or a secret manager. `.env` files are never committed.

### SEC-006 [must|review] auth
Passwords use argon2id. No custom cryptography. Access tokens are short-lived and refreshed with rotation. Authentication sits behind the `AuthProvider` interface.

### SEC-007 [must|test] audit, permissions, org-tree, money
Every state change in identity, permissions, org structure, payroll and finance writes an append-only audit record: who, what, when, before and after, request ID.

### SEC-008 [must|review] db, logging
Personal and payroll data is classified per field. Sensitive fields are encrypted at rest (volume or column as the classification demands), TLS is required in transit, and these fields never appear in logs, errors or analytics.

### SEC-009 [must|ci] deps, infra
Dependency and container image scans run in CI. High and critical findings block the merge.

### SEC-010 [must|test] ai
H-AI acts only with the permissions of the user who asked, through the same use cases as the UI. There is no service-wide super-token for AI.

### SEC-011 [must|test] api, auth
Auth endpoints have rate limiting and lockout. Secure headers are set. CORS uses an allowlist. State-changing requests are protected against CSRF if cookies are used.

### SEC-012 [should|review] db
Database roles follow least privilege: the runtime role cannot alter schema; migrations run under a separate role.

### SEC-013 [must|test] files
Uploaded files are validated by type and size, stored outside the web root or in object storage, scanned when a scanner is configured, and served with a safe content type and download headers.

### SEC-014 [must|review] auth, permissions
Access changes after an org change (transfer, termination) are reviewed through an access-review event. Access is never granted automatically by moving a person in the tree. Termination disables the account immediately.

### SEC-015 [must|test] api, auth, events
Integration endpoints and event consumers validate schema, authentication, authorization, versioning, and error semantics at the boundary. Event-driven workflows explicitly handle idempotency, retries, duplicate delivery, failure recovery, and transactional publication where applicable. Cross-app access uses least-privilege permissions and approved contracts only.
