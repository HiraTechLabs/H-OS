package application

import (
	"context"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/clock"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/ids"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/links"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/outbox"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/permissions"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

// AddEmergencyContact adds one emergency contact. The employee may do this for themselves; HR
// staff need the update permission. Every change is audited, and the phone number never enters the
// audit snapshot (HHR-SEC-005).
type AddEmergencyContact struct {
	pool      Transactor
	clock     clock.Clock
	timeZone  string
	employees EmployeeRepository
	recorder  *Recorder
	scope     *ActorScope
}

// NewAddEmergencyContact wires the use case.
func NewAddEmergencyContact(
	pool Transactor,
	clk clock.Clock,
	timeZone string,
	employees EmployeeRepository,
	recorder *Recorder,
	scope *ActorScope,
) *AddEmergencyContact {
	return &AddEmergencyContact{pool: pool, clock: clk, timeZone: timeZone, employees: employees, recorder: recorder, scope: scope}
}

// Execute adds the contact and returns its identifier.
func (u *AddEmergencyContact) Execute(ctx context.Context, actor auth.Actor, employeeID string, input CreateEmergencyContactInput) (string, error) {
	if !IsUUID(employeeID) {
		return "", problem.Validation("The employee identifier is not valid.")
	}
	if err := validateEmergencyContact(input); err != nil {
		return "", err
	}

	identity, err := u.scope.IdentityOf(ctx, actor)
	if err != nil {
		return "", err
	}
	isSelf := identity.EmployeeID != nil && *identity.EmployeeID == employeeID
	if !isSelf {
		if _, err := u.scope.AssertCanAccess(ctx, actor, permissions.HREmployeeUpdate, employeeID); err != nil {
			return "", err
		}
	}

	aggregate, err := u.employees.FindByID(ctx, employeeID)
	if err != nil {
		return "", problem.Internal(err)
	}
	if aggregate == nil || aggregate.Core.OrganizationID != actor.OrganizationID {
		return "", problem.NotFound("The employee does not exist.")
	}

	today := u.clock.Today(u.timeZone)
	contactID := ids.New()
	priority := input.Priority
	if priority == 0 {
		priority = 1
	}

	err = u.pool.InTx(ctx, func(tx db.Tx) error {
		if err := u.employees.AddEmergencyContact(ctx, tx, employeeID, actor.OrganizationID, EmergencyContactInput{
			ID:           contactID,
			Name:         trimmed(input.Name),
			Relationship: trimmed(input.Relationship),
			Phone:        trimmed(input.Phone),
			Priority:     priority,
		}); err != nil {
			return err
		}
		return u.recorder.Record(ctx, tx, actor, actor.OrganizationID, Change{
			Action:      "hr.employee.emergency_contact_added",
			EmployeeID:  employeeID,
			EffectiveOn: today,
			SummaryEn:   "Emergency contact added",
			SummaryAr:   "تمت إضافة جهة اتصال للطوارئ",
			// The phone number is personal data and is never written to the audit snapshot.
			After: map[string]any{"relationship": trimmed(input.Relationship), "priority": priority},
		})
	})
	if err != nil {
		return "", translateWriteError(err)
	}
	return contactID, nil
}

// AddDocumentReference records a reference to a document owned by H-Archive and links the two
// entities. H-HR stores no file bytes and does not claim the document exists: it stores the opaque
// ID plus HR's own metadata (HHR-EMP-005, BIZ-011).
type AddDocumentReference struct {
	pool      Transactor
	clock     clock.Clock
	timeZone  string
	employees EmployeeRepository
	links     *links.Service
	recorder  *Recorder
	scope     *ActorScope
}

// NewAddDocumentReference wires the use case.
func NewAddDocumentReference(
	pool Transactor,
	clk clock.Clock,
	timeZone string,
	employees EmployeeRepository,
	linkService *links.Service,
	recorder *Recorder,
	scope *ActorScope,
) *AddDocumentReference {
	return &AddDocumentReference{
		pool: pool, clock: clk, timeZone: timeZone,
		employees: employees, links: linkService, recorder: recorder, scope: scope,
	}
}

// Execute records the reference and returns its identifier.
func (u *AddDocumentReference) Execute(ctx context.Context, actor auth.Actor, employeeID string, input DocumentReferenceInput) (string, error) {
	if !IsUUID(employeeID) {
		return "", problem.Validation("The employee identifier is not valid.")
	}
	if err := validateDocumentReference(input); err != nil {
		return "", err
	}

	if _, err := u.scope.AssertCanAccess(ctx, actor, permissions.HREmployeeUpdate, employeeID); err != nil {
		return "", err
	}

	aggregate, err := u.employees.FindByID(ctx, employeeID)
	if err != nil {
		return "", problem.Internal(err)
	}
	if aggregate == nil || aggregate.Core.OrganizationID != actor.OrganizationID {
		return "", problem.NotFound("The employee does not exist.")
	}

	documentID := ids.New()
	today := u.clock.Today(u.timeZone)
	err = u.pool.InTx(ctx, func(tx db.Tx) error {
		if err := u.employees.AddDocument(ctx, tx, employeeID, actor.OrganizationID, DocumentInput{
			ID:                documentID,
			ArchiveDocumentID: input.ArchiveDocumentID,
			DocumentType:      input.DocumentType,
			Classification:    input.Classification,
			IssuedOn:          input.IssuedOn,
			ExpiresOn:         input.ExpiresOn,
		}); err != nil {
			return err
		}
		if err := u.links.Link(ctx, tx, actor.OrganizationID,
			outbox.Subject{App: "hr", Type: "employee_document", ID: documentID},
			[]links.Ref{{App: "archive", Type: "document", ID: input.ArchiveDocumentID}},
		); err != nil {
			return err
		}
		return u.recorder.Record(ctx, tx, actor, actor.OrganizationID, Change{
			Action:      "hr.employee.document_linked",
			EmployeeID:  employeeID,
			EffectiveOn: today,
			SummaryEn:   "Document reference added",
			SummaryAr:   "تمت إضافة مرجع مستند",
			After: map[string]any{
				"documentType":   input.DocumentType,
				"classification": input.Classification,
			},
			RelatedType: pointerTo("employee_document"),
			RelatedID:   &documentID,
		})
	})
	if err != nil {
		return "", translateWriteError(err)
	}
	return documentID, nil
}

func validateEmergencyContact(input CreateEmergencyContactInput) error {
	v := &validator{}
	v.text("name", input.Name, 1, 120)
	v.text("relationship", input.Relationship, 1, 60)
	v.text("phone", input.Phone, 4, 32)
	if input.Priority != 0 && (input.Priority < 1 || input.Priority > 10) {
		v.add("priority", "range", "Must be between 1 and 10.")
	}
	return v.err()
}

func validateDocumentReference(input DocumentReferenceInput) error {
	v := &validator{}
	v.text("archiveDocumentId", input.ArchiveDocumentID, 1, 128)
	v.text("documentType", input.DocumentType, 1, 60)
	v.oneOf("classification", input.Classification, classificationValues)
	v.optionalBusinessDate("issuedOn", input.IssuedOn)
	v.optionalBusinessDate("expiresOn", input.ExpiresOn)
	return v.err()
}
