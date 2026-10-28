# H-HR Principles

## Purpose

H-HR is the Human Resources application within H-OS. These principles define HR-specific business rules and extend the global H-OS principles.

## Mandatory Inheritance Rules

1. Read and follow the H-OS global principles before implementing H-HR.
2. Read all files in this H-HR principles directory before implementation.
3. H-HR principles extend global principles; they do not replace, weaken, or duplicate them.
4. When a conflict exists, document it and follow the project's decision process. Never silently override a principle.
5. Inspect the actual repository, architecture, graph, decisions, manifest, task brief, existing code, and tests before making changes.
6. Do not assume a framework, database, file path, integration, or existing capability without verifying it.
7. Record implementation progress, decisions, tests, blockers, and results in the project's prescribed work logs.

## H-HR Scope

H-HR manages:

- Employee records and employment lifecycle.
- Company branches, locations, departments, teams, and reporting relationships.
- Employment history and effective-dated assignments.
- Leave policies, balances, requests, and approvals.
- In-app attendance capture, review, corrections, and time calculations.
- Compensation, salary changes, bonuses, allowances, deductions, and payroll calculations.
- Employee self-service.
- Controlled integration with H-OS identity, H-Archive, H-Asset, and H-Finance.

## System Ownership

- H-HR owns HR records and payroll calculations.
- H-Archive owns archived documents and document versions.
- H-Asset owns asset records and asset lifecycle.
- H-Finance owns the accounting ledger and financial postings.
- H-OS identity/access infrastructure owns authentication and the final authorization mechanism.

H-HR must not create competing sources of truth for records owned by another application.

## Confirmed Business Scope

- One company, with multiple branches and work locations.
- Attendance is recorded through the H-OS/H-HR application in the initial scope.
- Payroll, deductions, and net payable amounts are calculated inside H-HR.
- Employees can access their own permitted information, leave, attendance, requests, and documents.
- Arabic and English, RTL and LTR, and responsive desktop, tablet, and phone browser interfaces are required.

## Important Restrictions

Do not invent legal payroll rules, tax rates, social insurance formulas, or leave entitlements. These require approved configuration and documented decisions.

Do not implement biometric-device integration, multi-company architecture, a separate identity provider, or a second accounting ledger unless explicitly approved.