package auth

import "sort"

// Scope is the data scope carried by a permission grant. It bounds *which rows* a permission
// reaches, independently of whether the permission is granted at all (SEC-002).
type Scope string

const (
	// ScopeOwn reaches only records belonging to the caller.
	ScopeOwn Scope = "own"
	// ScopeUnit reaches the caller's organizational unit.
	ScopeUnit Scope = "unit"
	// ScopeSubtree reaches the unit and everything below it.
	ScopeSubtree Scope = "subtree"
	// ScopeAll reaches every record of the organization.
	ScopeAll Scope = "all"
)

// scopeOrder ranks scopes so overlapping grants collapse to the widest one.
var scopeOrder = map[Scope]int{ScopeOwn: 0, ScopeUnit: 1, ScopeSubtree: 2, ScopeAll: 3}

// ValidScope reports whether a stored scope value is one the platform understands. A role
// permission row with any other value is a data fault, not a narrow grant.
func ValidScope(scope Scope) bool {
	_, ok := scopeOrder[scope]
	return ok
}

// Grant is one permission granted through one of the caller's roles.
type Grant struct {
	Permission string `json:"permission"`
	Scope      Scope  `json:"scope"`
}

// Actor is the authenticated caller of a request.
//
// It is rebuilt from the stored session on every request, so a permission change or a revoked
// role takes effect on the next request instead of at the next sign-in (SEC-014).
//
// The kernel knows only platform facts. The employee identity and organizational position of the
// caller are H-HR facts and are resolved by H-HR inside its own use cases (BIZ-006, ARCH-003).
type Actor struct {
	AccountID      string
	OrganizationID string
	DisplayName    string
	Email          string
	Locale         string
	Roles          []string
	Grants         []Grant
	SessionID      string
}

// ScopeFor returns the widest scope granted for a permission, and whether it is granted at all.
func (a Actor) ScopeFor(permission string) (Scope, bool) {
	widest, granted := Scope(""), false
	for _, grant := range a.Grants {
		if grant.Permission != permission {
			continue
		}
		if !granted || scopeOrder[grant.Scope] > scopeOrder[widest] {
			widest, granted = grant.Scope, true
		}
	}
	return widest, granted
}

// Can reports whether the caller holds a permission. It is the only shape authorization checks
// should take for a boolean decision; a data-scoped decision uses ScopeFor.
func (a Actor) Can(permission string) bool {
	_, granted := a.ScopeFor(permission)
	return granted
}

// CanAny reports whether the caller holds at least one of the permissions.
func (a Actor) CanAny(permissions ...string) bool {
	for _, permission := range permissions {
		if a.Can(permission) {
			return true
		}
	}
	return false
}

// PermissionCodes returns the uppercase-free, sorted list of held permissions. The client uses it
// to hide what it must not offer; the server never trusts that decision (SEC-002).
func (a Actor) PermissionCodes() []string {
	seen := make(map[string]struct{}, len(a.Grants))
	out := make([]string, 0, len(a.Grants))
	for _, grant := range a.Grants {
		if _, duplicate := seen[grant.Permission]; duplicate {
			continue
		}
		seen[grant.Permission] = struct{}{}
		out = append(out, grant.Permission)
	}
	sort.Strings(out)
	return out
}

// HasRole reports whether the caller holds one of the roles.
func (a Actor) HasRole(code string) bool {
	for _, role := range a.Roles {
		if role == code {
			return true
		}
	}
	return false
}
