# H-OS CORE — Always Read

Applies to every task in H-OS and every app inside it. Full rules live in the domain files; you receive the relevant ones in the Task Brief. These are the rules you must never break even if you were not given the brief for them.

### CORE-001 [must|review] *
Work only from the Task Brief. If the brief is missing something you need, or two rules conflict, stop and propose a Decision. Do not choose silently.

### CORE-002 [must|arch-test] *
Dependencies point inward: domain <- application <- infrastructure/presentation. Domain code imports no framework, ORM or HTTP type. (ARCH-001)

### CORE-003 [must|arch-test] *
Apps never import each other's internals. Cross-app interaction is by published events or contract interfaces only, and cross-app data references are IDs, never joins. (ARCH-002, ARCH-003, BIZ-011)

### CORE-004 [must|test] *
Authorization is enforced in the backend, per permission and per data scope, on every endpoint. Hiding UI is not protection. (SEC-001, SEC-002, SEC-003)

### CORE-005 [must|test] *
Money is never a float. Business history (assignments, rates, ledgers) is never overwritten: use effective dating and reversals. (BIZ-002, BIZ-003, BIZ-004)

### CORE-006 [must|ci] *
No secrets, tokens, passwords or personal/payroll data in code, logs, tests or fixtures. (SEC-005, LOG-003)

### CORE-007 [must|test] *
Every use case and every bug fix comes with tests; a bug fix starts with a failing regression test. (TEST-002)

### CORE-008 [must|lint] *
TypeScript strict, no `any`, no dead code, no commented-out code, no TODO without an issue ID. (CODE-001, CODE-004, CODE-005)

### CORE-009 [must|lint] *
UI: all strings through i18n (en + ar), logical CSS properties only (RTL-safe), design-system tokens only, responsive behavior for desktop/tablet/phone, every screen has loading/empty/error/no-permission states. (UX-005, UX-006, UX-008, UX-014, UX-016)

### CORE-010 [must|ci] *
One change, one purpose, one small PR on a short-lived branch named `<type>/<app>-<desc>`, Conventional Commits, never merged to `main` or deployed to production without human approval. (GIT-002, GIT-003, GIT-005)

### CORE-013 [must|review] *
H-OS is one integrated business operating system. Apps communicate through published contracts, typed references, or versioned domain events; they never bypass the platform or access other apps' internal implementation or database tables directly. (ARCH-014, ARCH-015, BIZ-015, SEC-015)

### CORE-011 [must|ci] *
Any structural change (module, event, contract, table ownership, dependency, tech-stack item) updates the Graph in the same PR, and needs a Decision when it changes architecture or relaxes a rule. (GRAPH-003, DEC-001)

### CORE-012 [must|review] *
Prefer the simplest design that satisfies the brief. Do not add features, abstractions, patterns or dependencies that the request does not require.
