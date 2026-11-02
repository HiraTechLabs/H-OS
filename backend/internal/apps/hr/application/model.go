package application

import (
	"time"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/domain"
)

// Persistence-facing shapes. The domain decides rules; these carry facts and nothing else.

// EmployeeCore is the identity row of an employee.
type EmployeeCore struct {
	ID             string
	OrganizationID string
	EmployeeNumber string
	Status         domain.EmploymentStatus
	WorkEmail      string
	ArchivedAt     *time.Time
}

// PersonRecord is the personal section. Identity numbers are stored encrypted, with a tail kept
// only for masked display and a lookup hash for duplicate detection.
type PersonRecord struct {
	GivenNameEn          string
	FamilyNameEn         string
	GivenNameAr          string
	FamilyNameAr         string
	DateOfBirth          *string
	Gender               string
	Nationality          *string
	NationalIDCiphertext *string
	NationalIDLast4      *string
	NationalIDHash       *string
	PassportCiphertext   *string
	PassportLast4        *string
}

// ContactRecord is the contact section.
type ContactRecord struct {
	PersonalEmail *string
	Phone         *string
	City          *string
}

// EmergencyContactRecord is one emergency contact.
type EmergencyContactRecord struct {
	ID           string
	Name         string
	Relationship string
	Phone        string
	Priority     int
	VerifiedAt   *string
}

// EpisodeRecord is one employment episode.
type EpisodeRecord struct {
	ID               string
	EpisodeNo        int
	EmploymentType   string
	StartDate        string
	EndDate          *string
	ProbationEndDate *string
	EndReason        *string
}

// ContractRecord is one employment contract.
type ContractRecord struct {
	ID                string
	EpisodeID         string
	ContractType      string
	StartDate         string
	EndDate           *string
	SignedOn          *string
	ArchiveDocumentID *string
}

// AssignmentRecord is one effective-dated organizational assignment.
type AssignmentRecord struct {
	ID              string
	BranchID        string
	WorkLocationID  string
	OrgUnitID       string
	JobTitleID      string
	JobGradeID      *string
	WorkArrangement string
	WorkScheduleID  *string
	CostCenterRef   *string
	ValidFrom       string
	ValidTo         *string
	Reason          string
}

// ManagerRecord is one effective-dated reporting relationship. A nil manager is the explicit
// representation of "no direct manager".
type ManagerRecord struct {
	ID                string
	ManagerEmployeeID *string
	ValidFrom         string
	ValidTo           *string
	Reason            string
}

// DocumentRecord is a reference to a document owned by H-Archive.
type DocumentRecord struct {
	ID                string
	ArchiveDocumentID string
	DocumentType      string
	Classification    string
	IssuedOn          *string
	ExpiresOn         *string
}

// AccountLinkRecord is the active login-account link, when one exists.
type AccountLinkRecord struct {
	AccountID string
	LinkedAt  time.Time
}

// EmergencyContactInput is a new emergency contact.
type EmergencyContactInput struct {
	ID           string
	Name         string
	Relationship string
	Phone        string
	Priority     int
}

// DocumentInput is a new document reference.
type DocumentInput struct {
	ID                string
	ArchiveDocumentID string
	DocumentType      string
	Classification    string
	IssuedOn          *string
	ExpiresOn         *string
}

// EmployeeAggregate is the employee as one consistent unit.
type EmployeeAggregate struct {
	Core              EmployeeCore
	Person            PersonRecord
	Contact           ContactRecord
	EmergencyContacts []EmergencyContactRecord
	Episodes          []EpisodeRecord
	Contracts         []ContractRecord
	Assignments       []AssignmentRecord
	Managers          []ManagerRecord
	Documents         []DocumentRecord
	AccountLink       *AccountLinkRecord
}

// CurrentAssignment returns the assignment in force, if any.
func (a EmployeeAggregate) CurrentAssignment() *AssignmentRecord {
	for index := range a.Assignments {
		if a.Assignments[index].ValidTo == nil {
			return &a.Assignments[index]
		}
	}
	return nil
}

// CurrentEpisode returns the open employment episode, if any.
func (a EmployeeAggregate) CurrentEpisode() *EpisodeRecord {
	for index := range a.Episodes {
		if a.Episodes[index].EndDate == nil {
			return &a.Episodes[index]
		}
	}
	return nil
}

// CurrentManager returns the reporting row in force, if any.
func (a EmployeeAggregate) CurrentManager() *ManagerRecord {
	for index := range a.Managers {
		if a.Managers[index].ValidTo == nil {
			return &a.Managers[index]
		}
	}
	return nil
}

// NewEmployeeData is everything inserted when an employee is created.
type NewEmployeeData struct {
	ID             string
	OrganizationID string
	EmployeeNumber string
	Status         domain.EmploymentStatus
	WorkEmail      string
	Person         PersonRecord
	Contact        ContactRecord
}

// SearchFilter narrows an employee search.
type SearchFilter struct {
	Query             string
	Statuses          []domain.EmploymentStatus
	BranchID          string
	OrgUnitID         string
	JobTitleID        string
	WorkLocationID    string
	ManagerEmployeeID string
}

// DataScope is the resolved row-level access of the caller.
type DataScope struct {
	Level            string // own | unit | subtree | all
	ActorEmployeeID  *string
	ActorOrgUnitPath *string
}

// EmployeeSearchRow is one list result.
type EmployeeSearchRow struct {
	ID              string
	EmployeeNumber  string
	DisplayNameEn   string
	DisplayNameAr   string
	Status          domain.EmploymentStatus
	WorkEmail       string
	BranchNameEn    *string
	BranchNameAr    *string
	UnitNameEn      *string
	UnitNameAr      *string
	JobTitleNameEn  *string
	JobTitleNameAr  *string
	LocationNameEn  *string
	LocationNameAr  *string
	ManagerNameEn   *string
	ManagerNameAr   *string
}

// Cursor is a keyset position: the last sort key plus the tie-breaking identifier.
type Cursor struct {
	Key string
	ID  string
}

// SearchPage is one bounded page of employees.
type SearchPage struct {
	Rows       []EmployeeSearchRow
	NextCursor *Cursor
}

// TimelineRecord is one employee timeline entry.
type TimelineRecord struct {
	ID             string
	EventType      string
	OccurredOn     string
	RecordedAt     time.Time
	SummaryEn      string
	SummaryAr      string
	Reason         *string
	ActorAccountID *string
}

// BranchRow is a branch of the organization.
type BranchRow struct {
	ID             string
	OrganizationID string
	Code           string
	NameEn         string
	NameAr         string
	TimeZone       string
	ArchivedAt     *time.Time
}

// WorkLocationRow is a physical work location.
type WorkLocationRow struct {
	ID             string
	OrganizationID string
	BranchID       string
	Code           string
	NameEn         string
	NameAr         string
	AddressLine    *string
	TimeZone       string
	ArchivedAt     *time.Time
}

// OrgUnitRow is one node of the organization tree.
type OrgUnitRow struct {
	ID             string
	OrganizationID string
	BranchID       string
	ParentID       *string
	Kind           string
	Code           string
	NameEn         string
	NameAr         string
	Path           string
	ArchivedAt     *time.Time
}

// JobTitleRow is a job title.
type JobTitleRow struct {
	ID             string
	OrganizationID string
	Code           string
	NameEn         string
	NameAr         string
	ArchivedAt     *time.Time
}

// JobGradeRow is a job grade.
type JobGradeRow struct {
	ID             string
	OrganizationID string
	Code           string
	NameEn         string
	NameAr         string
	Rank           int
	ArchivedAt     *time.Time
}

// WorkScheduleDay is one weekday of a weekly work pattern.
type WorkScheduleDay struct {
	Weekday        int     `json:"weekday"`
	IsRestDay      bool    `json:"isRestDay"`
	StartLocal     *string `json:"startLocal"`
	EndLocal       *string `json:"endLocal"`
	BreakMinutes   int     `json:"breakMinutes"`
	CrossesMidnight bool   `json:"crossesMidnight"`
}

// WorkScheduleRow is a weekly work pattern.
type WorkScheduleRow struct {
	ID             string
	OrganizationID string
	Code           string
	NameEn         string
	NameAr         string
	TimeZone       string
	Days           []WorkScheduleDay
	ArchivedAt     *time.Time
}

// OrganizationOverviewData is the whole reference-data set used by forms and profiles.
type OrganizationOverviewData struct {
	Branches       []BranchRow
	Locations      []WorkLocationRow
	OrgUnits       []OrgUnitRow
	JobTitles      []JobTitleRow
	JobGrades      []JobGradeRow
	WorkSchedules  []WorkScheduleRow
}

// OrgUnitHistoryRow is the first historical snapshot of an organization unit.
type OrgUnitHistoryRow struct {
	ID             string
	OrganizationID string
	OrgUnitID      string
	ParentID       *string
	NameEn         string
	NameAr         string
	EffectiveFrom  string
	RecordedAt     time.Time
	ActorAccountID *string
	Reason         *string
}
