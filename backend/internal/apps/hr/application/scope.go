package application

import (
	"context"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/domain"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

// Identity is the caller's employee identity and organization position.
//
// H-HR resolves this itself: the platform kernel deliberately knows nothing about employees, so the
// platform never reads `hr` tables and H-HR never reads `platform` tables (BIZ-006, ARCH-003).
type Identity struct {
	EmployeeID  *string
	OrgUnitPath *string
}

// ActorScope enforces permission plus data scope on the server, before any sensitive row is read.
// Deny-by-default is the only mode: a missing grant is a refusal, never a narrower read (SEC-002).
type ActorScope struct {
	employees EmployeeRepository
	directory DirectoryRepository
}

// NewActorScope wires the scope service.
func NewActorScope(employees EmployeeRepository, directory DirectoryRepository) *ActorScope {
	return &ActorScope{employees: employees, directory: directory}
}

func requireGrant(actor auth.Actor, permission string) (auth.Scope, error) {
	scope, granted := actor.ScopeFor(permission)
	if !granted {
		return "", problem.Forbidden("You do not have permission to perform this action.")
	}
	return scope, nil
}

// IdentityOf resolves the caller's employee row and current org unit path.
func (s *ActorScope) IdentityOf(ctx context.Context, actor auth.Actor) (Identity, error) {
	employeeID, err := s.employees.FindIDByAccount(ctx, actor.OrganizationID, actor.AccountID)
	if err != nil {
		return Identity{}, problem.Internal(err)
	}
	if employeeID == nil {
		return Identity{}, nil
	}
	path, err := s.directory.CurrentOrgUnitPath(ctx, *employeeID)
	if err != nil {
		return Identity{}, problem.Internal(err)
	}
	return Identity{EmployeeID: employeeID, OrgUnitPath: path}, nil
}

// DataScope resolves the permission and the row-level scope it carries.
func (s *ActorScope) DataScope(ctx context.Context, actor auth.Actor, permission string) (DataScope, error) {
	level, err := requireGrant(actor, permission)
	if err != nil {
		return DataScope{}, err
	}
	return s.ScopeForLevel(ctx, actor, level)
}

// ScopeForLevel turns a scope level into the facts a query needs.
func (s *ActorScope) ScopeForLevel(ctx context.Context, actor auth.Actor, level auth.Scope) (DataScope, error) {
	if level == auth.ScopeAll {
		return DataScope{Level: string(level)}, nil
	}
	identity, err := s.IdentityOf(ctx, actor)
	if err != nil {
		return DataScope{}, err
	}
	return DataScope{Level: string(level), ActorEmployeeID: identity.EmployeeID, ActorOrgUnitPath: identity.OrgUnitPath}, nil
}

// AssertCanAccess authorizes one employee before the aggregate is loaded. A refusal reveals nothing
// about the target (HHR-SEC-003).
func (s *ActorScope) AssertCanAccess(ctx context.Context, actor auth.Actor, permission, targetEmployeeID string) (auth.Scope, error) {
	level, err := requireGrant(actor, permission)
	if err != nil {
		return "", err
	}
	if level == auth.ScopeAll {
		return level, nil
	}

	identity, err := s.IdentityOf(ctx, actor)
	if err != nil {
		return "", err
	}
	if level == auth.ScopeOwn {
		if identity.EmployeeID != nil && *identity.EmployeeID == targetEmployeeID {
			return level, nil
		}
		return "", problem.Forbidden("You may only access your own employee record.")
	}

	targetPath, err := s.directory.CurrentOrgUnitPath(ctx, targetEmployeeID)
	if err != nil {
		return "", problem.Internal(err)
	}
	if identity.OrgUnitPath == nil || targetPath == nil {
		return "", problem.Forbidden("You do not have access to this employee record.")
	}
	if level == auth.ScopeUnit && *targetPath == *identity.OrgUnitPath {
		return level, nil
	}
	if level == auth.ScopeSubtree && domain.IsDescendantPath(*targetPath, *identity.OrgUnitPath) {
		return level, nil
	}
	return "", problem.Forbidden("You do not have access to this employee record.")
}

// AssertOrganizationWide requires an organization-wide grant. Branches, locations, the job
// catalogue and schedules have no meaningful per-unit meaning.
func (s *ActorScope) AssertOrganizationWide(actor auth.Actor, permission string) error {
	level, err := requireGrant(actor, permission)
	if err != nil {
		return err
	}
	if level != auth.ScopeAll {
		return problem.Forbidden("You may only manage the organization units within your scope.")
	}
	return nil
}

// AssertUnitWithinScope requires that the target unit is one the caller actually governs.
func (s *ActorScope) AssertUnitWithinScope(ctx context.Context, actor auth.Actor, permission, unitPath string) error {
	level, err := requireGrant(actor, permission)
	if err != nil {
		return err
	}
	if level == auth.ScopeAll {
		return nil
	}
	identity, err := s.IdentityOf(ctx, actor)
	if err != nil {
		return err
	}
	if identity.OrgUnitPath == nil {
		return problem.Forbidden("You do not have access to this organization unit.")
	}
	if level != auth.ScopeUnit && level != auth.ScopeSubtree {
		return problem.Forbidden("You do not have access to this organization unit.")
	}
	if level == auth.ScopeUnit && unitPath != *identity.OrgUnitPath {
		return problem.Forbidden("You do not have access to this organization unit.")
	}
	if level == auth.ScopeSubtree && !domain.IsDescendantPath(unitPath, *identity.OrgUnitPath) {
		return problem.Forbidden("You do not have access to this organization unit.")
	}
	return nil
}
