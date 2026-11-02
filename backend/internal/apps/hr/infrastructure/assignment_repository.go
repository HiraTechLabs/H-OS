package infrastructure

import (
	"context"
	"time"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/application"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
)

// AssignmentRepository is the PostgreSQL adapter for effective-dated assignments and reporting.
type AssignmentRepository struct {
	pool *db.Pool
}

// NewAssignmentRepository builds the adapter.
func NewAssignmentRepository(pool *db.Pool) *AssignmentRepository {
	return &AssignmentRepository{pool: pool}
}

// AddAssignment opens one organizational assignment.
func (r *AssignmentRepository) AddAssignment(ctx context.Context, q db.Querier, assignment application.AssignmentRecord, organizationID, employeeID string, recordedAt time.Time, actorAccountID *string) error {
	_, err := q.Exec(ctx, `
		insert into hr.employee_org_assignment
			(id, organization_id, employee_id, branch_id, work_location_id, org_unit_id,
			 job_title_id, job_grade_id, work_arrangement, work_schedule_id, cost_center_ref,
			 valid_from, valid_to, reason, recorded_at, actor_account_id)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::date, $13::date, $14, $15, $16)`,
		assignment.ID, organizationID, employeeID, assignment.BranchID, assignment.WorkLocationID,
		assignment.OrgUnitID, assignment.JobTitleID, assignment.JobGradeID, assignment.WorkArrangement,
		assignment.WorkScheduleID, assignment.CostCenterRef, assignment.ValidFrom, assignment.ValidTo,
		assignment.Reason, recordedAt, actorAccountID)
	return err
}

// CloseAssignment ends the assignment at the first day the successor applies (half-open range).
func (r *AssignmentRepository) CloseAssignment(ctx context.Context, q db.Querier, assignmentID, validTo string) error {
	_, err := q.Exec(ctx, `
		update hr.employee_org_assignment set valid_to = $2::date
		where id = $1 and valid_to is null`, assignmentID, validTo)
	return err
}

// AddManager opens one reporting row. A nil manager is a first-class "no direct manager" fact.
func (r *AssignmentRepository) AddManager(ctx context.Context, q db.Querier, manager application.ManagerRecord, organizationID, employeeID string, recordedAt time.Time, actorAccountID *string) error {
	_, err := q.Exec(ctx, `
		insert into hr.employee_manager_assignment
			(id, organization_id, employee_id, manager_employee_id, valid_from, valid_to,
			 reason, recorded_at, actor_account_id)
		values ($1, $2, $3, $4, $5::date, $6::date, $7, $8, $9)`,
		manager.ID, organizationID, employeeID, manager.ManagerEmployeeID, manager.ValidFrom,
		manager.ValidTo, manager.Reason, recordedAt, actorAccountID)
	return err
}

// CloseManager ends the reporting row in force.
func (r *AssignmentRepository) CloseManager(ctx context.Context, q db.Querier, managerRowID, validTo string) error {
	_, err := q.Exec(ctx, `
		update hr.employee_manager_assignment set valid_to = $2::date
		where id = $1 and valid_to is null`, managerRowID, validTo)
	return err
}
