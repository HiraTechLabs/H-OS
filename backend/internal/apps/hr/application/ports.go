package application

import (
	"context"
	"time"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/domain"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/accounts"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
)

// Repository ports. Use cases depend on these interfaces, never on the PostgreSQL adapters, so a
// use case is testable without a database and the adapter can change without touching business
// rules (ARCH-005). Every write takes the caller's executor so it joins the caller's transaction.

// EmployeeRepository persists employee records.
type EmployeeRepository interface {
	NextEmployeeNumber(ctx context.Context, q db.Querier, organizationID string) (string, error)
	Insert(ctx context.Context, q db.Querier, data NewEmployeeData, now time.Time) error
	FindByID(ctx context.Context, employeeID string) (*EmployeeAggregate, error)
	FindIDByAccount(ctx context.Context, organizationID, accountID string) (*string, error)
	NationalIDHashExists(ctx context.Context, organizationID, hash string) (bool, error)
	WorkEmailExists(ctx context.Context, organizationID, email string) (bool, error)
	EmployeeNumberExists(ctx context.Context, organizationID, employeeNumber string) (bool, error)
	Search(ctx context.Context, organizationID string, filter SearchFilter, scope DataScope, limit int, cursor *Cursor) (SearchPage, error)
	UpdateCore(ctx context.Context, q db.Querier, employeeID string, workEmail string, status domain.EmploymentStatus, now time.Time) error
	UpdatePerson(ctx context.Context, q db.Querier, employeeID string, person PersonRecord, now time.Time) error
	UpdateContact(ctx context.Context, q db.Querier, employeeID string, contact ContactRecord, now time.Time) error
	AddEmergencyContact(ctx context.Context, q db.Querier, employeeID, organizationID string, input EmergencyContactInput) error
	LinkAccount(ctx context.Context, q db.Querier, employeeID, organizationID, accountID, actorAccountID string, at time.Time) error
	UnlinkAccount(ctx context.Context, q db.Querier, employeeID string, at time.Time) error
	AddDocument(ctx context.Context, q db.Querier, employeeID, organizationID string, input DocumentInput) error
}

// EmploymentRepository persists employment episodes, contracts and status transitions.
type EmploymentRepository interface {
	InsertEpisode(ctx context.Context, q db.Querier, episode EpisodeRecord, organizationID, employeeID string, now time.Time) error
	AddContract(ctx context.Context, q db.Querier, contract ContractRecord, organizationID string, now time.Time) error
	CloseEpisode(ctx context.Context, q db.Querier, episodeID, endDate, endReason string) error
	AddTransition(ctx context.Context, q db.Querier, transition StatusTransition) error
}

// StatusTransition is one recorded lifecycle transition.
type StatusTransition struct {
	ID             string
	OrganizationID string
	EmployeeID     string
	FromStatus     *domain.EmploymentStatus
	ToStatus       domain.EmploymentStatus
	EffectiveDate  string
	RecordedAt     time.Time
	ActorAccountID *string
	Reason         string
	EndReason      *string
}

// AssignmentRepository persists effective-dated organizational and reporting rows.
type AssignmentRepository interface {
	AddAssignment(ctx context.Context, q db.Querier, assignment AssignmentRecord, organizationID, employeeID string, recordedAt time.Time, actorAccountID *string) error
	CloseAssignment(ctx context.Context, q db.Querier, assignmentID, validTo string) error
	AddManager(ctx context.Context, q db.Querier, manager ManagerRecord, organizationID, employeeID string, recordedAt time.Time, actorAccountID *string) error
	CloseManager(ctx context.Context, q db.Querier, managerRowID, validTo string) error
}

// TimelineRepository persists the employee timeline.
type TimelineRepository interface {
	Add(ctx context.Context, q db.Querier, entry TimelineEntryInput) error
	List(ctx context.Context, employeeID string, limit int) ([]TimelineRecord, error)
}

// TimelineEntryInput is one timeline entry to write.
type TimelineEntryInput struct {
	ID             string
	OrganizationID string
	EmployeeID     string
	EventType      string
	OccurredOn     string
	RecordedAt     time.Time
	SummaryEn      string
	SummaryAr      string
	ActorAccountID *string
	Reason         *string
	RelatedType    *string
	RelatedID      *string
}

// OrganizationRepository reads and writes organization reference data.
type OrganizationRepository interface {
	Overview(ctx context.Context, organizationID string) (OrganizationOverviewData, error)
	CreateBranch(ctx context.Context, q db.Querier, row BranchRow, now time.Time) error
	CreateWorkLocation(ctx context.Context, q db.Querier, row WorkLocationRow, now time.Time) error
	CreateOrgUnit(ctx context.Context, q db.Querier, row OrgUnitRow, now time.Time) error
	AddOrgUnitHistory(ctx context.Context, q db.Querier, row OrgUnitHistoryRow) error
	CreateJobTitle(ctx context.Context, q db.Querier, row JobTitleRow, now time.Time) error
	CreateJobGrade(ctx context.Context, q db.Querier, row JobGradeRow, now time.Time) error
	CreateWorkSchedule(ctx context.Context, q db.Querier, row WorkScheduleRow, now time.Time) error
	BranchCodeExists(ctx context.Context, organizationID, code string) (bool, error)
	LocationCodeExists(ctx context.Context, organizationID, code string) (bool, error)
	OrgUnitCodeExists(ctx context.Context, organizationID, code string) (bool, error)
	JobTitleCodeExists(ctx context.Context, organizationID, code string) (bool, error)
	JobGradeCodeExists(ctx context.Context, organizationID, code string) (bool, error)
	WorkScheduleCodeExists(ctx context.Context, organizationID, code string) (bool, error)
}

// OrgUnitHeader is the minimal unit shape needed to authorize before loading anything sensitive.
type OrgUnitHeader struct {
	ID       string
	Path     string
	BranchID string
}

// DirectoryRepository answers cheap existence and scope questions.
type DirectoryRepository interface {
	BranchExists(ctx context.Context, organizationID, branchID string) (bool, error)
	WorkLocationBelongsTo(ctx context.Context, organizationID, locationID, branchID string) (bool, error)
	LocationBranch(ctx context.Context, organizationID, locationID string) (*string, error)
	OrgUnitHeader(ctx context.Context, organizationID, unitID string) (*OrgUnitHeader, error)
	JobTitleExists(ctx context.Context, organizationID, jobTitleID string) (bool, error)
	JobGradeExists(ctx context.Context, organizationID, jobGradeID string) (bool, error)
	WorkScheduleExists(ctx context.Context, organizationID, scheduleID string) (bool, error)
	CurrentOrgUnitPath(ctx context.Context, employeeID string) (*string, error)
	CurrentManagerID(ctx context.Context, employeeID string) (*string, error)
}

// Transactor runs one unit of work. The PostgreSQL pool is the production implementation; the
// narrow interface keeps a use case testable without a live database.
type Transactor interface {
	InTx(ctx context.Context, fn func(tx db.Tx) error) error
}

// AccountDirectory resolves login accounts for H-HR. H-HR never reads `platform` tables, so the
// kernel owns this boundary (ARCH-003).
type AccountDirectory interface {
	FindByID(ctx context.Context, accountID string) (*accounts.Summary, error)
}

// SessionRevoker ends every live session of an account inside the caller's transaction. A change
// that alters what a person may reach must take effect on the next request (SEC-014).
type SessionRevoker interface {
	RevokeAllForAccountWithin(ctx context.Context, q db.Querier, accountID string) error
}

// FieldProtector encrypts protected identifiers and derives their lookup digest, so a duplicate can
// be detected without decrypting anything (SEC-008).
type FieldProtector interface {
	Encrypt(plain string) (string, error)
	LookupHash(plain string) string
}
