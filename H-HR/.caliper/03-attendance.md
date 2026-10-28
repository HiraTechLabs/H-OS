
# Attendance and Time Management

## HHR-ATT-001 — In-App Attendance

Employees record attendance through the H-OS/H-HR application in the initial scope. The design must allow future integration with biometric devices without requiring such devices for the initial implementation.

## HHR-ATT-002 — Preserve Original Events

Store attendance punches or events as source facts. Corrections must be separate, traceable records linked to the original event.

Never silently overwrite an original punch.

## HHR-ATT-003 — Attendance Event Information

Record the employee, event type, event timestamp, server-received timestamp, source, timezone, and other approved integrity metadata.

Do not collect GPS, photographs, or device identifiers by default. Any additional location or identity verification requires an explicit privacy and security decision.

## HHR-ATT-004 — Duplicate and Invalid Events

Detect duplicate submissions, replayed requests, missing punches, invalid sequences, out-of-order events, and implausible timing.

Browser-based attendance alone does not prove that an employee is physically present at a particular location.

## HHR-ATT-005 — Schedules and Shifts

Support configured fixed, rotating, flexible, overnight, part-time, remote, field, and multi-location schedules.

## HHR-ATT-006 — Attendance Exceptions

Detect and manage:

- Missing entry or exit.
- Duplicate attendance events.
- Late arrival.
- Early departure.
- Absence.
- Approved and unapproved overtime.
- Work on holidays or rest days.
- Attendance during approved leave.
- Shift or schedule changes.
- Network failures and delayed submissions.
- Attendance events received after payroll cut-off.

## HHR-ATT-007 — Correction Workflow

Employees may view their records and request corrections. Authorized HR users or managers may review corrections within their scope.

Preserve the original event, requested correction, reason, reviewer, approval, timestamps, and downstream recalculation status.

## HHR-ATT-008 — Overtime

Distinguish observed overtime, requested overtime, eligible overtime, approved overtime, and overtime payable through payroll.

A late clock-out must not automatically imply paid overtime.

## HHR-ATT-009 — Period Closing

Define attendance-period close, reopening permissions, and the handling of corrections after closing or payroll finalization.

Closed periods must not be silently changed.

## HHR-ATT-010 — Time Calculations

Use timezone-aware timestamps and explicit work schedules and calendars. Test overnight shifts, breaks, holidays, weekly rest days, schedule changes, and relevant daylight-saving transitions.

## HHR-ATT-011 — Reproducible Results

Attendance calculations must be reproducible from source events, applicable schedules, policy versions, approved corrections, and calculation versions.