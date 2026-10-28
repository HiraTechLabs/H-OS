# Employee Records and Organizational Structure

## HHR-EMP-001 — Employee Profile

The employee profile should organize information into permission-controlled sections:

1. Identity and personal details.
2. Contact information and emergency contacts.
3. Employment information and contract summary.
4. Branch, work location, department, and team.
5. Job title, position, grade, and cost center where applicable.
6. Direct manager and other approved reporting relationships.
7. Work arrangement and work schedule.
8. Salary and compensation summary.
9. Leave balances and leave history.
10. Attendance and attendance corrections.
11. Payroll, earnings, deductions, and payslips.
12. Employment history.
13. Document references.
14. Asset and custody references.
15. Requests, approvals, and audit history.

Not every section is visible to every role.

## HHR-EMP-002 — Personal Data Minimization

Collect only information required for an approved business, operational, or legal purpose. Sensitive personal data requires appropriate access controls and retention rules.

## HHR-EMP-003 — Emergency Contacts

Support zero or more emergency contacts. Store relevant contact details, relationship, priority, and verification date. Restrict access to authorized users.

## HHR-EMP-004 — Protected Field Changes

Protected employee fields may require a change request. Record the old value, requested value, reason, requester, reviewer, approval, and effective date.

## HHR-EMP-005 — Employment Documents

H-Archive remains authoritative for archived files and versions. H-HR stores document references and HR-specific metadata according to the approved integration contract.

Until H-Archive integration exists, any temporary document storage must be explicitly approved and designed to avoid competing sources of truth.

## HHR-EMP-006 — Employment Timeline

Provide a chronological history of important events, including hiring, probation changes, transfers, promotions, salary changes, manager changes, leave-related events, and termination.

Each event should identify its effective date, recorded date, actor, reason, approval, and related record where applicable.

## HHR-ORG-001 — Organizational Structure

Support company branches, work locations, departments, teams, job titles, optional positions and grades, cost centers, work arrangements, and work calendars as required.

A job title, organizational position, direct-manager relationship, and security role are separate concepts.

## HHR-ORG-002 — Optional Direct Manager

Employees may have no direct manager. The system must represent that explicitly rather than assigning an invented manager.

## HHR-ORG-003 — Reporting Relationships

Support a primary manager relationship. Functional or project supervisors may be supported separately if the business rules explicitly define their meaning and permissions.

## HHR-ORG-004 — Temporary Assignments

Support acting positions, temporary transfers, secondments, and additional duties with start dates, end dates, approvals, and expiry or review reminders.

## HHR-ORG-005 — Organizational History

Preserve historical department, manager, location, and position assignments. Where practical, allow authorized users to view the organization as it existed on a specified date.

## HHR-ORG-006 — Work Location Scenarios

Support office-based, remote, hybrid, field-based, client-site, and multi-location work arrangements where applicable.

Organizational branch, normal work location, and attendance location must not be treated as interchangeable fields.

## HHR-ORG-007 — Organizational Changes and Permissions

A transfer, manager change, or department change may affect access and approval routing, but must not silently grant broad permissions or rewrite previously approved decisions.

Access changes must follow explicit, auditable, revocable policies.