# H-HR UI/UX Principles

## HHR-UX-001 — Shared H-OS Shell

H-HR runs inside the H-OS shell and uses the shared design system, navigation, authentication, localization, and notifications. Do not create a separate shell or login.

## HHR-UX-002 — Employee Profile Navigation

Organize the profile into clear sections: Overview, Personal Details, Employment, Organization, Leave, Attendance, Compensation, Documents, Assets/Custody, Requests, and History.

Each section must respect permissions.

## HHR-UX-003 — Role-Specific Views

Provide appropriate views for HR staff, managers, employees, payroll reviewers, and auditors. Reuse shared components without exposing the same data and actions to every role.

## HHR-UX-004 — Employee Self-Service

Employees can access their own permitted profile data, leave balances and requests, attendance, correction requests, payslips, and document references.

## HHR-UX-005 — Search and Filtering

Support authorized employee search and filtering by employee ID, name, employment status, branch, department, manager, location, and job title.

Do not expose sensitive identifiers in default search results.

## HHR-UX-006 — Responsive Interface

Support desktop, tablet, and phone browsers. Dense tables must remain usable through readable cards or deliberate horizontal scrolling. Forms, calendars, charts, organization views, and approval actions must work with touch input.

## HHR-UX-007 — Arabic and English

All user-facing strings must support Arabic and English, RTL and LTR layouts, and localized dates, numbers, and currency. Mixed Arabic and Latin names and identifiers must render correctly.

## HHR-UX-008 — Interface States

Every important screen must handle loading, empty, validation error, system error, forbidden access, success, and partial-integration states.

Preserve unsaved form data after validation errors whenever safe.

## HHR-UX-009 — Employment Timeline and Organization View

Provide a readable employment timeline and accessible organization chart or equivalent hierarchy view. Important information must also be available in a textual or tabular form.

## HHR-UX-010 — Leave and Attendance

Show leave balances, request status, approval history, team calendar, attendance timeline, and correction workflow with clear dates, units, and timezone.

## HHR-UX-011 — Payroll Privacy

Only authorized users can view salary details, earnings, deductions, and net pay. Shared team views must never reveal another employee's payroll data.

## HHR-UX-012 — Motion

Follow H-OS animation and reduced-motion principles. Transitions must not delay tasks or obscure status changes.

## HHR-UX-013 — Accessibility

Follow the global accessibility standard, including keyboard navigation, visible focus, semantic labels, contrast, accessible validation, and text alternatives for visualizations.