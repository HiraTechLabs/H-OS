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

// ChangeAssignment closes the assignment in force and opens a new one at the effective date.
// History is never overwritten (BIZ-003, HHR-DOM-004) and the database exclusion constraint
// forbids overlaps. A change of org unit gives a different data scope, so linked sessions are
// revoked in the same transaction (SEC-014).
type ChangeAssignment struct {
	pool        Transactor
	clock       clock.Clock
	employees   EmployeeRepository
	assignments AssignmentRepository
	directory   DirectoryRepository
	sessions    SessionRevoker
	recorder    *Recorder
	scope       *ActorScope
}

// NewChangeAssignment wires the use case.
func NewChangeAssignment(
	pool Transactor,
	clk clock.Clock,
	employees EmployeeRepository,
	assignments AssignmentRepository,
	directory DirectoryRepository,
	sessions SessionRevoker,
	recorder *Recorder,
	scope *ActorScope,
) *ChangeAssignment {
	return &ChangeAssignment{
		pool:        pool,
		clock:       clk,
		employees:   employees,
		assignments: assignments,
		directory:   directory,
		sessions:    sessions,
		recorder:    recorder,
		scope:       scope,
	}
}

// Execute applies the reassignment.
func (u *ChangeAssignment) Execute(ctx context.Context, actor auth.Actor, employeeID string, input ChangeAssignmentInput) error {
	if !IsUUID(employeeID) {
		return problem.Validation("The employee identifier is not valid.")
	}
	if err := validateChangeAssignment(input); err != nil {
		return err
	}

	if _, err := u.scope.AssertCanAccess(ctx, actor, permissions.HREmployeeUpdate, employeeID); err != nil {
		return err
	}

	unit, err := u.directory.OrgUnitHeader(ctx, actor.OrganizationID, input.OrgUnitID)
	if err != nil {
		return problem.Internal(err)
	}
	if unit == nil {
		return problem.NotFound("The organization unit does not exist.")
	}
	if err := u.scope.AssertUnitWithinScope(ctx, actor, permissions.HREmployeeUpdate, unit.Path); err != nil {
		return err
	}

	aggregate, err := u.employees.FindByID(ctx, employeeID)
	if err != nil {
		return problem.Internal(err)
	}
	if aggregate == nil || aggregate.Core.OrganizationID != actor.OrganizationID {
		return problem.NotFound("The employee does not exist.")
	}

	current := aggregate.CurrentAssignment()
	if current != nil && domain.IsBefore(input.EffectiveFrom, current.ValidFrom) {
		return problem.PreconditionFailed("The effective date cannot be before the start of the current assignment.")
	}

	branchID, err := u.directory.LocationBranch(ctx, actor.OrganizationID, input.WorkLocationID)
	if err != nil {
		return problem.Internal(err)
	}
	if branchID == nil {
		return problem.NotFound("The work location does not exist.")
	}
	jobTitleExists, err := u.directory.JobTitleExists(ctx, actor.OrganizationID, input.JobTitleID)
	if err != nil {
		return problem.Internal(err)
	}
	if !jobTitleExists {
		return problem.NotFound("The job title does not exist.")
	}
	if input.JobGradeID != nil {
		exists, err := u.directory.JobGradeExists(ctx, actor.OrganizationID, *input.JobGradeID)
		if err != nil {
			return problem.Internal(err)
		}
		if !exists {
			return problem.NotFound("The job grade does not exist.")
		}
	}
	if input.WorkScheduleID != nil {
		exists, err := u.directory.WorkScheduleExists(ctx, actor.OrganizationID, *input.WorkScheduleID)
		if err != nil {
			return problem.Internal(err)
		}
		if !exists {
			return problem.NotFound("The work schedule does not exist.")
		}
	}

	unitChanged := current == nil || current.OrgUnitID != input.OrgUnitID
	before := map[string]any{}
	if current != nil {
		before = map[string]any{
			"orgUnitId":       current.OrgUnitID,
			"jobTitleId":      current.JobTitleID,
			"workLocationId":  current.WorkLocationID,
			"workArrangement": current.WorkArrangement,
		}
	}

	err = u.pool.InTx(ctx, func(tx db.Tx) error {
		if current != nil {
			if err := u.assignments.CloseAssignment(ctx, tx, current.ID, input.EffectiveFrom); err != nil {
				return err
			}
		}
		if err := u.assignments.AddAssignment(ctx, tx, AssignmentRecord{
			ID:              ids.New(),
			BranchID:        *branchID,
			WorkLocationID:  input.WorkLocationID,
			OrgUnitID:       input.OrgUnitID,
			JobTitleID:      input.JobTitleID,
			JobGradeID:      input.JobGradeID,
			WorkArrangement: input.WorkArrangement,
			WorkScheduleID:  input.WorkScheduleID,
			CostCenterRef:   input.CostCenterRef,
			ValidFrom:       input.EffectiveFrom,
			ValidTo:         nil,
			Reason:          input.Reason,
		}, actor.OrganizationID, employeeID, u.clock.Now(), &actor.AccountID); err != nil {
			return err
		}

		if err := u.recorder.Record(ctx, tx, actor, actor.OrganizationID, Change{
			Action:      "hr.assignment.changed",
			EmployeeID:  employeeID,
			EffectiveOn: input.EffectiveFrom,
			SummaryEn:   "Organization assignment changed",
			SummaryAr:   "تم تغيير التعيين التنظيمي",
			Reason:      &input.Reason,
			Before:      before,
			After: map[string]any{
				"orgUnitId":       input.OrgUnitID,
				"jobTitleId":      input.JobTitleID,
				"workLocationId":  input.WorkLocationID,
				"workArrangement": input.WorkArrangement,
			},
			EventType:    EventAssignmentChanged,
			EventVersion: 1,
			EventPayload: map[string]any{
				"employeeId":    employeeID,
				"orgUnitId":     input.OrgUnitID,
				"jobTitleId":    input.JobTitleID,
				"effectiveFrom": input.EffectiveFrom,
			},
		}); err != nil {
			return err
		}

		if unitChanged && aggregate.AccountLink != nil {
			if err := u.sessions.RevokeAllForAccountWithin(ctx, tx, aggregate.AccountLink.AccountID); err != nil {
				return err
			}
		}
		return nil
	})
	return translateWriteError(err)
}

func validateChangeAssignment(input ChangeAssignmentInput) error {
	v := &validator{}
	v.identifier("orgUnitId", input.OrgUnitID, true)
	v.identifier("workLocationId", input.WorkLocationID, true)
	v.identifier("jobTitleId", input.JobTitleID, true)
	v.optionalIdentifier("jobGradeId", input.JobGradeID)
	v.oneOf("workArrangement", input.WorkArrangement, workArrangementValues)
	v.optionalIdentifier("workScheduleId", input.WorkScheduleID)
	v.optionalText("costCenterRef", input.CostCenterRef, 64)
	v.businessDate("effectiveFrom", input.EffectiveFrom, true)
	v.text("reason", input.Reason, 3, 500)
	return v.err()
}
