// Package links stores typed references between records of different applications.
//
// A cross-application reference is an app/type/id triple resolved through the platform, never a URL
// string and never a cross-schema join. H-HR stores `archive:document` and `asset:asset` links this
// way, which keeps each application's tables private while the relationships stay queryable.
package links

import (
	"context"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/clock"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/ids"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/outbox"
)

// Ref is a typed reference to a record in one application.
type Ref struct {
	App  string `json:"app"`
	Type string `json:"type"`
	ID   string `json:"id"`
}

// Service reads and writes links.
type Service struct {
	clock clock.Clock
}

// NewService builds the link service.
func NewService(clk clock.Clock) *Service { return &Service{clock: clk} }

// Link attaches targets to a source record. Re-linking the same target is a no-op, so a retried
// command does not create duplicates.
func (s *Service) Link(ctx context.Context, q db.Querier, organizationID string, source outbox.Subject, targets []Ref) error {
	now := s.clock.Now()
	for _, target := range targets {
		if _, err := q.Exec(ctx, `
			insert into platform.entity_link
				(id, organization_id, source_app, source_type, source_id,
				 target_app, target_type, target_id, created_at)
			values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			on conflict on constraint entity_link_unique do nothing`,
			ids.New(), organizationID, source.App, source.Type, source.ID,
			target.App, target.Type, target.ID, now); err != nil {
			return err
		}
	}
	return nil
}

// TargetsOf lists the references attached to a source record, optionally narrowed to one target
// application.
func (s *Service) TargetsOf(ctx context.Context, q db.Querier, organizationID string, source outbox.Subject, targetApp string) ([]Ref, error) {
	sql := `
		select target_app, target_type, target_id
		from platform.entity_link
		where organization_id = $1 and source_app = $2 and source_type = $3 and source_id = $4`
	args := []any{organizationID, source.App, source.Type, source.ID}
	if targetApp != "" {
		sql += ` and target_app = $5`
		args = append(args, targetApp)
	}
	sql += ` order by target_app, target_type, target_id`

	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]Ref, 0, 4)
	for rows.Next() {
		var ref Ref
		if err := rows.Scan(&ref.App, &ref.Type, &ref.ID); err != nil {
			return nil, err
		}
		out = append(out, ref)
	}
	return out, rows.Err()
}
