package application

import (
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/domain"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

// Request shapes. They mirror the TypeScript contracts field for field; the transport decodes
// straight into them, and the validation below reproduces the same limits. A shape change here is
// an API change and is caught by the contract test.

// PersonNameInput is the bilingual legal name.
type PersonNameInput struct {
	GivenEn  string `json:"givenEn"`
	FamilyEn string `json:"familyEn"`
	GivenAr  string `json:"givenAr"`
	FamilyAr string `json:"familyAr"`
}

// PersonalInput is the protected personal section supplied at creation.
type PersonalInput struct {
	DateOfBirth    *string `json:"dateOfBirth"`
	Gender         string  `json:"gender"`
	Nationality    *string `json:"nationality"`
	NationalID     *string `json:"nationalId"`
	PassportNumber *string `json:"passportNumber"`
}

// ContactInput is the contact section supplied at creation.
type ContactInput struct {
	WorkEmail     string  `json:"workEmail"`
	PersonalEmail *string `json:"personalEmail"`
	Phone         *string `json:"phone"`
	City          *string `json:"city"`
}

// ContractInput is the optional first contract.
type ContractInput struct {
	ContractType      string  `json:"contractType"`
	StartDate         string  `json:"startDate"`
	EndDate           *string `json:"endDate"`
	SignedOn          *string `json:"signedOn"`
	ArchiveDocumentID *string `json:"archiveDocumentId"`
}

// EmploymentInput is the first employment episode.
type EmploymentInput struct {
	EmploymentType   string         `json:"employmentType"`
	StartDate        string         `json:"startDate"`
	ProbationEndDate *string        `json:"probationEndDate"`
	Contract         *ContractInput `json:"contract"`
}

// AssignmentInput is the first organizational assignment. The branch is derived from the selected
// work location on changes, but is explicit at creation because the contract asks for it.
type AssignmentInput struct {
	BranchID        string  `json:"branchId"`
	WorkLocationID  string  `json:"workLocationId"`
	OrgUnitID       string  `json:"orgUnitId"`
	JobTitleID      string  `json:"jobTitleId"`
	JobGradeID      *string `json:"jobGradeId"`
	WorkArrangement string  `json:"workArrangement"`
	WorkScheduleID  *string `json:"workScheduleId"`
	CostCenterRef   *string `json:"costCenterRef"`
}

// CreateEmployeeInput is the create-employee command.
type CreateEmployeeInput struct {
	EmployeeNumber    *string         `json:"employeeNumber"`
	Name              PersonNameInput `json:"name"`
	Personal          PersonalInput   `json:"personal"`
	Contact           ContactInput    `json:"contact"`
	Employment        EmploymentInput `json:"employment"`
	Assignment        AssignmentInput `json:"assignment"`
	ManagerEmployeeID *string         `json:"managerEmployeeId"`
	AccountID         *string         `json:"accountId"`
}

// UpdateEmployeeInput is the non-protected patch. Personal identifiers are deliberately absent:
// they change through a reviewed request (HHR-EMP-004).
type UpdateEmployeeInput struct {
	Name        Optional[PersonNameInput] `json:"name"`
	DateOfBirth Optional[string]          `json:"dateOfBirth"`
	Gender      Optional[string]          `json:"gender"`
	Nationality Optional[string]          `json:"nationality"`
	WorkEmail   Optional[string]          `json:"workEmail"`
	City        Optional[string]          `json:"city"`
}

// ChangeStatusInput is one lifecycle transition command.
type ChangeStatusInput struct {
	ToStatus      string  `json:"toStatus"`
	EffectiveDate string  `json:"effectiveDate"`
	Reason        string  `json:"reason"`
	EndReason     *string `json:"endReason"`
}

// ChangeAssignmentInput is one effective-dated reassignment.
type ChangeAssignmentInput struct {
	OrgUnitID       string  `json:"orgUnitId"`
	WorkLocationID  string  `json:"workLocationId"`
	JobTitleID      string  `json:"jobTitleId"`
	JobGradeID      *string `json:"jobGradeId"`
	WorkArrangement string  `json:"workArrangement"`
	WorkScheduleID  *string `json:"workScheduleId"`
	CostCenterRef   *string `json:"costCenterRef"`
	EffectiveFrom   string  `json:"effectiveFrom"`
	Reason          string  `json:"reason"`
}

// ChangeManagerInput is one effective-dated reporting change.
type ChangeManagerInput struct {
	ManagerEmployeeID *string `json:"managerEmployeeId"`
	EffectiveFrom     string  `json:"effectiveFrom"`
	Reason            string  `json:"reason"`
}

// LinkAccountInput links a login account to an employee.
type LinkAccountInput struct {
	AccountID string `json:"accountId"`
}

// CreateEmergencyContactInput is a new emergency contact.
type CreateEmergencyContactInput struct {
	Name         string `json:"name"`
	Relationship string `json:"relationship"`
	Phone        string `json:"phone"`
	Priority     int    `json:"priority"`
}

// DocumentReferenceInput is a new reference to a document owned by H-Archive.
type DocumentReferenceInput struct {
	ArchiveDocumentID string  `json:"archiveDocumentId"`
	DocumentType      string  `json:"documentType"`
	Classification    string  `json:"classification"`
	IssuedOn          *string `json:"issuedOn"`
	ExpiresOn         *string `json:"expiresOn"`
}

// CreateBranchInput creates a branch.
type CreateBranchInput struct {
	Code     string        `json:"code"`
	Name     LocalizedName `json:"name"`
	TimeZone string        `json:"timeZone"`
}

// CreateWorkLocationInput creates a work location.
type CreateWorkLocationInput struct {
	BranchID    string        `json:"branchId"`
	Code        string        `json:"code"`
	Name        LocalizedName `json:"name"`
	AddressLine *string       `json:"addressLine"`
	TimeZone    string        `json:"timeZone"`
}

// CreateOrgUnitInput creates one node of the organization tree.
type CreateOrgUnitInput struct {
	BranchID string        `json:"branchId"`
	ParentID *string       `json:"parentId"`
	Kind     string        `json:"kind"`
	Code     string        `json:"code"`
	Name     LocalizedName `json:"name"`
}

// CreateJobTitleInput creates a job title.
type CreateJobTitleInput struct {
	Code string        `json:"code"`
	Name LocalizedName `json:"name"`
}

// CreateJobGradeInput creates a job grade.
type CreateJobGradeInput struct {
	Code string        `json:"code"`
	Name LocalizedName `json:"name"`
	Rank int           `json:"rank"`
}

// CreateWorkScheduleInput creates a weekly work pattern.
type CreateWorkScheduleInput struct {
	Code     string            `json:"code"`
	Name     LocalizedName     `json:"name"`
	TimeZone string            `json:"timeZone"`
	Days     []WorkScheduleDay `json:"days"`
}

// LocalizedName is the request-side localized label.
type LocalizedName struct {
	En string `json:"en"`
	Ar string `json:"ar"`
}

// Validation sets.

var (
	genderValues          = []string{"male", "female", "undisclosed"}
	employmentTypeValues  = []string{"permanent", "fixed_term", "part_time", "temporary", "internship", "contractor"}
	contractTypeValues    = employmentTypeValues
	workArrangementValues = []string{"office", "remote", "hybrid", "field", "client_site"}
	orgUnitKindValues     = []string{"department", "team"}
	classificationValues  = []string{"public", "internal", "confidential", "restricted"}

	uuidPattern       = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	idNumberPattern   = regexp.MustCompile(`^[A-Za-z0-9-]+$`)
	codePattern       = regexp.MustCompile(`^[A-Z0-9-]+$`)
	localTimePattern  = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)
)

// IsUUID reports whether a value is an RFC 4122 identifier in canonical form.
func IsUUID(value string) bool { return uuidPattern.MatchString(value) }

// validator accumulates field-level failures so the client can mark every bad input at once.
type validator struct {
	details []problem.Detail
}

func (v *validator) add(field, code, message string) {
	v.details = append(v.details, problem.Detail{Field: field, Code: code, Message: message})
}

func (v *validator) text(field, value string, min, max int) {
	length := len([]rune(strings.TrimSpace(value)))
	if length == 0 {
		v.add(field, "required", "This field is required.")
		return
	}
	if length < min || length > max {
		v.add(field, "length", lengthMessage(min, max))
	}
}

func (v *validator) optionalText(field string, value *string, max int) {
	if value == nil {
		return
	}
	length := len([]rune(*value))
	if length > max {
		v.add(field, "length", lengthMessage(0, max))
	}
}

func (v *validator) email(field, value string, required bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		if required {
			v.add(field, "required", "This field is required.")
		}
		return
	}
	if len(value) > 320 {
		v.add(field, "length", "Must be at most 320 characters.")
		return
	}
	if _, err := mail.ParseAddress(value); err != nil || !strings.Contains(value, "@") {
		v.add(field, "format", "Must be a valid email address.")
	}
}

func (v *validator) optionalEmail(field string, value *string) {
	if value == nil {
		return
	}
	v.email(field, *value, false)
}

func (v *validator) oneOf(field, value string, allowed []string) {
	for _, candidate := range allowed {
		if candidate == value {
			return
		}
	}
	v.add(field, "enum", "Must be one of: "+strings.Join(allowed, ", ")+".")
}

func (v *validator) identifier(field, value string, required bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		if required {
			v.add(field, "required", "This field is required.")
		}
		return
	}
	if !IsUUID(value) {
		v.add(field, "format", "Must be an identifier.")
	}
}

func (v *validator) optionalIdentifier(field string, value *string) {
	if value == nil {
		return
	}
	v.identifier(field, *value, false)
}

func (v *validator) businessDate(field, value string, required bool) {
	if value == "" {
		if required {
			v.add(field, "required", "This field is required.")
		}
		return
	}
	if !domain.IsBusinessDate(value) {
		v.add(field, "format", "Must be a calendar date in YYYY-MM-DD form.")
	}
}

func (v *validator) optionalBusinessDate(field string, value *string) {
	if value == nil || *value == "" {
		return
	}
	v.businessDate(field, *value, false)
}

func (v *validator) code(field, value string, min, max int) {
	v.text(field, value, min, max)
	if value != "" && !codePattern.MatchString(value) {
		v.add(field, "format", "May contain capital letters, digits and dashes only.")
	}
}

func (v *validator) idNumber(field string, value *string) {
	if value == nil {
		return
	}
	length := len(*value)
	if length < 4 || length > 32 {
		v.add(field, "length", "Must be between 4 and 32 characters.")
		return
	}
	if !idNumberPattern.MatchString(*value) {
		v.add(field, "format", "May contain letters, digits and dashes only.")
	}
}

func (v *validator) timeZone(field, value string) {
	if strings.TrimSpace(value) == "" {
		v.add(field, "required", "This field is required.")
		return
	}
	if len(value) > 64 {
		v.add(field, "length", "Must be at most 64 characters.")
		return
	}
	if _, err := time.LoadLocation(value); err != nil {
		v.add(field, "format", "Must be a known IANA time zone.")
	}
}

func (v *validator) err() error {
	if len(v.details) == 0 {
		return nil
	}
	return problem.Validation("The request does not satisfy the contract.", v.details...)
}

func (v *validator) ok() bool { return len(v.details) == 0 }

func lengthMessage(min, max int) string {
	if min <= 0 {
		return "Must be at most " + itoa(max) + " characters."
	}
	return "Must be between " + itoa(min) + " and " + itoa(max) + " characters."
}

func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	digits := make([]byte, 0, 4)
	for value > 0 {
		digits = append([]byte{byte('0' + value%10)}, digits...)
		value /= 10
	}
	return string(digits)
}

func trimmed(value string) string { return strings.TrimSpace(value) }

func pointerTo(value string) *string {
	if value == "" {
		return nil
	}
	copy := value
	return &copy
}

func blank(value *string) bool {
	return value == nil || strings.TrimSpace(*value) == ""
}
