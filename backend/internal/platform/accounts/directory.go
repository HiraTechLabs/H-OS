// Package accounts owns the login-account surface of the platform.
//
// Other modules reference an account only through Directory: they never read `platform.account`
// themselves, which is what keeps the kernel's schema private (ARCH-002, CORE-003). Management is
// the administrative surface and is deliberately small and guarded.
package accounts

import (
	"context"
	"errors"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
)

// Summary is the public view of an account for other modules.
type Summary struct {
	ID             string
	OrganizationID string
	Email          string
	DisplayName    string
	Status         string
}

// Directory resolves accounts for other modules.
type Directory struct {
	pool *db.Pool
}

// NewDirectory builds the directory.
func NewDirectory(pool *db.Pool) *Directory { return &Directory{pool: pool} }

// FindByID returns the account, or nil when it does not exist. A missing account is a legitimate
// answer for a caller resolving an optional link, so it is not an error.
func (d *Directory) FindByID(ctx context.Context, accountID string) (*Summary, error) {
	var summary Summary
	err := d.pool.QueryRow(ctx, `
		select id::text, organization_id::text, email, display_name, status
		from platform.account where id = $1`, accountID).
		Scan(&summary.ID, &summary.OrganizationID, &summary.Email, &summary.DisplayName, &summary.Status)
	if err != nil {
		if errors.Is(err, db.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &summary, nil
}
