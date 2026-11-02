package infrastructure

import (
	"context"
	"time"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/application"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
)

// EmploymentRepository is the PostgreSQL adapter for episodes, contracts and transitions.
type EmploymentRepository struct {
	pool *db.Pool
}

// NewEmploymentRepository builds the adapter.
func NewEmploymentRepository(pool *db.Pool) *EmploymentRepository {
	return &EmploymentRepository{pool: pool}
}

// InsertEpisode writes one employment episode.
func (r *EmploymentRepository) InsertEpisode(ctx context.Context, q db.Querier, episode application.EpisodeRecord, organizationID, employeeID string, now time.Time) error {
	_, err := q.Exec(ctx, `
		insert into hr.employment_episode
			(id, organization_id, employee_id, episode_no, employment_type, start_date,
			 end_date, probation_end_date, created_at)
		values ($1, $2, $3, $4, $5, $6::date, $7::date, $8::date, $9)`,
		episode.ID, organizationID, employeeID, episode.EpisodeNo, episode.EmploymentType,
		episode.StartDate, episode.EndDate, episode.ProbationEndDate, now)
	return err
}

// AddContract writes one employment contract of an episode.
func (r *EmploymentRepository) AddContract(ctx context.Context, q db.Querier, contract application.ContractRecord, organizationID string, now time.Time) error {
	_, err := q.Exec(ctx, `
		insert into hr.employment_contract
			(id, organization_id, episode_id, contract_type, start_date, end_date, signed_on,
			 archive_document_id, created_at)
		values ($1, $2, $3, $4, $5::date, $6::date, $7::date, $8, $9)`,
		contract.ID, organizationID, contract.EpisodeID, contract.ContractType,
		contract.StartDate, contract.EndDate, contract.SignedOn, contract.ArchiveDocumentID, now)
	return err
}

// CloseEpisode ends an episode. History is closed with a date, never overwritten (BIZ-003).
func (r *EmploymentRepository) CloseEpisode(ctx context.Context, q db.Querier, episodeID, endDate, endReason string) error {
	_, err := q.Exec(ctx, `
		update hr.employment_episode set end_date = $2::date, end_reason = $3
		where id = $1 and end_date is null`, episodeID, endDate, endReason)
	return err
}

// AddTransition records one lifecycle move.
func (r *EmploymentRepository) AddTransition(ctx context.Context, q db.Querier, transition application.StatusTransition) error {
	var fromStatus *string
	if transition.FromStatus != nil {
		value := string(*transition.FromStatus)
		fromStatus = &value
	}
	_, err := q.Exec(ctx, `
		insert into hr.employee_status_transition
			(id, organization_id, employee_id, from_status, to_status, effective_date,
			 recorded_at, actor_account_id, reason, end_reason)
		values ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10)`,
		transition.ID, transition.OrganizationID, transition.EmployeeID, fromStatus,
		string(transition.ToStatus), transition.EffectiveDate, transition.RecordedAt,
		transition.ActorAccountID, transition.Reason, transition.EndReason)
	return err
}
