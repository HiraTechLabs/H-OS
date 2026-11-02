package application

import (
	"context"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/clock"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/permissions"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

// UpdateEmployee updates the non-protected part of the profile. National ID, passport and personal
// contact identifiers are deliberately not patchable here: they change through a reviewed request
// (HHR-EMP-004, HHR-SEC-002).
type UpdateEmployee struct {
	pool      Transactor
	clock     clock.Clock
	timeZone  string
	employees EmployeeRepository
	recorder  *Recorder
	scope     *ActorScope
}

// NewUpdateEmployee wires the use case.
func NewUpdateEmployee(
	pool Transactor,
	clk clock.Clock,
	timeZone string,
	employees EmployeeRepository,
	recorder *Recorder,
	scope *ActorScope,
) *UpdateEmployee {
	return &UpdateEmployee{pool: pool, clock: clk, timeZone: timeZone, employees: employees, recorder: recorder, scope: scope}
}

// Execute applies the patch.
func (u *UpdateEmployee) Execute(ctx context.Context, actor auth.Actor, employeeID string, input UpdateEmployeeInput) error {
	if !IsUUID(employeeID) {
		return problem.Validation("The employee identifier is not valid.")
	}
	if err := validateUpdateEmployee(input); err != nil {
		return err
	}

	if _, err := u.scope.AssertCanAccess(ctx, actor, permissions.HREmployeeUpdate, employeeID); err != nil {
		return err
	}

	aggregate, err := u.employees.FindByID(ctx, employeeID)
	if err != nil {
		return problem.Internal(err)
	}
	if aggregate == nil || aggregate.Core.OrganizationID != actor.OrganizationID {
		return problem.NotFound("The employee does not exist.")
	}

	person := aggregate.Person
	if input.Name.Present && input.Name.Value != nil {
		person.GivenNameEn = trimmed(input.Name.Value.GivenEn)
		person.FamilyNameEn = trimmed(input.Name.Value.FamilyEn)
		person.GivenNameAr = trimmed(input.Name.Value.GivenAr)
		person.FamilyNameAr = trimmed(input.Name.Value.FamilyAr)
	}
	person.DateOfBirth = OrPointer(input.DateOfBirth, person.DateOfBirth)
	if input.Gender.Present && input.Gender.Value != nil {
		person.Gender = *input.Gender.Value
	}
	person.Nationality = OrPointer(input.Nationality, person.Nationality)

	contact := aggregate.Contact
	contact.City = OrPointer(input.City, contact.City)

	workEmail := aggregate.Core.WorkEmail
	if input.WorkEmail.Present && input.WorkEmail.Value != nil {
		workEmail = trimmed(*input.WorkEmail.Value)
	}
	if workEmail != aggregate.Core.WorkEmail {
		exists, err := u.employees.WorkEmailExists(ctx, actor.OrganizationID, workEmail)
		if err != nil {
			return problem.Internal(err)
		}
		if exists {
			return problem.Conflict("An employee with this work email already exists.")
		}
	}

	today := u.clock.Today(u.timeZone)
	err = u.pool.InTx(ctx, func(tx db.Tx) error {
		if err := u.employees.UpdatePerson(ctx, tx, employeeID, person, u.clock.Now()); err != nil {
			return err
		}
		if err := u.employees.UpdateContact(ctx, tx, employeeID, contact, u.clock.Now()); err != nil {
			return err
		}
		if err := u.employees.UpdateCore(ctx, tx, employeeID, workEmail, aggregate.Core.Status, u.clock.Now()); err != nil {
			return err
		}
		return u.recorder.Record(ctx, tx, actor, actor.OrganizationID, Change{
			Action:      "hr.employee.updated",
			EmployeeID:  employeeID,
			EffectiveOn: today,
			SummaryEn:   "Profile details updated",
			SummaryAr:   "تم تحديث بيانات الملف الشخصي",
			Before: map[string]any{
				"givenNameEn": aggregate.Person.GivenNameEn,
				"familyNameEn": aggregate.Person.FamilyNameEn,
				"workEmail":   aggregate.Core.WorkEmail,
				"city":        aggregate.Contact.City,
			},
			After: map[string]any{
				"givenNameEn": person.GivenNameEn,
				"familyNameEn": person.FamilyNameEn,
				"workEmail":   workEmail,
				"city":        contact.City,
			},
			EventType:    EventEmployeeUpdated,
			EventVersion: 1,
			EventPayload: map[string]any{"employeeId": employeeID},
		})
	})
	return translateWriteError(err)
}

func validateUpdateEmployee(input UpdateEmployeeInput) error {
	v := &validator{}

	if input.Name.Present {
		if input.Name.Value == nil {
			v.add("name", "type", "Must be an object.")
		} else {
			v.text("name.givenEn", input.Name.Value.GivenEn, 1, 100)
			v.text("name.familyEn", input.Name.Value.FamilyEn, 1, 100)
			v.text("name.givenAr", input.Name.Value.GivenAr, 1, 100)
			v.text("name.familyAr", input.Name.Value.FamilyAr, 1, 100)
		}
	}
	v.optionalBusinessDate("dateOfBirth", input.DateOfBirth.Value)
	if input.Gender.Present {
		if input.Gender.Value == nil {
			v.add("gender", "type", "Must be a gender value, not null.")
		} else {
			v.oneOf("gender", *input.Gender.Value, genderValues)
		}
	}
	if input.Nationality.Present && input.Nationality.Value != nil {
		length := len(*input.Nationality.Value)
		if length < 2 || length > 3 {
			v.add("nationality", "length", "Must be between 2 and 3 characters.")
		}
	}
	if input.WorkEmail.Present {
		if input.WorkEmail.Value == nil {
			v.add("workEmail", "type", "Must be an email address, not null.")
		} else {
			v.email("workEmail", *input.WorkEmail.Value, true)
		}
	}
	v.optionalText("city", input.City.Value, 100)

	return v.err()
}
