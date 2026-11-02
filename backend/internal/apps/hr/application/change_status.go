package application

import (
	"context"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/domain"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/clock"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/ids"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/permissions"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

// ChangeStatus applies one legal lifecycle transition (HR-DEC-0001). Illegal transitions are
// refused by the domain, not by the UI. Ending an episode also closes the open assignment and
// manager row so organizational history stays truthful, and revokes the linked account's sessions
// in the same transaction so access changes take effect immediately (SEC-014, HHR-INT-005).
type ChangeStatus struct {
	pool        Transactor
	clock       clock.Clock
	employees   EmployeeRepository
	employment  EmploymentRepository
	assignments AssignmentRepository
	sessions    SessionRevoker
	recorder    *Recorder
	scope       *ActorScope
}

// NewChangeStatus wires the use case.
func NewChangeStatus(
	pool Transactor,
	clk clock.Clock,
	employees EmployeeRepository,
	employment EmploymentRepository,
	assignments AssignmentRepository,
	sessions SessionRevoker,
	recorder *Recorder,
	scope *ActorScope,
) *ChangeStatus {
	return &ChangeStatus{
		pool:        pool,
		clock:       clk,
		employees:   employees,
		employment:  employment,
		assignments: assignments,
		sessions:    sessions,
		recorder:    recorder,
		scope:       scope,
	}
}

// Execute applies the transition.
func (u *ChangeStatus) Execute(ctx context.Context, actor auth.Actor, employeeID string, input ChangeStatusInput) error {
	if !IsUUID(employeeID) {
		return problem.Validation("The employee identifier is not valid.")
	}
	if err := validateChangeStatus(input); err != nil {
		return err
	}

	if _, err := u.scope.AssertCanAccess(ctx, actor, permissions.HREmployeeChangeStatus, employeeID); err != nil {
		return err
	}

	aggregate, err := u.employees.FindByID(ctx, employeeID)
	if err != nil {
		return problem.Internal(err)
	}
	if aggregate == nil || aggregate.Core.OrganizationID != actor.OrganizationID {
		return problem.NotFound("The employee does not exist.")
	}

	from := aggregate.Core.Status
	to := domain.EmploymentStatus(input.ToStatus)
	if from == to {
		return problem.Conflict("The employee already has this status.")
	}
	if to == domain.StatusPendingStart {
		return problem.Validation("Re-entering employment requires a new employment episode; use the rehire operation.")
	}
	if !domain.CanTransition(from, to) {
		allowed := make([]string, 0, len(domain.AllowedTransitions(from)))
		for _, status := range domain.AllowedTransitions(from) {
			allowed = append(allowed, string(status))
		}
		return problem.PreconditionFailed(
			"Transition from " + string(from) + " to " + string(to) + " is not allowed. Allowed: " + join(allowed, ", ") + ".",
		)
	}

	endsNow := domain.IsEndStatus(to)
	if endsNow && blank(input.EndReason) {
		return problem.Validation("An end reason is required when employment ends.")
	}

	currentEpisode := aggregate.CurrentEpisode()
	currentAssignment := aggregate.CurrentAssignment()
	currentManager := aggregate.CurrentManager()
	endReason := input.Reason
	if input.EndReason != nil {
		endReason = *input.EndReason
	}

	err = u.pool.InTx(ctx, func(tx db.Tx) error {
		if err := u.employees.UpdateCore(ctx, tx, employeeID, aggregate.Core.WorkEmail, to, u.clock.Now()); err != nil {
			return err
		}
		if err := u.employment.AddTransition(ctx, tx, StatusTransition{
			ID:             ids.New(),
			OrganizationID: actor.OrganizationID,
			EmployeeID:     employeeID,
			FromStatus:     &from,
			ToStatus:       to,
			EffectiveDate:  input.EffectiveDate,
			RecordedAt:     u.clock.Now(),
			ActorAccountID: &actor.AccountID,
			Reason:         input.Reason,
			EndReason:      input.EndReason,
		}); err != nil {
			return err
		}

		if endsNow && currentEpisode != nil {
			if err := u.employment.CloseEpisode(ctx, tx, currentEpisode.ID, input.EffectiveDate, endReason); err != nil {
				return err
			}
		}
		if endsNow && currentAssignment != nil {
			if err := u.assignments.CloseAssignment(ctx, tx, currentAssignment.ID, input.EffectiveDate); err != nil {
				return err
			}
		}
		if endsNow && currentManager != nil {
			if err := u.assignments.CloseManager(ctx, tx, currentManager.ID, input.EffectiveDate); err != nil {
				return err
			}
		}

		fromEn, fromAr := domain.StatusLabel(from)
		toEn, toAr := domain.StatusLabel(to)
		if err := u.recorder.Record(ctx, tx, actor, actor.OrganizationID, Change{
			Action:      "hr.employee.status_changed",
			EmployeeID:  employeeID,
			EffectiveOn: input.EffectiveDate,
			SummaryEn:   "Employment status changed from " + fromEn + " to " + toEn,
			SummaryAr:   "تم تغيير حالة التوظيف من " + fromAr + " إلى " + toAr,
			Reason:      &input.Reason,
			Before:      map[string]any{"status": string(from)},
			After:       map[string]any{"status": string(to), "endReason": input.EndReason},
			EventType:   EventEmployeeStatusChange,
			EventVersion: 1,
			EventPayload: map[string]any{
				"employeeId":    employeeID,
				"fromStatus":    string(from),
				"toStatus":      string(to),
				"effectiveDate": input.EffectiveDate,
			},
		}); err != nil {
			return err
		}

		if endsNow && aggregate.AccountLink != nil {
			if err := u.sessions.RevokeAllForAccountWithin(ctx, tx, aggregate.AccountLink.AccountID); err != nil {
				return err
			}
		}
		return nil
	})
	return translateWriteError(err)
}

func validateChangeStatus(input ChangeStatusInput) error {
	v := &validator{}
	if !domain.IsEmploymentStatus(input.ToStatus) {
		v.add("toStatus", "enum", "Unknown employment status.")
	}
	v.businessDate("effectiveDate", input.EffectiveDate, true)
	v.text("reason", input.Reason, 3, 500)
	if input.EndReason != nil {
		if length := len(*input.EndReason); length > 200 {
			v.add("endReason", "length", "Must be at most 200 characters.")
		}
	}
	return v.err()
}

func join(values []string, separator string) string {
	if len(values) == 0 {
		return ""
	}
	out := values[0]
	for _, value := range values[1:] {
		out += separator + value
	}
	return out
}
