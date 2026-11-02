package application

import (
	"context"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/permissions"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

const timelineLimit = 100

// GetEmployeeProfile reads one employee profile after the caller's data scope has been enforced.
// Sensitive sections are decided per caller, and identifiers are returned masked: the API never
// returns a full national ID or passport number in a profile read (HHR-SEC-002).
type GetEmployeeProfile struct {
	employees    EmployeeRepository
	organization OrganizationRepository
	timeline     TimelineRepository
	accounts     AccountDirectory
	scope        *ActorScope
}

// NewGetEmployeeProfile wires the use case.
func NewGetEmployeeProfile(
	employees EmployeeRepository,
	organization OrganizationRepository,
	timeline TimelineRepository,
	accounts AccountDirectory,
	scope *ActorScope,
) *GetEmployeeProfile {
	return &GetEmployeeProfile{
		employees:    employees,
		organization: organization,
		timeline:     timeline,
		accounts:     accounts,
		scope:        scope,
	}
}

// Execute renders the profile of one employee.
func (u *GetEmployeeProfile) Execute(ctx context.Context, actor auth.Actor, employeeID string) (EmployeeProfile, error) {
	if !IsUUID(employeeID) {
		return EmployeeProfile{}, problem.Validation("The employee identifier is not valid.")
	}

	scopeLevel, err := u.scope.AssertCanAccess(ctx, actor, permissions.HREmployeeRead, employeeID)
	if err != nil {
		return EmployeeProfile{}, err
	}

	aggregate, err := u.employees.FindByID(ctx, employeeID)
	if err != nil {
		return EmployeeProfile{}, problem.Internal(err)
	}
	if aggregate == nil || aggregate.Core.OrganizationID != actor.OrganizationID {
		return EmployeeProfile{}, problem.NotFound("The employee does not exist.")
	}

	identity, err := u.scope.IdentityOf(ctx, actor)
	if err != nil {
		return EmployeeProfile{}, err
	}
	isSelf := identity.EmployeeID != nil && *identity.EmployeeID == employeeID
	canReadSensitive := actor.Can(permissions.HREmployeeReadSensitive)

	overview, err := u.organization.Overview(ctx, actor.OrganizationID)
	if err != nil {
		return EmployeeProfile{}, problem.Internal(err)
	}
	timeline, err := u.timeline.List(ctx, employeeID, timelineLimit)
	if err != nil {
		return EmployeeProfile{}, problem.Internal(err)
	}

	managers, err := u.loadManagers(ctx, aggregate)
	if err != nil {
		return EmployeeProfile{}, err
	}
	actorNames, err := u.loadActorNames(ctx, timeline)
	if err != nil {
		return EmployeeProfile{}, err
	}

	return BuildProfile(ProfileContext{
		Aggregate:        *aggregate,
		Overview:         overview,
		Managers:         managers,
		ScopeLevel:       string(scopeLevel),
		IsSelf:           isSelf,
		CanReadSensitive: canReadSensitive,
		Timeline:         timeline,
		ActorNames:       actorNames,
	}), nil
}

// Self renders the caller's own profile. An account without an employee record gets an explicit
// refusal rather than an empty page.
func (u *GetEmployeeProfile) Self(ctx context.Context, actor auth.Actor) (EmployeeProfile, error) {
	identity, err := u.scope.IdentityOf(ctx, actor)
	if err != nil {
		return EmployeeProfile{}, err
	}
	if identity.EmployeeID == nil {
		return EmployeeProfile{}, problem.Forbidden("Your login account is not linked to an employee record.")
	}
	return u.Execute(ctx, actor, *identity.EmployeeID)
}

func (u *GetEmployeeProfile) loadManagers(ctx context.Context, aggregate *EmployeeAggregate) (map[string]ManagerLookup, error) {
	lookup := make(map[string]ManagerLookup, len(aggregate.Managers))
	for _, row := range aggregate.Managers {
		if row.ManagerEmployeeID == nil {
			continue
		}
		managerID := *row.ManagerEmployeeID
		if _, seen := lookup[managerID]; seen {
			continue
		}
		manager, err := u.employees.FindByID(ctx, managerID)
		if err != nil {
			return nil, problem.Internal(err)
		}
		if manager == nil {
			continue
		}
		lookup[managerID] = ManagerLookup{
			EmployeeID:     manager.Core.ID,
			EmployeeNumber: manager.Core.EmployeeNumber,
			NameEn:         displayName(manager.Person.GivenNameEn, manager.Person.FamilyNameEn, manager.Person.GivenNameAr, manager.Person.FamilyNameAr).En,
			NameAr:         displayName(manager.Person.GivenNameEn, manager.Person.FamilyNameEn, manager.Person.GivenNameAr, manager.Person.FamilyNameAr).Ar,
		}
	}
	return lookup, nil
}

func (u *GetEmployeeProfile) loadActorNames(ctx context.Context, timeline []TimelineRecord) (map[string]string, error) {
	names := make(map[string]string, len(timeline))
	for _, entry := range timeline {
		if entry.ActorAccountID == nil {
			continue
		}
		accountID := *entry.ActorAccountID
		if _, seen := names[accountID]; seen {
			continue
		}
		account, err := u.accounts.FindByID(ctx, accountID)
		if err != nil {
			return nil, problem.Internal(err)
		}
		if account == nil {
			continue
		}
		names[accountID] = account.DisplayName
	}
	return names, nil
}
