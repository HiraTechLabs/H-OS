---
id: DEC-0009
title: Adopt Go as the backend runtime and framework for H-OS
status: accepted
date: 2026-11-02
tags:
  - decision
  - api
  - db
  - perf
  - infra
  - deps
affects:
  - .caliper/principles/tech-stack.md
  - platform/api/**
  - platform/kernel/**
  - apps/**
  - backend/**
relaxes: []
supersedes: null
---

# Context

Following the backend technology re-evaluation initiated in `DEC-0008` and the evaluation benchmarks recorded in `docs/tech-evaluation/2026-11-02-backend-technology-reevaluation.md`, the platform required a final, definitive decision on the server runtime and language for the H-OS modular monolith.

The long-term workload of H-OS (payroll processing, high-volume transactional imports, analytical reporting, and multi-tenant domain execution) demands predictable execution latency, low memory footprint per instance, instant startup, and true multithreaded concurrency without the overhead of single-threaded event-loop bottlenecks.

# Decision

1. **Adopt Go as the authoritative backend runtime and framework for H-OS.**
2. Supersede `DEC-0008` (backend technology re-evaluation) and definitively resolve `DEC-0001` (NestJS on TypeScript), establishing Go as the single supported backend implementation.
3. Retain the React + TypeScript + Vite + TanStack frontend web shell and application modules. OpenAPI 3.1 serves as the authoritative, machine-verified contract boundary between the Go backend and the TypeScript client.
4. Integrate the Go backend implementation containing platform authentication, sessions, account management, audit logging, outbox, database connection pooling with pgx, H-HR domain/application/infrastructure layers, and the authoritative Application Registry.
5. Decommission the NestJS backend implementation to ensure one deployable backend executable without competing runtime implementations.

# Consequences

- The backend runtime is Go (1.23+), producing a single static binary with instant startup, minimal memory footprint (<30MB baseline), and robust native concurrency.
- Database access uses PostgreSQL with `pgx/v5` connection pooling and explicit transaction management.
- The platform contracts and frontend types are synchronized via an authoritative OpenAPI 3.1 specification.
- `DEC-0001` and `DEC-0008` are marked `superseded` by this decision.
- `tech-stack.md` is updated to reflect Go as the accepted backend technology.
