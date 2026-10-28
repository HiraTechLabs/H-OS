# Clean Architecture and Design Pattern Principles (ARCH)

### ARCH-001 [must|arch-test] domain, api
Layers: `domain` <- `application` <- `infrastructure` and `presentation`. Dependencies point inward only. The domain layer imports no framework, ORM, HTTP or I/O library.

### ARCH-002 [must|arch-test] domain, events
Modules expose only a public contract (`contracts/` or the module's public `index.ts`). No module imports another module's internals. Cross-module interaction is by published events or by calling a contract interface.

### ARCH-003 [must|arch-test] db
No foreign keys, joins or SQL across app schemas. Other apps' entities are referenced by opaque ID. When data from another app is needed often, keep a local read model fed by events.

### ARCH-004 [must|review] domain
Business rules live in the domain layer (entities, value objects, domain services). Controllers, repositories and UI contain none.

### ARCH-005 [must|arch-test] db
Persistence is behind repository interfaces owned by the application/domain layer. ORM types never leave infrastructure.

### ARCH-006 [must|test] api
Business logic is entered only through use cases: one class per use case with typed input and output. Controllers map the request, call one use case, and map the result.

### ARCH-007 [must|test] events
State changes that other modules care about are published as versioned domain events through the transactional outbox, in the same transaction as the change. Handlers are idempotent. Event schemas live in `platform/contracts`.

### ARCH-008 [must|review] domain
One transaction changes one aggregate. Consistency across aggregates or modules is eventual, through events.

### ARCH-009 [must|arch-test] infra
Dependency injection is by interface. The composition root exists only in `platform/api`. No service locators, no global singletons holding state.

### ARCH-010 [must|arch-test] ui
Frontend app modules depend only on the public API of `platform/web` and `@h-os/ui`. Apps never import from each other. Cross-app navigation uses the entity-link registry.

### ARCH-011 [should|review] domain
Approved patterns: Repository, Factory (aggregate creation), Strategy (rule variants, for example payroll calculation), Specification (composable queries), Outbox, Adapter (external systems). Use a pattern only when a concrete need exists. A new structural pattern needs a Decision.

### ARCH-012 [must|review] domain
Prefer value objects over primitives for domain concepts (Money, DateRange, EmployeeNumber). Validate invariants in constructors and factories so invalid objects cannot exist.

### ARCH-013 [must|arch-test] api
The platform kernel stays small: identity, org-scope, events, audit, links, notifications. Business logic never moves into the kernel to avoid duplication.

### ARCH-014 [must|arch-test] domain, api, events, db
H-OS is one integrated business operating system, not a collection of isolated applications. Every app and platform component has a clearly defined integration contract: published, versioned APIs, typed entity references, or documented domain events. Apps do not access other apps' internal implementation or database tables directly. Each app documents its owned entities, exposed operations, consumed contracts, published events, and integration dependencies. Shared capabilities are provided through platform interfaces instead of duplicated implementations.

### ARCH-015 [must|ci] api, events, testing
Integration contracts define validation, authorization, error handling, versioning and consistency guarantees. A change to an API, event schema, entity ownership, or integration contract triggers impact analysis and the relevant contract and workflow tests. Critical cross-app business journeys must be covered by end-to-end tests. The modular monolith remains the default architecture; microservices or external brokers are introduced only with an accepted Decision.
