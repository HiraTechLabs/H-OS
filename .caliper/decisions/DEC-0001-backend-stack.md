---
id: DEC-0001
title: Adopt NestJS on TypeScript for the H-OS backend
status: proposed
date: 2026-10-29
tags:
  - tech-stack
  - backend
  - nestjs
  - typescript
affects:
  - .caliper/principles/tech-stack.md
  - platform/api/**
  - apps/**
relaxes: []
supersedes: null
review_by: 2027-10-29
---

# Context

The H-OS repository committed to a modular monolith, TypeScript-first frontend, PostgreSQL, and integration-first business architecture. The backend technology choice was still documented as pending in the stack file, which left the repository without a definitive decision for the server runtime and framework.

A concise comparison of the remaining options follows.

## Options considered

### Option A: NestJS + TypeScript
- Business application development: strong fit for enterprise domains, typed contracts, and layered architecture with service-driven modules.
- Integrations: excellent fit for OpenAPI-first APIs, typed DTOs, event-driven flows, and shared platform contracts.
- Maintainability: TypeScript strictness and structure support large-domain codebases and shared contracts across apps.
- Team productivity: works well with a frontend codebase already using TypeScript and a single-language platform across the monorepo.
- Performance: Node.js is a strong option for API-heavy business systems when tuned with query discipline and async processing.

### Option B: Django + Python
- Business application development: fast for internal CRUD and admin-heavy workflows, especially when a team is already strong in Python.
- Integrations: capable, but the ecosystem and typing conventions are less aligned with a TypeScript-first monorepo and contract-first integration model.
- Maintainability: clean patterns exist, though service boundaries and cross-app contracts are usually enforced more explicitly in a TypeScript/NestJS codebase inside a multi-app platform.
- Team productivity: strong for Python-first teams, but less aligned with current H-OS stack decisions for the web shell, typed client generation, and shared UI contracts.
- Performance: excellent for many workloads, but the H-OS stack already prefers a TypeScript, Node.js, React ecosystem and shared typed API contracts across apps.

## Decision

Adopt NestJS on TypeScript (Node.js LTS) as the default backend for H-OS.

This choice matches the committed stack, preserves the modular monolith architecture, and aligns the backend with the rest of the monorepo's TypeScript/React contract-first model. Django remains a valid alternative for future projects only if a separate Decision is made because the project needs a Python-centric stack or a team with strong Python backend expertise that outweighs the current architecture alignment.

## Consequences

- H-OS uses a single TypeScript language surface across the backend and frontend for shared contracts, DX, and contract generation.
- The backend follows NestJS module boundaries, repository and use-case patterns, and event-driven integration flows.
- The stack remains consistent with Drizzle ORM, OpenAPI generation, typed clients, and PostgreSQL-first persistence.
- The repository defaults to a modular monolith; microservice split or external broker adoption remains blocked until a later approved Decision justifies it.
- Any future backend technology change requires a new Decision and a deliberate migration plan.

## Rules affected

- STK-001: the stack is committed and requires a Decision before change.
- STK-005: auth, event bus, file storage and AI provider access remains behind interfaces.
- STK-007: the OpenAPI document remains generated from code and the typed client remains generated from it.
- STK-010: the stack still forbids microservices and additional ORMs without a Decision.
- ARCH-014 and ARCH-015: the integration-first architecture remains compatible with the NestJS backend and modular monolith model.
