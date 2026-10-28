# Business Principles (BIZ)

Cross-app business rules for H-OS. App-specific business rules go in the app's own `business.md`.

### BIZ-001 [must|review] domain, db
Single source of truth: every business entity is owned by exactly one app. H-HR owns people and the org tree; H-Asset owns assets and custody; H-Finance owns the ledger; H-Stock owns inventory; H-Sales owns sales documents; H-Rooms owns room structure and links. Other apps hold IDs and projections only.

### BIZ-002 [must|test] money
Money is never a float. Store amounts as integer minor units or fixed-precision decimals together with a currency code. Rounding rules are explicit, centralized and tested.

### BIZ-003 [must|test] domain, db, org-tree
Effective dating: assignments, positions, salaries, rates and policies keep history with `valid_from` and `valid_to`. Queries are answerable "as of" a date. Rows are closed and replaced, never overwritten. Overlaps are forbidden by database constraint.

### BIZ-004 [must|test] money, audit
Posted financial and legal records are immutable and append-only. Corrections are reversal documents. No hard delete.

### BIZ-005 [must|review] db
Business entities are archived (soft delete), not removed. Permanent erasure happens only through an explicit erasure workflow defined by a Decision.

### BIZ-006 [must|review] org-tree, permissions
The org tree (units, positions, assignments, reporting lines) is the backbone of access. H-HR owns it; the platform derives permission scopes from it; other apps consume it through the published API and events and never read H-HR tables.

### BIZ-007 [must|test] permissions, events
Approvals run on the platform workflow engine. Approval authority is defined by position and by amount or type. No self-approval. Delegation has a start, an end and an audit record.

### BIZ-008 [must|test] db, domain
Document numbers (invoices, vouchers, requests) come from server-side sequences per company and document type, allocated inside the transaction, unique, and gap-controlled.

### BIZ-009 [must|review] db
Every business table carries `organization_id` and every query is scoped by it. Deployment is single-tenant by default, but the model is tenant-aware from day one.

### BIZ-010 [should|test] domain
Instants are stored in UTC. Business dates are date-only values. Company time zone, weekend days and holiday calendars are configuration, never constants.

### BIZ-011 [must|arch-test] domain, events, db
Cross-app links are typed entity references `{app, type, id}` resolved by the platform links service, never URL strings or cross-schema joins.

### BIZ-012 [must|review] domain
Every business rule is a named rule in the domain layer, covered by tests, and traceable to its source (policy, law, spec or Decision).

### BIZ-013 [should|review] domain, api
Data coming from external or legacy systems enters through an explicit import adapter with field mapping, validation and dry-run. Systems never share databases.

### BIZ-014 [must|review] domain
Every app defines in its own `business.md` its owned entities, invariants, state machines and the events it publishes, before implementation starts.

### BIZ-015 [must|review] domain, db, events
Business facts have exactly one authoritative owner. H-HR owns people and the org tree; H-Finance owns financial ledgers and posting rules; H-Sales owns sales documents; H-Stock owns inventory; H-Asset owns assets and custody; H-Rooms owns room structures and links. Other apps hold stable IDs and projections only. Each workflow declares whether it requires immediate transactional consistency or eventual consistency, and defines the idempotency, retry, reconciliation and recovery strategy for derived data. Concurrency is protected using database constraints, transactions, optimistic locking or other justified mechanisms, and the same fact is never independently editable in multiple apps.
