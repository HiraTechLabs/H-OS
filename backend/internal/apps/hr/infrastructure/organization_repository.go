package infrastructure

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/application"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
)

// OrganizationRepository is the PostgreSQL adapter for organization reference data.
type OrganizationRepository struct {
	pool *db.Pool
}

// NewOrganizationRepository builds the adapter.
func NewOrganizationRepository(pool *db.Pool) *OrganizationRepository {
	return &OrganizationRepository{pool: pool}
}

// Overview reads every reference set an employee form or profile needs.
func (r *OrganizationRepository) Overview(ctx context.Context, organizationID string) (application.OrganizationOverviewData, error) {
	data := application.OrganizationOverviewData{
		Branches:      []application.BranchRow{},
		Locations:     []application.WorkLocationRow{},
		OrgUnits:      []application.OrgUnitRow{},
		JobTitles:     []application.JobTitleRow{},
		JobGrades:     []application.JobGradeRow{},
		WorkSchedules: []application.WorkScheduleRow{},
	}

	branches, err := r.pool.Query(ctx, `
		select id::text, organization_id::text, code, name_en, name_ar, time_zone, archived_at
		from hr.branch where organization_id = $1 order by code`, organizationID)
	if err != nil {
		return data, err
	}
	for branches.Next() {
		var row application.BranchRow
		if err := branches.Scan(&row.ID, &row.OrganizationID, &row.Code, &row.NameEn, &row.NameAr, &row.TimeZone, &row.ArchivedAt); err != nil {
			branches.Close()
			return data, err
		}
		data.Branches = append(data.Branches, row)
	}
	branches.Close()
	if err := branches.Err(); err != nil {
		return data, err
	}

	locations, err := r.pool.Query(ctx, `
		select id::text, organization_id::text, branch_id::text, code, name_en, name_ar,
		       address_line, time_zone, archived_at
		from hr.work_location where organization_id = $1 order by code`, organizationID)
	if err != nil {
		return data, err
	}
	for locations.Next() {
		var row application.WorkLocationRow
		if err := locations.Scan(&row.ID, &row.OrganizationID, &row.BranchID, &row.Code, &row.NameEn,
			&row.NameAr, &row.AddressLine, &row.TimeZone, &row.ArchivedAt); err != nil {
			locations.Close()
			return data, err
		}
		data.Locations = append(data.Locations, row)
	}
	locations.Close()
	if err := locations.Err(); err != nil {
		return data, err
	}

	units, err := r.pool.Query(ctx, `
		select id::text, organization_id::text, branch_id::text, parent_id::text, kind, code,
		       name_en, name_ar, path::text, archived_at
		from hr.org_unit where organization_id = $1 order by path`, organizationID)
	if err != nil {
		return data, err
	}
	for units.Next() {
		var row application.OrgUnitRow
		if err := units.Scan(&row.ID, &row.OrganizationID, &row.BranchID, &row.ParentID, &row.Kind,
			&row.Code, &row.NameEn, &row.NameAr, &row.Path, &row.ArchivedAt); err != nil {
			units.Close()
			return data, err
		}
		data.OrgUnits = append(data.OrgUnits, row)
	}
	units.Close()
	if err := units.Err(); err != nil {
		return data, err
	}

	titles, err := r.pool.Query(ctx, `
		select id::text, organization_id::text, code, name_en, name_ar, archived_at
		from hr.job_title where organization_id = $1 order by code`, organizationID)
	if err != nil {
		return data, err
	}
	for titles.Next() {
		var row application.JobTitleRow
		if err := titles.Scan(&row.ID, &row.OrganizationID, &row.Code, &row.NameEn, &row.NameAr, &row.ArchivedAt); err != nil {
			titles.Close()
			return data, err
		}
		data.JobTitles = append(data.JobTitles, row)
	}
	titles.Close()
	if err := titles.Err(); err != nil {
		return data, err
	}

	grades, err := r.pool.Query(ctx, `
		select id::text, organization_id::text, code, name_en, name_ar, rank, archived_at
		from hr.job_grade where organization_id = $1 order by rank, code`, organizationID)
	if err != nil {
		return data, err
	}
	for grades.Next() {
		var row application.JobGradeRow
		if err := grades.Scan(&row.ID, &row.OrganizationID, &row.Code, &row.NameEn, &row.NameAr, &row.Rank, &row.ArchivedAt); err != nil {
			grades.Close()
			return data, err
		}
		data.JobGrades = append(data.JobGrades, row)
	}
	grades.Close()
	if err := grades.Err(); err != nil {
		return data, err
	}

	schedules, err := r.pool.Query(ctx, `
		select id::text, organization_id::text, code, name_en, name_ar, time_zone, days, archived_at
		from hr.work_schedule where organization_id = $1 order by code`, organizationID)
	if err != nil {
		return data, err
	}
	defer schedules.Close()
	for schedules.Next() {
		var (
			row  application.WorkScheduleRow
			days []byte
		)
		if err := schedules.Scan(&row.ID, &row.OrganizationID, &row.Code, &row.NameEn, &row.NameAr,
			&row.TimeZone, &days, &row.ArchivedAt); err != nil {
			return data, err
		}
		row.Days = []application.WorkScheduleDay{}
		if len(days) > 0 {
			if err := json.Unmarshal(days, &row.Days); err != nil {
				return data, err
			}
		}
		data.WorkSchedules = append(data.WorkSchedules, row)
	}
	return data, schedules.Err()
}

// CreateBranch inserts a branch.
func (r *OrganizationRepository) CreateBranch(ctx context.Context, q db.Querier, row application.BranchRow, now time.Time) error {
	_, err := q.Exec(ctx, `
		insert into hr.branch (id, organization_id, code, name_en, name_ar, time_zone, archived_at, created_at)
		values ($1, $2, $3, $4, $5, $6, $7, $8)`,
		row.ID, row.OrganizationID, row.Code, row.NameEn, row.NameAr, row.TimeZone, row.ArchivedAt, now)
	return err
}

// CreateWorkLocation inserts a work location.
func (r *OrganizationRepository) CreateWorkLocation(ctx context.Context, q db.Querier, row application.WorkLocationRow, now time.Time) error {
	_, err := q.Exec(ctx, `
		insert into hr.work_location
			(id, organization_id, branch_id, code, name_en, name_ar, address_line, time_zone, archived_at, created_at)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		row.ID, row.OrganizationID, row.BranchID, row.Code, row.NameEn, row.NameAr,
		row.AddressLine, row.TimeZone, row.ArchivedAt, now)
	return err
}

// CreateOrgUnit inserts one node. The ltree path is computed by the domain, never accepted from
// the client.
func (r *OrganizationRepository) CreateOrgUnit(ctx context.Context, q db.Querier, row application.OrgUnitRow, now time.Time) error {
	_, err := q.Exec(ctx, `
		insert into hr.org_unit
			(id, organization_id, branch_id, parent_id, kind, code, name_en, name_ar, path, archived_at, created_at)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9::ltree, $10, $11)`,
		row.ID, row.OrganizationID, row.BranchID, row.ParentID, row.Kind, row.Code,
		row.NameEn, row.NameAr, row.Path, row.ArchivedAt, now)
	return err
}

// AddOrgUnitHistory writes the first historical snapshot of a unit.
func (r *OrganizationRepository) AddOrgUnitHistory(ctx context.Context, q db.Querier, row application.OrgUnitHistoryRow) error {
	_, err := q.Exec(ctx, `
		insert into hr.org_unit_history
			(id, organization_id, org_unit_id, parent_id, name_en, name_ar,
			 effective_from, recorded_at, actor_account_id, reason)
		values ($1, $2, $3, $4, $5, $6, $7::date, $8, $9, $10)`,
		row.ID, row.OrganizationID, row.OrgUnitID, row.ParentID, row.NameEn, row.NameAr,
		row.EffectiveFrom, row.RecordedAt, row.ActorAccountID, row.Reason)
	return err
}

// CreateJobTitle inserts a job title.
func (r *OrganizationRepository) CreateJobTitle(ctx context.Context, q db.Querier, row application.JobTitleRow, now time.Time) error {
	_, err := q.Exec(ctx, `
		insert into hr.job_title (id, organization_id, code, name_en, name_ar, archived_at, created_at)
		values ($1, $2, $3, $4, $5, $6, $7)`,
		row.ID, row.OrganizationID, row.Code, row.NameEn, row.NameAr, row.ArchivedAt, now)
	return err
}

// CreateJobGrade inserts a job grade.
func (r *OrganizationRepository) CreateJobGrade(ctx context.Context, q db.Querier, row application.JobGradeRow, now time.Time) error {
	_, err := q.Exec(ctx, `
		insert into hr.job_grade (id, organization_id, code, name_en, name_ar, rank, archived_at, created_at)
		values ($1, $2, $3, $4, $5, $6, $7, $8)`,
		row.ID, row.OrganizationID, row.Code, row.NameEn, row.NameAr, row.Rank, row.ArchivedAt, now)
	return err
}

// CreateWorkSchedule inserts a weekly work pattern.
func (r *OrganizationRepository) CreateWorkSchedule(ctx context.Context, q db.Querier, row application.WorkScheduleRow, now time.Time) error {
	days, err := json.Marshal(row.Days)
	if err != nil {
		return err
	}
	_, err = q.Exec(ctx, `
		insert into hr.work_schedule
			(id, organization_id, code, name_en, name_ar, time_zone, days, archived_at, created_at)
		values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
		row.ID, row.OrganizationID, row.Code, row.NameEn, row.NameAr, row.TimeZone,
		string(days), row.ArchivedAt, now)
	return err
}

func (r *OrganizationRepository) codeExists(ctx context.Context, table, organizationID, code string) (bool, error) {
	// The table name is a package constant, never user input.
	var one int
	err := r.pool.QueryRow(ctx,
		`select 1 from `+table+` where organization_id = $1 and code = $2 limit 1`,
		organizationID, code).Scan(&one)
	if err != nil {
		if errors.Is(err, db.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// BranchCodeExists reports whether the branch code is taken.
func (r *OrganizationRepository) BranchCodeExists(ctx context.Context, organizationID, code string) (bool, error) {
	return r.codeExists(ctx, "hr.branch", organizationID, code)
}

// LocationCodeExists reports whether the work-location code is taken.
func (r *OrganizationRepository) LocationCodeExists(ctx context.Context, organizationID, code string) (bool, error) {
	return r.codeExists(ctx, "hr.work_location", organizationID, code)
}

// OrgUnitCodeExists reports whether the org-unit code is taken.
func (r *OrganizationRepository) OrgUnitCodeExists(ctx context.Context, organizationID, code string) (bool, error) {
	return r.codeExists(ctx, "hr.org_unit", organizationID, code)
}

// JobTitleCodeExists reports whether the job-title code is taken.
func (r *OrganizationRepository) JobTitleCodeExists(ctx context.Context, organizationID, code string) (bool, error) {
	return r.codeExists(ctx, "hr.job_title", organizationID, code)
}

// JobGradeCodeExists reports whether the job-grade code is taken.
func (r *OrganizationRepository) JobGradeCodeExists(ctx context.Context, organizationID, code string) (bool, error) {
	return r.codeExists(ctx, "hr.job_grade", organizationID, code)
}

// WorkScheduleCodeExists reports whether the schedule code is taken.
func (r *OrganizationRepository) WorkScheduleCodeExists(ctx context.Context, organizationID, code string) (bool, error) {
	return r.codeExists(ctx, "hr.work_schedule", organizationID, code)
}
