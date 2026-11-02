package application

import (
	"context"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/clock"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/permissions"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

// LinkAccount links an employee to an existing platform login account. The employee record and the
// account stay separate entities (HHR-DOM-002); H-HR stores only the account ID and never reads
// platform tables directly (ARCH-003).
//
// Because a link decides which person acts under which login, it is an act of account
// administration and not an ordinary employee update: the caller needs both the H-HR permission to
// update the record and the platform permission to administer login accounts (SEC-002).
type LinkAccount struct {
	pool      Transactor
	clock     clock.Clock
	employees EmployeeRepository
	accounts  AccountDirectory
	recorder  *Recorder
	scope     *ActorScope
}

// NewLinkAccount wires the use case.
func NewLinkAccount(
	pool Transactor,
	clk clock.Clock,
	employees EmployeeRepository,
	accounts AccountDirectory,
	recorder *Recorder,
	scope *ActorScope,
) *LinkAccount {
	return &LinkAccount{pool: pool, clock: clk, employees: employees, accounts: accounts, recorder: recorder, scope: scope}
}

// Execute links the account.
func (u *LinkAccount) Execute(ctx context.Context, actor auth.Actor, employeeID string, input LinkAccountInput) error {
	if !IsUUID(employeeID) {
		return problem.Validation("The employee identifier is not valid.")
	}
	if !IsUUID(input.AccountID) {
		return problem.Validation("The login account identifier is not valid.")
	}
	if !actor.Can(permissions.PlatformAccountManage) {
		return problem.Forbidden("You do not have permission to perform this action.")
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
	if aggregate.AccountLink != nil {
		return problem.Conflict("This employee is already linked to a login account.")
	}

	account, err := u.accounts.FindByID(ctx, input.AccountID)
	if err != nil {
		return problem.Internal(err)
	}
	if account == nil || account.OrganizationID != actor.OrganizationID {
		return problem.NotFound("The login account does not exist.")
	}
	alreadyLinked, err := u.employees.FindIDByAccount(ctx, actor.OrganizationID, input.AccountID)
	if err != nil {
		return problem.Internal(err)
	}
	if alreadyLinked != nil {
		return problem.Conflict("This login account is already linked to another employee.")
	}

	now := u.clock.Now()
	err = u.pool.InTx(ctx, func(tx db.Tx) error {
		if err := u.employees.LinkAccount(ctx, tx, employeeID, actor.OrganizationID, input.AccountID, actor.AccountID, now); err != nil {
			return err
		}
		return u.recorder.Record(ctx, tx, actor, actor.OrganizationID, Change{
			Action:      "hr.employee.account_linked",
			EmployeeID:  employeeID,
			EffectiveOn: now.Format("2006-01-02"),
			SummaryEn:   "Login account linked",
			SummaryAr:   "تم ربط حساب الدخول",
			After:       map[string]any{"accountId": input.AccountID},
			EventType:   EventAccountLinked,
			EventVersion: 1,
			EventPayload: map[string]any{"employeeId": employeeID, "accountId": input.AccountID},
		})
	})
	return translateWriteError(err)
}
