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

// maxReportingDepth bounds cycle detection. A chain longer than this is refused rather than
// traversed forever.
const maxReportingDepth = 64

// ChangeManager changes the direct manager with an effective date. A nil manager is a first-class
// "no direct manager" relationship (HHR-ORG-002). A cycle in the reporting chain is refused, and the
// previous row is closed rather than overwritten (BIZ-003).
type ChangeManager struct {
	pool        Transactor
	clock       clock.Clock
	employees   EmployeeRepository
	assignments AssignmentRepository
	directory   DirectoryRepository
	recorder    *Recorder
	scope       *ActorScope
}

// NewChangeManager wires the use case.
func NewChangeManager(
	pool Transactor,
	clk clock.Clock,
	employees EmployeeRepository,
	assignments AssignmentRepository,
	directory DirectoryRepository,
	recorder *Recorder,
	scope *ActorScope,
) *ChangeManager {
	return &ChangeManager{
		pool:        pool,
		clock:       clk,
		employees:   employees,
		assignments: assignments,
		directory:   directory,
		recorder:    recorder,
		scope:       scope,
	}
}

// Execute applies the reporting change.
func (u *ChangeManager) Execute(ctx context.Context, actor auth.Actor, employeeID string, input ChangeManagerInput) error {
	if !IsUUID(employeeID) {
		return problem.Validation("The employee identifier is not valid.")
	}
	if err := validateChangeManager(input); err != nil {
		return err
	}

	if _, err := u.scope.AssertCanAccess(ctx, actor, permissions.HREmployeeUpdate, employeeID); err != nil {
		return err
	}

	aggregate, err := u.employees.FindByID(ctx, employeeID)
	if err != nil {
		return problem.Internal(err)
	}
	if aggregate == nil || aggregate.Core.OrganizationID != actor.OrganizationID {
		return problem.NotFound("The employee does not exist.")
	}

	managerID := input.ManagerEmployeeID
	if managerID != nil {
		if *managerID == employeeID {
			return problem.Validation("An employee cannot be their own manager.")
		}
		manager, err := u.employees.FindByID(ctx, *managerID)
		if err != nil {
			return problem.Internal(err)
		}
		if manager == nil || manager.Core.OrganizationID != actor.OrganizationID {
			return problem.NotFound("The selected manager does not exist.")
		}
		if manager.Core.Status == domain.StatusTerminated || manager.Core.Status == domain.StatusRetired {
			return problem.Validation("The selected manager is no longer employed.")
		}
		if err := u.assertNoCycle(ctx, employeeID, *managerID); err != nil {
			return err
		}
	}

	current := aggregate.CurrentManager()
	if current != nil && domain.IsBefore(input.EffectiveFrom, current.ValidFrom) {
		return problem.PreconditionFailed("The effective date cannot be before the start of the current manager assignment.")
	}

	before := map[string]any{"managerEmployeeId": nil}
	if current != nil {
		before["managerEmployeeId"] = current.ManagerEmployeeID
	}

	err = u.pool.InTx(ctx, func(tx db.Tx) error {
		if current != nil {
			if err := u.assignments.CloseManager(ctx, tx, current.ID, input.EffectiveFrom); err != nil {
				return err
			}
		}
		if err := u.assignments.AddManager(ctx, tx, ManagerRecord{
			ID:                ids.New(),
			ManagerEmployeeID: managerID,
			ValidFrom:         input.EffectiveFrom,
			ValidTo:           nil,
			Reason:            input.Reason,
		}, actor.OrganizationID, employeeID, u.clock.Now(), &actor.AccountID); err != nil {
			return err
		}

		summaryEn := "Direct manager removed"
		summaryAr := "تم إزالة المدير المباشر"
		if managerID != nil {
			summaryEn = "Direct manager changed"
			summaryAr = "تم تغيير المدير المباشر"
		}

		return u.recorder.Record(ctx, tx, actor, actor.OrganizationID, Change{
			Action:      "hr.manager.changed",
			EmployeeID:  employeeID,
			EffectiveOn: input.EffectiveFrom,
			SummaryEn:   summaryEn,
			SummaryAr:   summaryAr,
			Reason:      &input.Reason,
			Before:      before,
			After:       map[string]any{"managerEmployeeId": managerID},
			EventType:   EventManagerChanged,
			EventVersion: 1,
			EventPayload: map[string]any{
				"employeeId":        employeeID,
				"managerEmployeeId": managerID,
				"effectiveFrom":     input.EffectiveFrom,
			},
		})
	})
	return translateWriteError(err)
}

func (u *ChangeManager) assertNoCycle(ctx context.Context, employeeID, managerID string) error {
	cursor := &managerID
	for depth := 0; depth < maxReportingDepth && cursor != nil; depth++ {
		if *cursor == employeeID {
			return problem.Validation("This manager change would create a reporting cycle.")
		}
		next, err := u.directory.CurrentManagerID(ctx, *cursor)
		if err != nil {
			return problem.Internal(err)
		}
		cursor = next
	}
	return nil
}

func validateChangeManager(input ChangeManagerInput) error {
	v := &validator{}
	v.optionalIdentifier("managerEmployeeId", input.ManagerEmployeeID)
	v.businessDate("effectiveFrom", input.EffectiveFrom, true)
	v.text("reason", input.Reason, 3, 500)
	return v.err()
}
