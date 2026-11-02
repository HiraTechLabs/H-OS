package infrastructure

import (
	"context"
	"errors"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/application"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
)

// DirectoryRepository answers cheap existence and scope questions before a use case loads an
// aggregate, so an unauthorized caller never causes sensitive rows to be read (SEC-003).
type DirectoryRepository struct {
	pool *db.Pool
}

// NewDirectoryRepository builds the adapter.
func NewDirectoryRepository(pool *db.Pool) *DirectoryRepository {
	return &DirectoryRepository{pool: pool}
}

func (r *DirectoryRepository) exists(ctx context.Context, sql string, args ...any) (bool, error) {
	var one int
	err := r.pool.QueryRow(ctx, sql, args...).Scan(&one)
	if err != nil {
		if errors.Is(err, db.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// BranchExists reports whether the branch belongs to the organization.
func (r *DirectoryRepository) BranchExists(ctx context.Context, organizationID, branchID string) (bool, error) {
	return r.exists(ctx, `
		select 1 from hr.branch where id = $1::uuid and organization_id = $2`, branchID, organizationID)
}

// WorkLocationBelongsTo reports whether the location exists inside the branch.
func (r *DirectoryRepository) WorkLocationBelongsTo(ctx context.Context, organizationID, locationID, branchID string) (bool, error) {
	return r.exists(ctx, `
		select 1 from hr.work_location
		where id = $1::uuid and organization_id = $2 and branch_id = $3::uuid`,
		locationID, organizationID, branchID)
}

// LocationBranch returns the branch that owns an active work location.
func (r *DirectoryRepository) LocationBranch(ctx context.Context, organizationID, locationID string) (*string, error) {
	var branchID string
	err := r.pool.QueryRow(ctx, `
		select branch_id::text from hr.work_location
		where id = $1::uuid and organization_id = $2 and archived_at is null`,
		locationID, organizationID).Scan(&branchID)
	if err != nil {
		if errors.Is(err, db.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &branchID, nil
}

// OrgUnitHeader returns the identity, path and branch of one unit.
func (r *DirectoryRepository) OrgUnitHeader(ctx context.Context, organizationID, unitID string) (*application.OrgUnitHeader, error) {
	var header application.OrgUnitHeader
	err := r.pool.QueryRow(ctx, `
		select id::text, path::text, branch_id::text from hr.org_unit
		where id = $1::uuid and organization_id = $2`, unitID, organizationID).
		Scan(&header.ID, &header.Path, &header.BranchID)
	if err != nil {
		if errors.Is(err, db.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &header, nil
}

// JobTitleExists reports whether the job title belongs to the organization.
func (r *DirectoryRepository) JobTitleExists(ctx context.Context, organizationID, jobTitleID string) (bool, error) {
	return r.exists(ctx, `
		select 1 from hr.job_title where id = $1::uuid and organization_id = $2`, jobTitleID, organizationID)
}

// JobGradeExists reports whether the job grade belongs to the organization.
func (r *DirectoryRepository) JobGradeExists(ctx context.Context, organizationID, jobGradeID string) (bool, error) {
	return r.exists(ctx, `
		select 1 from hr.job_grade where id = $1::uuid and organization_id = $2`, jobGradeID, organizationID)
}

// WorkScheduleExists reports whether the schedule belongs to the organization.
func (r *DirectoryRepository) WorkScheduleExists(ctx context.Context, organizationID, scheduleID string) (bool, error) {
	return r.exists(ctx, `
		select 1 from hr.work_schedule where id = $1::uuid and organization_id = $2`, scheduleID, organizationID)
}

// CurrentOrgUnitPath returns the ltree path of the assignment in force.
func (r *DirectoryRepository) CurrentOrgUnitPath(ctx context.Context, employeeID string) (*string, error) {
	var path string
	err := r.pool.QueryRow(ctx, `
		select ou.path::text
		from hr.employee_org_assignment a
		join hr.org_unit ou on ou.id = a.org_unit_id
		where a.employee_id = $1::uuid and a.valid_to is null
		order by a.valid_from desc, a.id
		limit 1`, employeeID).Scan(&path)
	if err != nil {
		if errors.Is(err, db.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &path, nil
}

// CurrentManagerID returns the direct manager in force, if any.
func (r *DirectoryRepository) CurrentManagerID(ctx context.Context, employeeID string) (*string, error) {
	var managerID *string
	err := r.pool.QueryRow(ctx, `
		select manager_employee_id::text from hr.employee_manager_assignment
		where employee_id = $1::uuid and valid_to is null`, employeeID).Scan(&managerID)
	if err != nil {
		if errors.Is(err, db.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return managerID, nil
}
