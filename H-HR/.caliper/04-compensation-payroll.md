# Compensation and Payroll

## HHR-PAY-001 — Payroll Ownership

H-HR calculates employee compensation, earnings, deductions, and net payable amounts. H-Finance remains authoritative for the accounting ledger and financial postings.

H-HR must not create a competing general ledger.

## HHR-PAY-002 — Effective-Dated Compensation

Support salary and compensation history with effective dates. A compensation change must not silently alter an already finalized payroll run.

## HHR-PAY-003 — Compensation Components

Support configurable components such as:

- Basic salary.
- Fixed allowances.
- Variable allowances.
- Bonuses.
- Commissions.
- Approved overtime.
- Unpaid-leave deductions.
- Approved absence adjustments.
- Advances or loan installments.
- Tax and social insurance where applicable.
- Other approved recurring or one-time components.

The actual catalog must be configurable and approved.

## HHR-PAY-004 — Salary Changes

Support raises, reductions, promotions, demotions, grade changes, allowances, temporary compensation, future-dated changes, and approved retroactive changes.

Record the previous value, new value, reason, effective date, requester, approver, and audit history.

## HHR-PAY-005 — Payroll Calculation Traceability

Each payroll line must record its source, inputs, calculation rule version, period, rounding method, and result.

Authorized users must be able to explain how gross pay, every deduction, and net pay were calculated.

## HHR-PAY-006 — Payroll Lifecycle

Define payroll states such as draft, calculating, calculated, validation failed, under review, approved, finalized/locked, posted to finance, partially integrated, corrected/reversed, and cancelled where appropriate.

A finalized payroll must not be silently edited.

## HHR-PAY-007 — Payroll Cut-Off

Define cut-off dates for attendance, leave, commissions, bonuses, and compensation changes.

Late inputs must follow an explicit adjustment policy rather than being silently inserted into finalized payroll.

## HHR-PAY-008 — Deduction Controls

Define authorization, precedence, caps, rounding, limits, and visibility for each deduction type.

Explicitly handle zero or negative net pay, overpayments, disputed deductions, and retroactive corrections. Never silently force a negative result to zero.

## HHR-PAY-009 — Retroactive Corrections

Preserve original finalized results. Corrections must be traceable adjustments or reversals linked to the original payroll run.

## HHR-PAY-010 — Separation of Duties

Where practical, separate payroll preparation, review, approval, finalization, and financial posting permissions.

High-risk salary and payroll actions require appropriate approvals and audit trails.

## HHR-PAY-011 — Finance Integration

Transfer approved payroll results through an approved, versioned H-Finance contract. Track external references, delivery status, retries, idempotency, and reconciliation differences.

A failed posting must not cause payroll to be calculated or posted twice.

## HHR-PAY-012 — Payslips

Provide permission-controlled payslips showing the payroll period, earnings, deductions, net amount, and supported year-to-date information. Employees may view only their own payslips.

## HHR-PAY-013 — Monetary Precision

Use decimal-safe monetary arithmetic, explicit currency precision, and an approved rounding policy. Never use ordinary binary floating-point arithmetic for money.

## HHR-PAY-014 — Legal Compliance

Do not enable jurisdiction-specific tax, social insurance, overtime, or statutory deduction calculations for production until their rules, sources, versions, effective dates, and expected results have been approved and tested.