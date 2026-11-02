package application

// Wire shapes. Field names match the TypeScript client and the OpenAPI document exactly; the
// contract test compares them, so a rename here is a visible API break.

// LocalizedText is a label in both supported languages.
type LocalizedText struct {
	En string `json:"en"`
	Ar string `json:"ar"`
}

// EmployeeSummary is the short form used in lists and profile headers.
type EmployeeSummary struct {
	ID                 string        `json:"id"`
	EmployeeNumber     string        `json:"employeeNumber"`
	DisplayName        LocalizedText `json:"displayName"`
	Status             string        `json:"status"`
	WorkEmail          string        `json:"workEmail"`
	BranchName         *LocalizedText `json:"branchName"`
	OrgUnitName        *LocalizedText `json:"orgUnitName"`
	JobTitleName       *LocalizedText `json:"jobTitleName"`
	WorkLocationName   *LocalizedText `json:"workLocationName"`
	ManagerDisplayName *LocalizedText `json:"managerDisplayName"`
}

// OrgAssignmentView is one assignment with its reference labels resolved.
type OrgAssignmentView struct {
	ID               string        `json:"id"`
	OrgUnitID        string        `json:"orgUnitId"`
	OrgUnitName      LocalizedText `json:"orgUnitName"`
	OrgUnitPath      string        `json:"orgUnitPath"`
	BranchID         string        `json:"branchId"`
	BranchName       LocalizedText `json:"branchName"`
	WorkLocationID   string        `json:"workLocationId"`
	WorkLocationName LocalizedText `json:"workLocationName"`
	JobTitleID       string        `json:"jobTitleId"`
	JobTitleName     LocalizedText `json:"jobTitleName"`
	JobGradeID       *string       `json:"jobGradeId"`
	JobGradeName     *LocalizedText `json:"jobGradeName"`
	WorkArrangement  string        `json:"workArrangement"`
	WorkScheduleID   *string       `json:"workScheduleId"`
	CostCenterRef    *string       `json:"costCenterRef"`
	ValidFrom        string        `json:"validFrom"`
	ValidTo          *string       `json:"validTo"`
}

// ManagerView is one reporting relationship with the manager's name resolved.
type ManagerView struct {
	ID             string        `json:"id"`
	EmployeeID     string        `json:"employeeId"`
	EmployeeNumber string        `json:"employeeNumber"`
	DisplayName    LocalizedText `json:"displayName"`
	ValidFrom      string        `json:"validFrom"`
	ValidTo        *string       `json:"validTo"`
}

// EmploymentEpisodeView is one employment episode.
type EmploymentEpisodeView struct {
	ID               string  `json:"id"`
	EpisodeNo        int     `json:"episodeNo"`
	EmploymentType   string  `json:"employmentType"`
	StartDate        string  `json:"startDate"`
	EndDate          *string `json:"endDate"`
	ProbationEndDate *string `json:"probationEndDate"`
	EndReason        *string `json:"endReason"`
}

// ContractView is one employment contract.
type ContractView struct {
	ID                string  `json:"id"`
	EpisodeID         string  `json:"episodeId"`
	ContractType      string  `json:"contractType"`
	StartDate         string  `json:"startDate"`
	EndDate           *string `json:"endDate"`
	SignedOn          *string `json:"signedOn"`
	ArchiveDocumentID *string `json:"archiveDocumentId"`
}

// TimelineEntry is one entry of the employee timeline.
type TimelineEntry struct {
	ID         string        `json:"id"`
	OccurredOn string        `json:"occurredOn"`
	RecordedAt string        `json:"recordedAt"`
	EventType  string        `json:"eventType"`
	ActorName  *string       `json:"actorName"`
	Reason     *string       `json:"reason"`
	Summary    LocalizedText `json:"summary"`
}

// DocumentReferenceView is a reference to a document owned by H-Archive.
type DocumentReferenceView struct {
	ID                string  `json:"id"`
	ArchiveDocumentID string  `json:"archiveDocumentId"`
	DocumentType      string  `json:"documentType"`
	Classification    string  `json:"classification"`
	IssuedOn          *string `json:"issuedOn"`
	ExpiresOn         *string `json:"expiresOn"`
}

// IdentityView is the sensitive identity section, returned only to callers allowed to see it.
// Identifiers are masked: the full value never leaves the encrypted column.
type IdentityView struct {
	DateOfBirth      *string `json:"dateOfBirth"`
	Gender           string  `json:"gender"`
	Nationality      *string `json:"nationality"`
	NationalIDMasked *string `json:"nationalIdMasked"`
	PassportMasked   *string `json:"passportMasked"`
}

// ContactView is the contact section.
type ContactView struct {
	PersonalEmail *string `json:"personalEmail"`
	Phone         *string `json:"phone"`
	City          *string `json:"city"`
}

// EmploymentView groups the employment history.
type EmploymentView struct {
	CurrentEpisode *EmploymentEpisodeView  `json:"currentEpisode"`
	Episodes       []EmploymentEpisodeView `json:"episodes"`
	Contracts      []ContractView          `json:"contracts"`
}

// OrganizationView groups the organizational history.
type OrganizationView struct {
	CurrentAssignment *OrgAssignmentView  `json:"currentAssignment"`
	Assignments       []OrgAssignmentView `json:"assignments"`
	CurrentManager    *ManagerView        `json:"currentManager"`
	ManagerHistory    []ManagerView       `json:"managerHistory"`
}

// AccountLinkView is the linked login account.
type AccountLinkView struct {
	AccountID string `json:"accountId"`
	LinkedAt  string `json:"linkedAt"`
}

// EmployeeProfile is the permission-controlled profile read.
type EmployeeProfile struct {
	Summary         EmployeeSummary         `json:"summary"`
	VisibleSections []string                `json:"visibleSections"`
	Identity        *IdentityView           `json:"identity"`
	Contact         *ContactView            `json:"contact"`
	Employment      EmploymentView          `json:"employment"`
	Organization    OrganizationView        `json:"organization"`
	Documents       []DocumentReferenceView `json:"documents"`
	Timeline        []TimelineEntry         `json:"timeline"`
	Account         *AccountLinkView        `json:"account"`
}

// EmployeeSearchItem is one row of the employee list.
type EmployeeSearchItem struct {
	ID             string        `json:"id"`
	EmployeeNumber string        `json:"employeeNumber"`
	DisplayName    LocalizedText `json:"displayName"`
	Status         string        `json:"status"`
	WorkEmail      string        `json:"workEmail"`
}

// EmployeeSearchResult is one bounded page of the employee list.
type EmployeeSearchResult struct {
	Items      []EmployeeSearchItem `json:"items"`
	NextCursor *string              `json:"nextCursor"`
}

// CreateEmployeeResult is the identity of a newly created employee.
type CreateEmployeeResult struct {
	EmployeeID     string `json:"employeeId"`
	EmployeeNumber string `json:"employeeNumber"`
	Status         string `json:"status"`
}

// Branch is a branch of the organization.
type Branch struct {
	ID         string        `json:"id"`
	Code       string        `json:"code"`
	Name       LocalizedText `json:"name"`
	TimeZone   string        `json:"timeZone"`
	ArchivedAt *string       `json:"archivedAt"`
}

// WorkLocation is a physical work location.
type WorkLocation struct {
	ID          string        `json:"id"`
	BranchID    string        `json:"branchId"`
	Code        string        `json:"code"`
	Name        LocalizedText `json:"name"`
	AddressLine *string       `json:"addressLine"`
	TimeZone    string        `json:"timeZone"`
	ArchivedAt  *string       `json:"archivedAt"`
}

// OrgUnit is one node of the organization tree.
type OrgUnit struct {
	ID         string        `json:"id"`
	BranchID   string        `json:"branchId"`
	ParentID   *string       `json:"parentId"`
	Kind       string        `json:"kind"`
	Code       string        `json:"code"`
	Name       LocalizedText `json:"name"`
	Path       string        `json:"path"`
	ArchivedAt *string       `json:"archivedAt"`
}

// JobTitle is a job title.
type JobTitle struct {
	ID         string        `json:"id"`
	Code       string        `json:"code"`
	Name       LocalizedText `json:"name"`
	ArchivedAt *string       `json:"archivedAt"`
}

// JobGrade is a job grade.
type JobGrade struct {
	ID         string        `json:"id"`
	Code       string        `json:"code"`
	Name       LocalizedText `json:"name"`
	Rank       int           `json:"rank"`
	ArchivedAt *string       `json:"archivedAt"`
}

// WorkSchedule is a weekly work pattern.
type WorkSchedule struct {
	ID         string            `json:"id"`
	Code       string            `json:"code"`
	Name       LocalizedText     `json:"name"`
	TimeZone   string            `json:"timeZone"`
	Days       []WorkScheduleDay `json:"days"`
	ArchivedAt *string           `json:"archivedAt"`
}

// OrganizationOverview is the whole reference-data set.
type OrganizationOverview struct {
	Branches      []Branch       `json:"branches"`
	Locations     []WorkLocation `json:"locations"`
	OrgUnits      []OrgUnit      `json:"orgUnits"`
	JobTitles     []JobTitle     `json:"jobTitles"`
	JobGrades     []JobGrade     `json:"jobGrades"`
	WorkSchedules []WorkSchedule `json:"workSchedules"`
}
