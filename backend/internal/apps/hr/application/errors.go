package application

import (
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

// translateWriteError keeps a typed application error intact and turns an unexpected storage
// failure into a stable, non-leaking problem. A unique-constraint violation is a conflict: the
// database index is the authority for uniqueness, and a concurrent writer must not surface as 500.
func translateWriteError(err error) error {
	if err == nil {
		return nil
	}
	if appErr, ok := problem.As(err); ok {
		return appErr
	}
	if db.IsUniqueViolation(err) {
		return problem.Conflict("The record conflicts with an existing record.")
	}
	return problem.Internal(err)
}
