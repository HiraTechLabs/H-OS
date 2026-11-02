package infrastructure

import (
	"context"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/application"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
)

// TimelineRepository is the PostgreSQL adapter for the employee timeline.
type TimelineRepository struct {
	pool *db.Pool
}

// NewTimelineRepository builds the adapter.
func NewTimelineRepository(pool *db.Pool) *TimelineRepository {
	return &TimelineRepository{pool: pool}
}

// Add appends one timeline entry.
func (r *TimelineRepository) Add(ctx context.Context, q db.Querier, entry application.TimelineEntryInput) error {
	_, err := q.Exec(ctx, `
		insert into hr.employee_timeline
			(id, organization_id, employee_id, event_type, occurred_on, recorded_at,
			 summary_en, summary_ar, actor_account_id, reason, related_type, related_id)
		values ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, $12)`,
		entry.ID, entry.OrganizationID, entry.EmployeeID, entry.EventType, entry.OccurredOn,
		entry.RecordedAt, entry.SummaryEn, entry.SummaryAr, entry.ActorAccountID,
		entry.Reason, entry.RelatedType, entry.RelatedID)
	return err
}

// List returns the most recent timeline entries first.
func (r *TimelineRepository) List(ctx context.Context, employeeID string, limit int) ([]application.TimelineRecord, error) {
	rows, err := r.pool.Query(ctx, `
		select id::text, event_type, occurred_on::text, recorded_at, summary_en, summary_ar,
		       reason, actor_account_id::text
		from hr.employee_timeline
		where employee_id = $1
		order by occurred_on desc, recorded_at desc
		limit $2`, employeeID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]application.TimelineRecord, 0, limit)
	for rows.Next() {
		var entry application.TimelineRecord
		if err := rows.Scan(&entry.ID, &entry.EventType, &entry.OccurredOn, &entry.RecordedAt,
			&entry.SummaryEn, &entry.SummaryAr, &entry.Reason, &entry.ActorAccountID); err != nil {
			return nil, err
		}
		out = append(out, entry)
	}
	return out, rows.Err()
}
