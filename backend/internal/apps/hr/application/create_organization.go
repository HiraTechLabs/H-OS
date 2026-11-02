package application

import (
	"context"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/domain"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/audit"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/clock"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/ids"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/permissions"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

// CreateBranch creates a branch. Branches are organization-wide configuration; code uniqueness is
// per organization.
type CreateBranch struct {
	pool         Transactor
	clock        clock.Clock
	organization OrganizationRepository
	audit        *audit.Recorder
	scope        *ActorScope
}

// NewCreateBranch wires the use case.
func NewCreateBranch(pool Transactor, clk clock.Clock, organization OrganizationRepository, recorder *audit.Recorder, scope *ActorScope) *CreateBranch {
	return &CreateBranch{pool: pool, clock: clk, organization: organization, audit: recorder, scope: scope}
}

// Execute creates the branch.
func (u *CreateBranch) Execute(ctx context.Context, actor auth.Actor, input CreateBranchInput) (Branch, error) {
	if err := validateBranchInput(input); err != nil {
		return Branch{}, err
	}
	if err := u.scope.AssertOrganizationWide(actor, permissions.HROrganizationManage); err != nil {
		return Branch{}, err
	}
	exists, err := u.organization.BranchCodeExists(ctx, actor.OrganizationID, input.Code)
	if err != nil {
		return Branch{}, problem.Internal(err)
	}
	if exists {
		return Branch{}, problem.Conflict("A branch with this code already exists.")
	}

	row := BranchRow{
		ID:             ids.New(),
		OrganizationID: actor.OrganizationID,
		Code:           input.Code,
		NameEn:         trimmed(input.Name.En),
		NameAr:         trimmed(input.Name.Ar),
		TimeZone:       input.TimeZone,
	}
	err = u.pool.InTx(ctx, func(tx db.Tx) error {
		if err := u.organization.CreateBranch(ctx, tx, row, u.clock.Now()); err != nil {
			return err
		}
		return u.audit.Record(ctx, tx, &actor, actor.OrganizationID, audit.Input{
			Action:  "hr.organization.branch_created",
			Subject: audit.Subject{App: "hr", Type: "branch", ID: row.ID},
			After:   audit.Snapshot{"code": row.Code, "nameEn": row.NameEn, "nameAr": row.NameAr, "timeZone": row.TimeZone},
		})
	})
	if err != nil {
		return Branch{}, translateWriteError(err)
	}
	return toBranchView(row), nil
}

// CreateWorkLocation creates a physical work location. A location always belongs to exactly one
// branch (HHR-ORG-003).
type CreateWorkLocation struct {
	pool         Transactor
	clock        clock.Clock
	organization OrganizationRepository
	directory    DirectoryRepository
	audit        *audit.Recorder
	scope        *ActorScope
}

// NewCreateWorkLocation wires the use case.
func NewCreateWorkLocation(pool Transactor, clk clock.Clock, organization OrganizationRepository, directory DirectoryRepository, recorder *audit.Recorder, scope *ActorScope) *CreateWorkLocation {
	return &CreateWorkLocation{pool: pool, clock: clk, organization: organization, directory: directory, audit: recorder, scope: scope}
}

// Execute creates the location.
func (u *CreateWorkLocation) Execute(ctx context.Context, actor auth.Actor, input CreateWorkLocationInput) (WorkLocation, error) {
	if err := validateWorkLocationInput(input); err != nil {
		return WorkLocation{}, err
	}
	if err := u.scope.AssertOrganizationWide(actor, permissions.HROrganizationManage); err != nil {
		return WorkLocation{}, err
	}
	branchExists, err := u.directory.BranchExists(ctx, actor.OrganizationID, input.BranchID)
	if err != nil {
		return WorkLocation{}, problem.Internal(err)
	}
	if !branchExists {
		return WorkLocation{}, problem.NotFound("The branch does not exist.")
	}
	exists, err := u.organization.LocationCodeExists(ctx, actor.OrganizationID, input.Code)
	if err != nil {
		return WorkLocation{}, problem.Internal(err)
	}
	if exists {
		return WorkLocation{}, problem.Conflict("A work location with this code already exists.")
	}
	if input.AddressLine != nil && len(trimmed(*input.AddressLine)) == 0 {
		return WorkLocation{}, problem.Validation("The address line cannot be blank.")
	}

	row := WorkLocationRow{
		ID:             ids.New(),
		OrganizationID: actor.OrganizationID,
		BranchID:       input.BranchID,
		Code:           input.Code,
		NameEn:         trimmed(input.Name.En),
		NameAr:         trimmed(input.Name.Ar),
		AddressLine:    input.AddressLine,
		TimeZone:       input.TimeZone,
	}
	err = u.pool.InTx(ctx, func(tx db.Tx) error {
		if err := u.organization.CreateWorkLocation(ctx, tx, row, u.clock.Now()); err != nil {
			return err
		}
		return u.audit.Record(ctx, tx, &actor, actor.OrganizationID, audit.Input{
			Action:  "hr.organization.location_created",
			Subject: audit.Subject{App: "hr", Type: "work_location", ID: row.ID},
			After: audit.Snapshot{
				"branchId": row.BranchID, "code": row.Code, "nameEn": row.NameEn,
				"nameAr": row.NameAr, "timeZone": row.TimeZone,
			},
		})
	})
	if err != nil {
		return WorkLocation{}, translateWriteError(err)
	}
	return toWorkLocationView(row), nil
}

// CreateOrgUnit creates one org unit and its first history snapshot. The `ltree` path is derived
// from the parent path and the code, never accepted from the client; a parent must belong to the
// same branch, so the tree cannot silently cross branches (HHR-ORG-001).
type CreateOrgUnit struct {
	pool         Transactor
	clock        clock.Clock
	timeZone     string
	organization OrganizationRepository
	directory    DirectoryRepository
	audit        *audit.Recorder
	scope        *ActorScope
}

// NewCreateOrgUnit wires the use case.
func NewCreateOrgUnit(
	pool Transactor,
	clk clock.Clock,
	timeZone string,
	organization OrganizationRepository,
	directory DirectoryRepository,
	recorder *audit.Recorder,
	scope *ActorScope,
) *CreateOrgUnit {
	return &CreateOrgUnit{
		pool: pool, clock: clk, timeZone: timeZone,
		organization: organization, directory: directory, audit: recorder, scope: scope,
	}
}

// Execute creates the unit.
func (u *CreateOrgUnit) Execute(ctx context.Context, actor auth.Actor, input CreateOrgUnitInput) (OrgUnit, error) {
	if err := validateOrgUnitInput(input); err != nil {
		return OrgUnit{}, err
	}
	branchExists, err := u.directory.BranchExists(ctx, actor.OrganizationID, input.BranchID)
	if err != nil {
		return OrgUnit{}, problem.Internal(err)
	}
	if !branchExists {
		return OrgUnit{}, problem.NotFound("The branch does not exist.")
	}

	var parent *OrgUnitHeader
	if input.ParentID != nil {
		parent, err = u.directory.OrgUnitHeader(ctx, actor.OrganizationID, *input.ParentID)
		if err != nil {
			return OrgUnit{}, problem.Internal(err)
		}
		if parent == nil {
			return OrgUnit{}, problem.NotFound("The parent organization unit does not exist.")
		}
		if parent.BranchID != input.BranchID {
			return OrgUnit{}, problem.Validation("The parent organization unit belongs to a different branch.")
		}
	}

	if parent != nil {
		if err := u.scope.AssertUnitWithinScope(ctx, actor, permissions.HROrganizationManage, parent.Path); err != nil {
			return OrgUnit{}, err
		}
	} else if err := u.scope.AssertOrganizationWide(actor, permissions.HROrganizationManage); err != nil {
		return OrgUnit{}, err
	}

	exists, err := u.organization.OrgUnitCodeExists(ctx, actor.OrganizationID, input.Code)
	if err != nil {
		return OrgUnit{}, problem.Internal(err)
	}
	if exists {
		return OrgUnit{}, problem.Conflict("An organization unit with this code already exists.")
	}

	var parentPath *string
	if parent != nil {
		parentPath = &parent.Path
	}
	path, err := domain.ChildPath(parentPath, input.Code)
	if err != nil {
		return OrgUnit{}, problem.Validation("The organization unit code is not valid.")
	}

	unitID := ids.New()
	today := u.clock.Today(u.timeZone)
	row := OrgUnitRow{
		ID:             unitID,
		OrganizationID: actor.OrganizationID,
		BranchID:       input.BranchID,
		ParentID:       input.ParentID,
		Kind:           input.Kind,
		Code:           input.Code,
		NameEn:         trimmed(input.Name.En),
		NameAr:         trimmed(input.Name.Ar),
		Path:           path,
	}
	err = u.pool.InTx(ctx, func(tx db.Tx) error {
		if err := u.organization.CreateOrgUnit(ctx, tx, row, u.clock.Now()); err != nil {
			return err
		}
		if err := u.organization.AddOrgUnitHistory(ctx, tx, OrgUnitHistoryRow{
			ID:             ids.New(),
			OrganizationID: actor.OrganizationID,
			OrgUnitID:      unitID,
			ParentID:       row.ParentID,
			NameEn:         row.NameEn,
			NameAr:         row.NameAr,
			EffectiveFrom:  today,
			RecordedAt:     u.clock.Now(),
			ActorAccountID: &actor.AccountID,
			Reason:         pointerTo("Organization unit created"),
		}); err != nil {
			return err
		}
		return u.audit.Record(ctx, tx, &actor, actor.OrganizationID, audit.Input{
			Action:  "hr.organization.unit_created",
			Subject: audit.Subject{App: "hr", Type: "org_unit", ID: unitID},
			After: audit.Snapshot{
				"branchId": row.BranchID, "parentId": row.ParentID, "kind": row.Kind,
				"code": row.Code, "path": row.Path,
			},
		})
	})
	if err != nil {
		return OrgUnit{}, translateWriteError(err)
	}
	return toOrgUnitView(row), nil
}

// CreateJobTitle creates a job title. The catalogue is shared by every branch (HHR-ORG-003).
type CreateJobTitle struct {
	pool         Transactor
	clock        clock.Clock
	organization OrganizationRepository
	audit        *audit.Recorder
	scope        *ActorScope
}

// NewCreateJobTitle wires the use case.
func NewCreateJobTitle(pool Transactor, clk clock.Clock, organization OrganizationRepository, recorder *audit.Recorder, scope *ActorScope) *CreateJobTitle {
	return &CreateJobTitle{pool: pool, clock: clk, organization: organization, audit: recorder, scope: scope}
}

// Execute creates the job title.
func (u *CreateJobTitle) Execute(ctx context.Context, actor auth.Actor, input CreateJobTitleInput) (JobTitle, error) {
	if err := validateJobTitleInput(input); err != nil {
		return JobTitle{}, err
	}
	if err := u.scope.AssertOrganizationWide(actor, permissions.HROrganizationManage); err != nil {
		return JobTitle{}, err
	}
	exists, err := u.organization.JobTitleCodeExists(ctx, actor.OrganizationID, input.Code)
	if err != nil {
		return JobTitle{}, problem.Internal(err)
	}
	if exists {
		return JobTitle{}, problem.Conflict("A job title with this code already exists.")
	}

	row := JobTitleRow{
		ID:             ids.New(),
		OrganizationID: actor.OrganizationID,
		Code:           input.Code,
		NameEn:         trimmed(input.Name.En),
		NameAr:         trimmed(input.Name.Ar),
	}
	err = u.pool.InTx(ctx, func(tx db.Tx) error {
		if err := u.organization.CreateJobTitle(ctx, tx, row, u.clock.Now()); err != nil {
			return err
		}
		return u.audit.Record(ctx, tx, &actor, actor.OrganizationID, audit.Input{
			Action:  "hr.organization.job_title_created",
			Subject: audit.Subject{App: "hr", Type: "job_title", ID: row.ID},
			After:   audit.Snapshot{"code": row.Code, "nameEn": row.NameEn, "nameAr": row.NameAr},
		})
	})
	if err != nil {
		return JobTitle{}, translateWriteError(err)
	}
	return toJobTitleView(row), nil
}

// CreateJobGrade creates a job grade. Grades are an organization-wide ordinal scale (`rank`), not a
// pay scale (payroll is deferred).
type CreateJobGrade struct {
	pool         Transactor
	clock        clock.Clock
	organization OrganizationRepository
	audit        *audit.Recorder
	scope        *ActorScope
}

// NewCreateJobGrade wires the use case.
func NewCreateJobGrade(pool Transactor, clk clock.Clock, organization OrganizationRepository, recorder *audit.Recorder, scope *ActorScope) *CreateJobGrade {
	return &CreateJobGrade{pool: pool, clock: clk, organization: organization, audit: recorder, scope: scope}
}

// Execute creates the job grade.
func (u *CreateJobGrade) Execute(ctx context.Context, actor auth.Actor, input CreateJobGradeInput) (JobGrade, error) {
	if err := validateJobGradeInput(input); err != nil {
		return JobGrade{}, err
	}
	if err := u.scope.AssertOrganizationWide(actor, permissions.HROrganizationManage); err != nil {
		return JobGrade{}, err
	}
	exists, err := u.organization.JobGradeCodeExists(ctx, actor.OrganizationID, input.Code)
	if err != nil {
		return JobGrade{}, problem.Internal(err)
	}
	if exists {
		return JobGrade{}, problem.Conflict("A job grade with this code already exists.")
	}

	row := JobGradeRow{
		ID:             ids.New(),
		OrganizationID: actor.OrganizationID,
		Code:           input.Code,
		NameEn:         trimmed(input.Name.En),
		NameAr:         trimmed(input.Name.Ar),
		Rank:           input.Rank,
	}
	err = u.pool.InTx(ctx, func(tx db.Tx) error {
		if err := u.organization.CreateJobGrade(ctx, tx, row, u.clock.Now()); err != nil {
			return err
		}
		return u.audit.Record(ctx, tx, &actor, actor.OrganizationID, audit.Input{
			Action:  "hr.organization.job_grade_created",
			Subject: audit.Subject{App: "hr", Type: "job_grade", ID: row.ID},
			After:   audit.Snapshot{"code": row.Code, "rank": row.Rank, "nameEn": row.NameEn, "nameAr": row.NameAr},
		})
	})
	if err != nil {
		return JobGrade{}, translateWriteError(err)
	}
	return toJobGradeView(row), nil
}

// CreateWorkSchedule creates a weekly work pattern. This is reference data for attendance
// (deferred); no hours are derived from it and no overtime rule is implied (HR-DEC-0006).
type CreateWorkSchedule struct {
	pool         Transactor
	clock        clock.Clock
	organization OrganizationRepository
	audit        *audit.Recorder
	scope        *ActorScope
}

// NewCreateWorkSchedule wires the use case.
func NewCreateWorkSchedule(pool Transactor, clk clock.Clock, organization OrganizationRepository, recorder *audit.Recorder, scope *ActorScope) *CreateWorkSchedule {
	return &CreateWorkSchedule{pool: pool, clock: clk, organization: organization, audit: recorder, scope: scope}
}

// Execute creates the work schedule.
func (u *CreateWorkSchedule) Execute(ctx context.Context, actor auth.Actor, input CreateWorkScheduleInput) (WorkSchedule, error) {
	if err := validateWorkScheduleInput(input); err != nil {
		return WorkSchedule{}, err
	}
	if err := u.scope.AssertOrganizationWide(actor, permissions.HROrganizationManage); err != nil {
		return WorkSchedule{}, err
	}
	exists, err := u.organization.WorkScheduleCodeExists(ctx, actor.OrganizationID, input.Code)
	if err != nil {
		return WorkSchedule{}, problem.Internal(err)
	}
	if exists {
		return WorkSchedule{}, problem.Conflict("A work schedule with this code already exists.")
	}

	row := WorkScheduleRow{
		ID:             ids.New(),
		OrganizationID: actor.OrganizationID,
		Code:           input.Code,
		NameEn:         trimmed(input.Name.En),
		NameAr:         trimmed(input.Name.Ar),
		TimeZone:       input.TimeZone,
		Days:           input.Days,
	}
	err = u.pool.InTx(ctx, func(tx db.Tx) error {
		if err := u.organization.CreateWorkSchedule(ctx, tx, row, u.clock.Now()); err != nil {
			return err
		}
		return u.audit.Record(ctx, tx, &actor, actor.OrganizationID, audit.Input{
			Action:  "hr.organization.work_schedule_created",
			Subject: audit.Subject{App: "hr", Type: "work_schedule", ID: row.ID},
			After:   audit.Snapshot{"code": row.Code, "timeZone": row.TimeZone, "nameEn": row.NameEn, "nameAr": row.NameAr},
		})
	})
	if err != nil {
		return WorkSchedule{}, translateWriteError(err)
	}
	return toWorkScheduleView(row), nil
}

func validateBranchInput(input CreateBranchInput) error {
	v := &validator{}
	v.code("code", input.Code, 2, 32)
	validateLocalizedName(v, "name", input.Name)
	v.timeZone("timeZone", input.TimeZone)
	return v.err()
}

func validateWorkLocationInput(input CreateWorkLocationInput) error {
	v := &validator{}
	v.identifier("branchId", input.BranchID, true)
	v.code("code", input.Code, 2, 32)
	validateLocalizedName(v, "name", input.Name)
	v.optionalText("addressLine", input.AddressLine, 300)
	v.timeZone("timeZone", input.TimeZone)
	return v.err()
}

func validateOrgUnitInput(input CreateOrgUnitInput) error {
	v := &validator{}
	v.identifier("branchId", input.BranchID, true)
	v.optionalIdentifier("parentId", input.ParentID)
	v.oneOf("kind", input.Kind, orgUnitKindValues)
	v.code("code", input.Code, 2, 32)
	validateLocalizedName(v, "name", input.Name)
	return v.err()
}

func validateJobTitleInput(input CreateJobTitleInput) error {
	v := &validator{}
	v.code("code", input.Code, 2, 32)
	validateLocalizedName(v, "name", input.Name)
	return v.err()
}

func validateJobGradeInput(input CreateJobGradeInput) error {
	v := &validator{}
	v.code("code", input.Code, 1, 16)
	validateLocalizedName(v, "name", input.Name)
	if input.Rank < 0 || input.Rank > 999 {
		v.add("rank", "range", "Must be between 0 and 999.")
	}
	return v.err()
}

func validateWorkScheduleInput(input CreateWorkScheduleInput) error {
	v := &validator{}
	v.code("code", input.Code, 2, 32)
	validateLocalizedName(v, "name", input.Name)
	v.timeZone("timeZone", input.TimeZone)

	if len(input.Days) != 7 {
		v.add("days", "length", "A work schedule must define each weekday exactly once.")
		return v.err()
	}
	seen := make(map[int]struct{}, 7)
	for index, day := range input.Days {
		field := "days[" + itoa(index) + "]"
		if day.Weekday < 0 || day.Weekday > 6 {
			v.add(field+".weekday", "range", "Must be between 0 and 6.")
		}
		if _, duplicate := seen[day.Weekday]; duplicate {
			v.add(field+".weekday", "duplicate", "Each weekday may appear only once.")
		}
		seen[day.Weekday] = struct{}{}
		if day.BreakMinutes < 0 || day.BreakMinutes > 720 {
			v.add(field+".breakMinutes", "range", "Must be between 0 and 720.")
		}
		if day.IsRestDay {
			continue
		}
		if day.StartLocal == nil || day.EndLocal == nil {
			v.add(field, "required", "A working day requires a start and an end time.")
			continue
		}
		if !localTimePattern.MatchString(*day.StartLocal) {
			v.add(field+".startLocal", "format", "Must be HH:mm in 24-hour form.")
		}
		if !localTimePattern.MatchString(*day.EndLocal) {
			v.add(field+".endLocal", "format", "Must be HH:mm in 24-hour form.")
		}
		if !day.CrossesMidnight && *day.EndLocal <= *day.StartLocal {
			v.add(field+".endLocal", "order", "A working day must end after it starts unless it crosses midnight.")
		}
	}
	return v.err()
}

func validateLocalizedName(v *validator, prefix string, name LocalizedName) {
	v.text(prefix+".en", name.En, 1, 200)
	v.text(prefix+".ar", name.Ar, 1, 200)
}
