package application

import (
	"context"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/domain"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/permissions"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

// Page bounds. An unbounded query is forbidden (PERF-003), so the use case clamps even when the
// transport already validated the request.
const (
	defaultPageSize = 25
	maxPageSize     = 100
)

// ListEmployeesInput is the decoded list query.
type ListEmployeesInput struct {
	Query             string
	Statuses          []string
	BranchID          string
	OrgUnitID         string
	JobTitleID        string
	WorkLocationID    string
	ManagerEmployeeID string
	Limit             int
	Cursor            string
}

// ListEmployees is the permission-aware employee list. The data scope is translated into a SQL
// predicate by the repository, never applied in memory (SEC-003).
type ListEmployees struct {
	employees EmployeeRepository
	scope     *ActorScope
}

// NewListEmployees wires the use case.
func NewListEmployees(employees EmployeeRepository, scope *ActorScope) *ListEmployees {
	return &ListEmployees{employees: employees, scope: scope}
}

// Execute returns one bounded page.
func (u *ListEmployees) Execute(ctx context.Context, actor auth.Actor, input ListEmployeesInput) (EmployeeSearchResult, error) {
	if err := validateListQuery(input); err != nil {
		return EmployeeSearchResult{}, err
	}

	scope, err := u.scope.DataScope(ctx, actor, permissions.HREmployeeRead)
	if err != nil {
		return EmployeeSearchResult{}, err
	}

	limit := input.Limit
	if limit <= 0 {
		limit = defaultPageSize
	}
	if limit > maxPageSize {
		limit = maxPageSize
	}

	var cursor *Cursor
	if input.Cursor != "" {
		cursor, err = decodeCursor(input.Cursor)
		if err != nil {
			return EmployeeSearchResult{}, err
		}
	}

	statuses := make([]domain.EmploymentStatus, 0, len(input.Statuses))
	for _, status := range input.Statuses {
		statuses = append(statuses, domain.EmploymentStatus(status))
	}

	page, err := u.employees.Search(ctx, actor.OrganizationID, SearchFilter{
		Query:             trimmed(input.Query),
		Statuses:          statuses,
		BranchID:          input.BranchID,
		OrgUnitID:         input.OrgUnitID,
		JobTitleID:        input.JobTitleID,
		WorkLocationID:    input.WorkLocationID,
		ManagerEmployeeID: input.ManagerEmployeeID,
	}, scope, limit, cursor)
	if err != nil {
		return EmployeeSearchResult{}, problem.Internal(err)
	}

	items := make([]EmployeeSearchItem, 0, len(page.Rows))
	for _, row := range page.Rows {
		items = append(items, EmployeeSearchItem{
			ID:             row.ID,
			EmployeeNumber: row.EmployeeNumber,
			DisplayName:    LocalizedText{En: row.DisplayNameEn, Ar: row.DisplayNameAr},
			Status:         string(row.Status),
			WorkEmail:      row.WorkEmail,
		})
	}

	result := EmployeeSearchResult{Items: items}
	if page.NextCursor != nil {
		next := encodeCursor(*page.NextCursor)
		result.NextCursor = &next
	}
	return result, nil
}

func validateListQuery(input ListEmployeesInput) error {
	v := &validator{}
	if input.Limit < 0 || input.Limit > maxPageSize {
		v.add("limit", "range", "Must be between 1 and 100.")
	}
	if len([]rune(input.Query)) > 120 {
		v.add("q", "length", "Must be at most 120 characters.")
	}
	if len(input.Statuses) > 8 {
		v.add("status", "length", "At most 8 statuses may be requested.")
	}
	for _, status := range input.Statuses {
		if !domain.IsEmploymentStatus(status) {
			v.add("status", "enum", "Unknown employment status.")
			break
		}
	}
	if input.BranchID != "" && !IsUUID(input.BranchID) {
		v.add("branchId", "format", "Must be an identifier.")
	}
	if input.OrgUnitID != "" && !IsUUID(input.OrgUnitID) {
		v.add("orgUnitId", "format", "Must be an identifier.")
	}
	if input.JobTitleID != "" && !IsUUID(input.JobTitleID) {
		v.add("jobTitleId", "format", "Must be an identifier.")
	}
	if input.WorkLocationID != "" && !IsUUID(input.WorkLocationID) {
		v.add("workLocationId", "format", "Must be an identifier.")
	}
	if input.ManagerEmployeeID != "" && !IsUUID(input.ManagerEmployeeID) {
		v.add("managerEmployeeId", "format", "Must be an identifier.")
	}
	if len(input.Cursor) > 512 {
		v.add("cursor", "length", "Must be at most 512 characters.")
	}
	return v.err()
}
