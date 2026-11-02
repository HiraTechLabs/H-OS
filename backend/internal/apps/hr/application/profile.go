package application

import (
	"strings"
	"time"
)

// ManagerLookup is the minimal manager identity needed to render a reporting relationship.
type ManagerLookup struct {
	EmployeeID     string
	EmployeeNumber string
	NameEn         string
	NameAr         string
}

type unitRef struct {
	Name LocalizedText
	Path string
}

type referenceIndex struct {
	branch   map[string]LocalizedText
	location map[string]LocalizedText
	unit     map[string]unitRef
	jobTitle map[string]LocalizedText
	jobGrade map[string]LocalizedText
}

func buildReferenceIndex(data OrganizationOverviewData) referenceIndex {
	index := referenceIndex{
		branch:   make(map[string]LocalizedText, len(data.Branches)),
		location: make(map[string]LocalizedText, len(data.Locations)),
		unit:     make(map[string]unitRef, len(data.OrgUnits)),
		jobTitle: make(map[string]LocalizedText, len(data.JobTitles)),
		jobGrade: make(map[string]LocalizedText, len(data.JobGrades)),
	}
	for _, row := range data.Branches {
		index.branch[row.ID] = LocalizedText{En: row.NameEn, Ar: row.NameAr}
	}
	for _, row := range data.Locations {
		index.location[row.ID] = LocalizedText{En: row.NameEn, Ar: row.NameAr}
	}
	for _, row := range data.OrgUnits {
		index.unit[row.ID] = unitRef{Name: LocalizedText{En: row.NameEn, Ar: row.NameAr}, Path: row.Path}
	}
	for _, row := range data.JobTitles {
		index.jobTitle[row.ID] = LocalizedText{En: row.NameEn, Ar: row.NameAr}
	}
	for _, row := range data.JobGrades {
		index.jobGrade[row.ID] = LocalizedText{En: row.NameEn, Ar: row.NameAr}
	}
	return index
}

func displayName(givenEn, familyEn, givenAr, familyAr string) LocalizedText {
	return LocalizedText{
		En: strings.TrimSpace(givenEn + " " + familyEn),
		Ar: strings.TrimSpace(givenAr + " " + familyAr),
	}
}

func summaryOf(aggregate EmployeeAggregate, index referenceIndex, managerNames map[string]LocalizedText) EmployeeSummary {
	summary := EmployeeSummary{
		ID:             aggregate.Core.ID,
		EmployeeNumber: aggregate.Core.EmployeeNumber,
		DisplayName: displayName(
			aggregate.Person.GivenNameEn, aggregate.Person.FamilyNameEn,
			aggregate.Person.GivenNameAr, aggregate.Person.FamilyNameAr,
		),
		Status:    string(aggregate.Core.Status),
		WorkEmail: aggregate.Core.WorkEmail,
	}

	if assignment := aggregate.CurrentAssignment(); assignment != nil {
		if value, ok := index.branch[assignment.BranchID]; ok {
			summary.BranchName = &value
		}
		if value, ok := index.unit[assignment.OrgUnitID]; ok {
			name := value.Name
			summary.OrgUnitName = &name
		}
		if value, ok := index.jobTitle[assignment.JobTitleID]; ok {
			summary.JobTitleName = &value
		}
		if value, ok := index.location[assignment.WorkLocationID]; ok {
			summary.WorkLocationName = &value
		}
	}
	if manager := aggregate.CurrentManager(); manager != nil && manager.ManagerEmployeeID != nil {
		if value, ok := managerNames[*manager.ManagerEmployeeID]; ok {
			summary.ManagerDisplayName = &value
		}
	}
	return summary
}

func assignmentView(row AssignmentRecord, index referenceIndex) OrgAssignmentView {
	unit := index.unit[row.OrgUnitID]
	view := OrgAssignmentView{
		ID:               row.ID,
		OrgUnitID:        row.OrgUnitID,
		OrgUnitName:      unit.Name,
		OrgUnitPath:      unit.Path,
		BranchID:         row.BranchID,
		BranchName:       index.branch[row.BranchID],
		WorkLocationID:   row.WorkLocationID,
		WorkLocationName: index.location[row.WorkLocationID],
		JobTitleID:       row.JobTitleID,
		JobTitleName:     index.jobTitle[row.JobTitleID],
		JobGradeID:       row.JobGradeID,
		WorkArrangement:  row.WorkArrangement,
		WorkScheduleID:   row.WorkScheduleID,
		CostCenterRef:    row.CostCenterRef,
		ValidFrom:        row.ValidFrom,
		ValidTo:          row.ValidTo,
	}
	if row.JobGradeID != nil {
		if value, ok := index.jobGrade[*row.JobGradeID]; ok {
			view.JobGradeName = &value
		}
	}
	return view
}

func managerView(row ManagerRecord, lookup map[string]ManagerLookup) *ManagerView {
	if row.ManagerEmployeeID == nil {
		return nil
	}
	manager, ok := lookup[*row.ManagerEmployeeID]
	if !ok {
		return nil
	}
	return &ManagerView{
		ID:             row.ID,
		EmployeeID:     manager.EmployeeID,
		EmployeeNumber: manager.EmployeeNumber,
		DisplayName:    LocalizedText{En: manager.NameEn, Ar: manager.NameAr},
		ValidFrom:      row.ValidFrom,
		ValidTo:        row.ValidTo,
	}
}

// ProfileContext carries everything the profile mapper needs. Nothing is fetched lazily here: the
// caller assembles the context so the mapper cannot become a hidden second data source.
type ProfileContext struct {
	Aggregate        EmployeeAggregate
	Overview         OrganizationOverviewData
	Managers         map[string]ManagerLookup
	ScopeLevel       string
	IsSelf           bool
	CanReadSensitive bool
	Timeline         []TimelineRecord
	ActorNames       map[string]string
}

// BuildProfile renders the permission-controlled profile.
//
// Sections the caller may not read are reported in `visibleSections`, so the interface renders an
// explicit forbidden state instead of a silent gap (HHR-EMP-001, HHR-UX-002).
func BuildProfile(context ProfileContext) EmployeeProfile {
	index := buildReferenceIndex(context.Overview)
	managerNames := make(map[string]LocalizedText, len(context.Managers))
	for key, value := range context.Managers {
		managerNames[key] = LocalizedText{En: value.NameEn, Ar: value.NameAr}
	}

	canSeePersonal := context.ScopeLevel == "all" || context.CanReadSensitive || context.IsSelf

	sections := []string{"employment", "organization"}
	if canSeePersonal {
		sections = append(sections, "identity", "personal", "contact", "documents")
	}
	if canSeePersonal || context.ScopeLevel != "own" {
		sections = append(sections, "timeline")
	}
	if context.ScopeLevel == "all" || context.CanReadSensitive {
		sections = append(sections, "account")
	}

	profile := EmployeeProfile{
		Summary:         summaryOf(context.Aggregate, index, managerNames),
		VisibleSections: sections,
		Employment:      EmploymentView{Episodes: []EmploymentEpisodeView{}, Contracts: []ContractView{}},
		Organization:    OrganizationView{Assignments: []OrgAssignmentView{}, ManagerHistory: []ManagerView{}},
		Documents:       []DocumentReferenceView{},
		Timeline:        []TimelineEntry{},
	}

	if canSeePersonal {
		profile.Identity = &IdentityView{
			DateOfBirth:      context.Aggregate.Person.DateOfBirth,
			Gender:           context.Aggregate.Person.Gender,
			Nationality:      context.Aggregate.Person.Nationality,
			NationalIDMasked: maskTail(context.Aggregate.Person.NationalIDLast4),
			PassportMasked:   maskTail(context.Aggregate.Person.PassportLast4),
		}
		profile.Contact = &ContactView{
			PersonalEmail: context.Aggregate.Contact.PersonalEmail,
			Phone:         context.Aggregate.Contact.Phone,
			City:          context.Aggregate.Contact.City,
		}
		for _, row := range context.Aggregate.Documents {
			profile.Documents = append(profile.Documents, DocumentReferenceView{
				ID:                row.ID,
				ArchiveDocumentID: row.ArchiveDocumentID,
				DocumentType:      row.DocumentType,
				Classification:    row.Classification,
				IssuedOn:          row.IssuedOn,
				ExpiresOn:         row.ExpiresOn,
			})
		}
	}

	for _, row := range context.Aggregate.Episodes {
		view := EmploymentEpisodeView{
			ID:               row.ID,
			EpisodeNo:        row.EpisodeNo,
			EmploymentType:   row.EmploymentType,
			StartDate:        row.StartDate,
			EndDate:          row.EndDate,
			ProbationEndDate: row.ProbationEndDate,
			EndReason:        row.EndReason,
		}
		profile.Employment.Episodes = append(profile.Employment.Episodes, view)
		if row.EndDate == nil {
			copied := view
			profile.Employment.CurrentEpisode = &copied
		}
	}
	for _, row := range context.Aggregate.Contracts {
		profile.Employment.Contracts = append(profile.Employment.Contracts, ContractView{
			ID:                row.ID,
			EpisodeID:         row.EpisodeID,
			ContractType:      row.ContractType,
			StartDate:         row.StartDate,
			EndDate:           row.EndDate,
			SignedOn:          row.SignedOn,
			ArchiveDocumentID: row.ArchiveDocumentID,
		})
	}

	for _, row := range context.Aggregate.Assignments {
		view := assignmentView(row, index)
		profile.Organization.Assignments = append(profile.Organization.Assignments, view)
		if row.ValidTo == nil {
			copied := view
			profile.Organization.CurrentAssignment = &copied
		}
	}
	for _, row := range context.Aggregate.Managers {
		view := managerView(row, context.Managers)
		if view == nil {
			continue
		}
		profile.Organization.ManagerHistory = append(profile.Organization.ManagerHistory, *view)
		if row.ValidTo == nil {
			copied := *view
			profile.Organization.CurrentManager = &copied
		}
	}

	for _, entry := range context.Timeline {
		var actorName *string
		if entry.ActorAccountID != nil {
			if name, ok := context.ActorNames[*entry.ActorAccountID]; ok {
				value := name
				actorName = &value
			}
		}
		profile.Timeline = append(profile.Timeline, TimelineEntry{
			ID:         entry.ID,
			OccurredOn: entry.OccurredOn,
			RecordedAt: entry.RecordedAt.Format("2006-01-02T15:04:05.000Z07:00"),
			EventType:  entry.EventType,
			ActorName:  actorName,
			Reason:     entry.Reason,
			Summary:    LocalizedText{En: entry.SummaryEn, Ar: entry.SummaryAr},
		})
	}

	if context.Aggregate.AccountLink != nil {
		profile.Account = &AccountLinkView{
			AccountID: context.Aggregate.AccountLink.AccountID,
			LinkedAt:  context.Aggregate.AccountLink.LinkedAt.UTC().Format(time.RFC3339),
		}
	}
	return profile
}

// maskTail renders an identifier tail that was retained on its own. The prefix is a display
// convention: the full identifier never leaves the encrypted column (SEC-008).
func maskTail(tail *string) *string {
	if tail == nil || *tail == "" {
		return nil
	}
	masked := "****" + *tail
	return &masked
}
