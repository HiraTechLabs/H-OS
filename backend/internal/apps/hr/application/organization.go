package application

import (
	"context"
	"time"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/permissions"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

// GetOrganization returns the reference data used to populate employee forms and profiles. Reading
// structure is a separate permission from managing it (SEC-002), so a self-service account can
// render labels without being able to change the tree.
type GetOrganization struct {
	organization OrganizationRepository
}

// NewGetOrganization wires the use case.
func NewGetOrganization(organization OrganizationRepository) *GetOrganization {
	return &GetOrganization{organization: organization}
}

// Execute returns the overview.
func (u *GetOrganization) Execute(ctx context.Context, actor auth.Actor) (OrganizationOverview, error) {
	if !actor.Can(permissions.HROrganizationRead) {
		return OrganizationOverview{}, problem.Forbidden("You do not have permission to perform this action.")
	}
	data, err := u.organization.Overview(ctx, actor.OrganizationID)
	if err != nil {
		return OrganizationOverview{}, problem.Internal(err)
	}
	return toOrganizationOverview(data), nil
}

func archivedAt(value *time.Time) *string {
	if value == nil {
		return nil
	}
	formatted := value.UTC().Format(time.RFC3339)
	return &formatted
}

func localized(en, ar string) LocalizedText { return LocalizedText{En: en, Ar: ar} }

func toBranchView(row BranchRow) Branch {
	return Branch{
		ID:         row.ID,
		Code:       row.Code,
		Name:       localized(row.NameEn, row.NameAr),
		TimeZone:   row.TimeZone,
		ArchivedAt: archivedAt(row.ArchivedAt),
	}
}

func toWorkLocationView(row WorkLocationRow) WorkLocation {
	return WorkLocation{
		ID:          row.ID,
		BranchID:    row.BranchID,
		Code:        row.Code,
		Name:        localized(row.NameEn, row.NameAr),
		AddressLine: row.AddressLine,
		TimeZone:    row.TimeZone,
		ArchivedAt:  archivedAt(row.ArchivedAt),
	}
}

func toOrgUnitView(row OrgUnitRow) OrgUnit {
	return OrgUnit{
		ID:         row.ID,
		BranchID:   row.BranchID,
		ParentID:   row.ParentID,
		Kind:       row.Kind,
		Code:       row.Code,
		Name:       localized(row.NameEn, row.NameAr),
		Path:       row.Path,
		ArchivedAt: archivedAt(row.ArchivedAt),
	}
}

func toJobTitleView(row JobTitleRow) JobTitle {
	return JobTitle{
		ID:         row.ID,
		Code:       row.Code,
		Name:       localized(row.NameEn, row.NameAr),
		ArchivedAt: archivedAt(row.ArchivedAt),
	}
}

func toJobGradeView(row JobGradeRow) JobGrade {
	return JobGrade{
		ID:         row.ID,
		Code:       row.Code,
		Name:       localized(row.NameEn, row.NameAr),
		Rank:       row.Rank,
		ArchivedAt: archivedAt(row.ArchivedAt),
	}
}

func toWorkScheduleView(row WorkScheduleRow) WorkSchedule {
	days := row.Days
	if days == nil {
		days = []WorkScheduleDay{}
	}
	return WorkSchedule{
		ID:         row.ID,
		Code:       row.Code,
		Name:       localized(row.NameEn, row.NameAr),
		TimeZone:   row.TimeZone,
		Days:       days,
		ArchivedAt: archivedAt(row.ArchivedAt),
	}
}

func toOrganizationOverview(data OrganizationOverviewData) OrganizationOverview {
	overview := OrganizationOverview{
		Branches:      make([]Branch, 0, len(data.Branches)),
		Locations:     make([]WorkLocation, 0, len(data.Locations)),
		OrgUnits:      make([]OrgUnit, 0, len(data.OrgUnits)),
		JobTitles:     make([]JobTitle, 0, len(data.JobTitles)),
		JobGrades:     make([]JobGrade, 0, len(data.JobGrades)),
		WorkSchedules: make([]WorkSchedule, 0, len(data.WorkSchedules)),
	}
	for _, row := range data.Branches {
		overview.Branches = append(overview.Branches, toBranchView(row))
	}
	for _, row := range data.Locations {
		overview.Locations = append(overview.Locations, toWorkLocationView(row))
	}
	for _, row := range data.OrgUnits {
		overview.OrgUnits = append(overview.OrgUnits, toOrgUnitView(row))
	}
	for _, row := range data.JobTitles {
		overview.JobTitles = append(overview.JobTitles, toJobTitleView(row))
	}
	for _, row := range data.JobGrades {
		overview.JobGrades = append(overview.JobGrades, toJobGradeView(row))
	}
	for _, row := range data.WorkSchedules {
		overview.WorkSchedules = append(overview.WorkSchedules, toWorkScheduleView(row))
	}
	return overview
}
