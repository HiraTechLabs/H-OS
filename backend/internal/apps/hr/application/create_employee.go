package application

import (
	"context"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/domain"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/clock"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/ids"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/permissions"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

// Event type names. They carry the schema version in the name, matching the published contracts;
// the outbox stores the numeric version separately.
const (
	EventEmployeeCreated      = "hr.employee.created.v1"
	EventEmployeeUpdated      = "hr.employee.updated.v1"
	EventEmployeeStatusChange = "hr.employee.status-changed.v1"
	EventAssignmentChanged    = "hr.assignment.changed.v1"
	EventManagerChanged       = "hr.manager.changed.v1"
	EventAccountLinked        = "hr.account-linked.v1"
)

// CreateEmployee creates the employee aggregate in one transaction: identity, person, contact,
// first employment episode, contract, first assignment, manager row, initial status transition,
// timeline, audit and outbox event (HHR-DOM-001, HR-DEC-0001, ARCH-008).
//
// An employee is created without a login account and without a manager by default (HHR-DOM-002,
// HHR-ORG-002); both are optional inputs.
type CreateEmployee struct {
	pool        Transactor
	clock       clock.Clock
	timeZone    string
	employees   EmployeeRepository
	employment  EmploymentRepository
	assignments AssignmentRepository
	directory   DirectoryRepository
	cipher      FieldProtector
	accounts    AccountDirectory
	recorder    *Recorder
	scope       *ActorScope
}

// NewCreateEmployee wires the use case with explicit dependencies.
func NewCreateEmployee(
	pool Transactor,
	clk clock.Clock,
	timeZone string,
	employees EmployeeRepository,
	employment EmploymentRepository,
	assignments AssignmentRepository,
	directory DirectoryRepository,
	cipher FieldProtector,
	accounts AccountDirectory,
	recorder *Recorder,
	scope *ActorScope,
) *CreateEmployee {
	return &CreateEmployee{
		pool:        pool,
		clock:       clk,
		timeZone:    timeZone,
		employees:   employees,
		employment:  employment,
		assignments: assignments,
		directory:   directory,
		cipher:      cipher,
		accounts:    accounts,
		recorder:    recorder,
		scope:       scope,
	}
}

// Execute validates the command and creates the aggregate.
func (u *CreateEmployee) Execute(ctx context.Context, actor auth.Actor, input CreateEmployeeInput) (CreateEmployeeResult, error) {
	if err := validateCreateEmployee(input); err != nil {
		return CreateEmployeeResult{}, err
	}

	organizationID := actor.OrganizationID
	unit, err := u.directory.OrgUnitHeader(ctx, organizationID, input.Assignment.OrgUnitID)
	if err != nil {
		return CreateEmployeeResult{}, problem.Internal(err)
	}
	if unit == nil {
		return CreateEmployeeResult{}, problem.NotFound("The organization unit does not exist.")
	}
	if err := u.scope.AssertUnitWithinScope(ctx, actor, permissions.HREmployeeCreate, unit.Path); err != nil {
		return CreateEmployeeResult{}, err
	}
	if err := u.validateReferences(ctx, organizationID, input); err != nil {
		return CreateEmployeeResult{}, err
	}

	if contract := input.Employment.Contract; contract != nil {
		endDate := "9999-12-31"
		if contract.EndDate != nil {
			endDate = *contract.EndDate
		}
		if domain.IsBefore(endDate, contract.StartDate) {
			return CreateEmployeeResult{}, problem.Validation("The contract end date cannot be before its start date.")
		}
	}

	var nationalIDHash *string
	if input.Personal.NationalID != nil {
		hash := u.cipher.LookupHash(*input.Personal.NationalID)
		nationalIDHash = &hash
		exists, err := u.employees.NationalIDHashExists(ctx, organizationID, hash)
		if err != nil {
			return CreateEmployeeResult{}, problem.Internal(err)
		}
		if exists {
			return CreateEmployeeResult{}, problem.Conflict("An employee with this national ID already exists.")
		}
	}

	workEmail := trimmed(input.Contact.WorkEmail)
	emailTaken, err := u.employees.WorkEmailExists(ctx, organizationID, workEmail)
	if err != nil {
		return CreateEmployeeResult{}, problem.Internal(err)
	}
	if emailTaken {
		return CreateEmployeeResult{}, problem.Conflict("An employee with this work email already exists.")
	}

	employeeID := ids.New()
	today := u.clock.Today(u.timeZone)
	status := domain.StatusActive
	if domain.CompareBusinessDates(input.Employment.StartDate, today) > 0 {
		status = domain.StatusPendingStart
	}

	var employeeNumber *string
	if input.EmployeeNumber != nil {
		candidate := trimmed(*input.EmployeeNumber)
		if !domain.IsEmployeeNumber(candidate) {
			return CreateEmployeeResult{}, problem.Validation("The employee number format is not valid.")
		}
		exists, err := u.employees.EmployeeNumberExists(ctx, organizationID, candidate)
		if err != nil {
			return CreateEmployeeResult{}, problem.Internal(err)
		}
		if exists {
			return CreateEmployeeResult{}, problem.Conflict("This employee number is already in use.")
		}
		employeeNumber = &candidate
	}

	accountID, err := u.resolveAccount(ctx, actor, input.AccountID)
	if err != nil {
		return CreateEmployeeResult{}, err
	}
	managerEmployeeID, err := u.resolveManager(ctx, organizationID, input.ManagerEmployeeID)
	if err != nil {
		return CreateEmployeeResult{}, err
	}

	nationalIDCiphertext, err := u.encryptOptional(input.Personal.NationalID)
	if err != nil {
		return CreateEmployeeResult{}, problem.Internal(err)
	}
	passportCiphertext, err := u.encryptOptional(input.Personal.PassportNumber)
	if err != nil {
		return CreateEmployeeResult{}, problem.Internal(err)
	}

	episodeID := ids.New()
	resolvedNumber := ""
	err = u.pool.InTx(ctx, func(tx db.Tx) error {
		if employeeNumber != nil {
			resolvedNumber = *employeeNumber
		} else {
			generated, err := u.employees.NextEmployeeNumber(ctx, tx, organizationID)
			if err != nil {
				return err
			}
			resolvedNumber = generated
		}

		if err := u.employees.Insert(ctx, tx, NewEmployeeData{
			ID:             employeeID,
			OrganizationID: organizationID,
			EmployeeNumber: resolvedNumber,
			Status:         status,
			WorkEmail:      workEmail,
			Person: PersonRecord{
				GivenNameEn:          trimmed(input.Name.GivenEn),
				FamilyNameEn:         trimmed(input.Name.FamilyEn),
				GivenNameAr:          trimmed(input.Name.GivenAr),
				FamilyNameAr:         trimmed(input.Name.FamilyAr),
				DateOfBirth:          input.Personal.DateOfBirth,
				Gender:               input.Personal.Gender,
				Nationality:          input.Personal.Nationality,
				NationalIDCiphertext: nationalIDCiphertext,
				NationalIDLast4:      lastFour(input.Personal.NationalID),
				NationalIDHash:       nationalIDHash,
				PassportCiphertext:   passportCiphertext,
				PassportLast4:        lastFour(input.Personal.PassportNumber),
			},
			Contact: ContactRecord{
				PersonalEmail: input.Contact.PersonalEmail,
				Phone:         input.Contact.Phone,
				City:          input.Contact.City,
			},
		}, u.clock.Now()); err != nil {
			return err
		}

		if err := u.employment.InsertEpisode(ctx, tx, EpisodeRecord{
			ID:               episodeID,
			EpisodeNo:        1,
			EmploymentType:   input.Employment.EmploymentType,
			StartDate:        input.Employment.StartDate,
			EndDate:          nil,
			ProbationEndDate: input.Employment.ProbationEndDate,
		}, organizationID, employeeID, u.clock.Now()); err != nil {
			return err
		}

		if contract := input.Employment.Contract; contract != nil {
			if err := u.employment.AddContract(ctx, tx, ContractRecord{
				ID:                ids.New(),
				EpisodeID:         episodeID,
				ContractType:      contract.ContractType,
				StartDate:         contract.StartDate,
				EndDate:           contract.EndDate,
				SignedOn:          contract.SignedOn,
				ArchiveDocumentID: contract.ArchiveDocumentID,
			}, organizationID, u.clock.Now()); err != nil {
				return err
			}
		}

		assignmentReason := "Initial assignment"
		if err := u.assignments.AddAssignment(ctx, tx, AssignmentRecord{
			ID:              ids.New(),
			BranchID:        input.Assignment.BranchID,
			WorkLocationID:  input.Assignment.WorkLocationID,
			OrgUnitID:       input.Assignment.OrgUnitID,
			JobTitleID:      input.Assignment.JobTitleID,
			JobGradeID:      input.Assignment.JobGradeID,
			WorkArrangement: input.Assignment.WorkArrangement,
			WorkScheduleID:  input.Assignment.WorkScheduleID,
			CostCenterRef:   input.Assignment.CostCenterRef,
			ValidFrom:       input.Employment.StartDate,
			ValidTo:         nil,
			Reason:          assignmentReason,
		}, organizationID, employeeID, u.clock.Now(), &actor.AccountID); err != nil {
			return err
		}

		managerReason := "No direct manager"
		if managerEmployeeID != nil {
			managerReason = "Initial manager"
		}
		if err := u.assignments.AddManager(ctx, tx, ManagerRecord{
			ID:                ids.New(),
			ManagerEmployeeID: managerEmployeeID,
			ValidFrom:         input.Employment.StartDate,
			ValidTo:           nil,
			Reason:            managerReason,
		}, organizationID, employeeID, u.clock.Now(), &actor.AccountID); err != nil {
			return err
		}

		if err := u.employment.AddTransition(ctx, tx, StatusTransition{
			ID:             ids.New(),
			OrganizationID: organizationID,
			EmployeeID:     employeeID,
			FromStatus:     nil,
			ToStatus:       status,
			EffectiveDate:  input.Employment.StartDate,
			RecordedAt:     u.clock.Now(),
			ActorAccountID: &actor.AccountID,
			Reason:         "Employee created",
		}); err != nil {
			return err
		}

		if accountID != nil {
			if err := u.employees.LinkAccount(ctx, tx, employeeID, organizationID, *accountID, actor.AccountID, u.clock.Now()); err != nil {
				return err
			}
		}

		return u.recorder.Record(ctx, tx, actor, organizationID, Change{
			Action:      "hr.employee.created",
			EmployeeID:  employeeID,
			EffectiveOn: input.Employment.StartDate,
			SummaryEn:   "Employee " + resolvedNumber + " created",
			SummaryAr:   "تم إنشاء الموظف " + resolvedNumber,
			After: map[string]any{
				"employeeNumber":    resolvedNumber,
				"status":            string(status),
				"orgUnitId":         input.Assignment.OrgUnitID,
				"jobTitleId":        input.Assignment.JobTitleID,
				"managerEmployeeId": managerEmployeeID,
			},
			EventType:    EventEmployeeCreated,
			EventVersion: 1,
			EventPayload: map[string]any{
				"employeeId":          employeeID,
				"employeeNumber":      resolvedNumber,
				"employmentEpisodeId": episodeID,
				"effectiveFrom":       input.Employment.StartDate,
			},
		})
	})
	if err != nil {
		return CreateEmployeeResult{}, translateWriteError(err)
	}

	return CreateEmployeeResult{
		EmployeeID:     employeeID,
		EmployeeNumber: resolvedNumber,
		Status:         string(status),
	}, nil
}

func (u *CreateEmployee) resolveAccount(ctx context.Context, actor auth.Actor, requested *string) (*string, error) {
	if requested == nil {
		return nil, nil
	}
	// Linking at creation follows the same rule as the link endpoint: the caller must also be able
	// to administer login accounts.
	if !actor.Can(permissions.PlatformAccountManage) {
		return nil, problem.Forbidden("You do not have permission to perform this action.")
	}
	account, err := u.accounts.FindByID(ctx, *requested)
	if err != nil {
		return nil, problem.Internal(err)
	}
	if account == nil || account.OrganizationID != actor.OrganizationID {
		return nil, problem.NotFound("The login account does not exist.")
	}
	linked, err := u.employees.FindIDByAccount(ctx, actor.OrganizationID, *requested)
	if err != nil {
		return nil, problem.Internal(err)
	}
	if linked != nil {
		return nil, problem.Conflict("This login account is already linked to an employee.")
	}
	return requested, nil
}

func (u *CreateEmployee) resolveManager(ctx context.Context, organizationID string, requested *string) (*string, error) {
	if requested == nil {
		return nil, nil
	}
	manager, err := u.employees.FindByID(ctx, *requested)
	if err != nil {
		return nil, problem.Internal(err)
	}
	if manager == nil || manager.Core.OrganizationID != organizationID {
		return nil, problem.NotFound("The selected manager does not exist.")
	}
	if manager.Core.Status == domain.StatusTerminated || manager.Core.Status == domain.StatusRetired {
		return nil, problem.Validation("The selected manager is no longer employed.")
	}
	return requested, nil
}

func (u *CreateEmployee) validateReferences(ctx context.Context, organizationID string, input CreateEmployeeInput) error {
	assignment := input.Assignment
	branchExists, err := u.directory.BranchExists(ctx, organizationID, assignment.BranchID)
	if err != nil {
		return problem.Internal(err)
	}
	if !branchExists {
		return problem.NotFound("The branch does not exist.")
	}
	locationBelongs, err := u.directory.WorkLocationBelongsTo(ctx, organizationID, assignment.WorkLocationID, assignment.BranchID)
	if err != nil {
		return problem.Internal(err)
	}
	if !locationBelongs {
		return problem.Validation("The work location does not belong to the selected branch.")
	}
	jobTitleExists, err := u.directory.JobTitleExists(ctx, organizationID, assignment.JobTitleID)
	if err != nil {
		return problem.Internal(err)
	}
	if !jobTitleExists {
		return problem.NotFound("The job title does not exist.")
	}
	if assignment.JobGradeID != nil {
		exists, err := u.directory.JobGradeExists(ctx, organizationID, *assignment.JobGradeID)
		if err != nil {
			return problem.Internal(err)
		}
		if !exists {
			return problem.NotFound("The job grade does not exist.")
		}
	}
	if assignment.WorkScheduleID != nil {
		exists, err := u.directory.WorkScheduleExists(ctx, organizationID, *assignment.WorkScheduleID)
		if err != nil {
			return problem.Internal(err)
		}
		if !exists {
			return problem.NotFound("The work schedule does not exist.")
		}
	}
	return nil
}

func (u *CreateEmployee) encryptOptional(value *string) (*string, error) {
	if value == nil {
		return nil, nil
	}
	encrypted, err := u.cipher.Encrypt(*value)
	if err != nil {
		return nil, err
	}
	return &encrypted, nil
}

func validateCreateEmployee(input CreateEmployeeInput) error {
	v := &validator{}

	if input.EmployeeNumber != nil {
		value := trimmed(*input.EmployeeNumber)
		if len(value) == 0 || len(value) > 24 {
			v.add("employeeNumber", "length", "Must be between 1 and 24 characters.")
		} else if !domain.IsEmployeeNumber(value) {
			v.add("employeeNumber", "format", "May contain capital letters, digits and dashes only.")
		}
	}

	v.text("name.givenEn", input.Name.GivenEn, 1, 100)
	v.text("name.familyEn", input.Name.FamilyEn, 1, 100)
	v.text("name.givenAr", input.Name.GivenAr, 1, 100)
	v.text("name.familyAr", input.Name.FamilyAr, 1, 100)

	v.optionalBusinessDate("personal.dateOfBirth", input.Personal.DateOfBirth)
	v.oneOf("personal.gender", input.Personal.Gender, genderValues)
	if input.Personal.Nationality != nil {
		length := len(*input.Personal.Nationality)
		if length < 2 || length > 3 {
			v.add("personal.nationality", "length", "Must be between 2 and 3 characters.")
		}
	}
	v.idNumber("personal.nationalId", input.Personal.NationalID)
	v.idNumber("personal.passportNumber", input.Personal.PassportNumber)

	v.email("contact.workEmail", input.Contact.WorkEmail, true)
	v.optionalEmail("contact.personalEmail", input.Contact.PersonalEmail)
	if input.Contact.Phone != nil {
		length := len(*input.Contact.Phone)
		if length < 4 || length > 32 {
			v.add("contact.phone", "length", "Must be between 4 and 32 characters.")
		}
	}
	v.optionalText("contact.city", input.Contact.City, 100)

	v.oneOf("employment.employmentType", input.Employment.EmploymentType, employmentTypeValues)
	v.businessDate("employment.startDate", input.Employment.StartDate, true)
	v.optionalBusinessDate("employment.probationEndDate", input.Employment.ProbationEndDate)

	if contract := input.Employment.Contract; contract != nil {
		v.oneOf("employment.contract.contractType", contract.ContractType, contractTypeValues)
		v.businessDate("employment.contract.startDate", contract.StartDate, true)
		v.optionalBusinessDate("employment.contract.endDate", contract.EndDate)
		v.optionalBusinessDate("employment.contract.signedOn", contract.SignedOn)
		if contract.ArchiveDocumentID != nil {
			length := len(*contract.ArchiveDocumentID)
			if length < 1 || length > 128 {
				v.add("employment.contract.archiveDocumentId", "length", "Must be between 1 and 128 characters.")
			}
		}
	}

	v.identifier("assignment.branchId", input.Assignment.BranchID, true)
	v.identifier("assignment.workLocationId", input.Assignment.WorkLocationID, true)
	v.identifier("assignment.orgUnitId", input.Assignment.OrgUnitID, true)
	v.identifier("assignment.jobTitleId", input.Assignment.JobTitleID, true)
	v.optionalIdentifier("assignment.jobGradeId", input.Assignment.JobGradeID)
	v.oneOf("assignment.workArrangement", input.Assignment.WorkArrangement, workArrangementValues)
	v.optionalIdentifier("assignment.workScheduleId", input.Assignment.WorkScheduleID)
	v.optionalText("assignment.costCenterRef", input.Assignment.CostCenterRef, 64)

	v.optionalIdentifier("managerEmployeeId", input.ManagerEmployeeID)
	v.optionalIdentifier("accountId", input.AccountID)

	return v.err()
}

func lastFour(value *string) *string {
	if value == nil {
		return nil
	}
	if len(*value) <= 4 {
		tail := *value
		return &tail
	}
	tail := (*value)[len(*value)-4:]
	return &tail
}
