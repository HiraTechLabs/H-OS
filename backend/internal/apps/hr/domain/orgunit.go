package domain

import (
	"fmt"
	"regexp"
	"strings"
)

// EmployeeNumberPrefix is the business-facing prefix of a generated employee number.
const EmployeeNumberPrefix = "EMP"

const employeeNumberWidth = 5

var employeeNumberPattern = regexp.MustCompile(`^[A-Z0-9][A-Z0-9-]{0,23}$`)
var orgUnitCodePattern = regexp.MustCompile(`^[A-Z0-9-]+$`)

// Employee numbers are business-facing and immutable (HHR-DOM-001). They come from a per-organization
// sequence allocated inside the creating transaction (BIZ-008), never from the client.

// FormatEmployeeNumber renders a sequence value, e.g. 42 -> EMP-00042.
func FormatEmployeeNumber(sequenceValue int) (string, error) {
	if sequenceValue < 1 {
		return "", fmt.Errorf("employee number sequence must be a positive integer, got %d", sequenceValue)
	}
	return fmt.Sprintf("%s-%0*d", EmployeeNumberPrefix, employeeNumberWidth, sequenceValue), nil
}

// IsEmployeeNumber reports whether a client-supplied number matches the accepted shape.
func IsEmployeeNumber(value string) bool {
	return employeeNumberPattern.MatchString(value)
}

// IsOrgUnitCode reports whether a code can form an ltree label.
func IsOrgUnitCode(value string) bool {
	return orgUnitCodePattern.MatchString(value) && len(value) >= 2 && len(value) <= 32
}

// LabelFor derives the ltree label from an org unit code. `ltree` labels accept letters, digits and
// underscores; user-facing codes use dashes, so the mapping is deterministic and documented.
func LabelFor(code string) (string, error) {
	if !IsOrgUnitCode(code) {
		return "", &RuleViolation{Rule: "HR-ORG-001", Message: "Org unit code is not valid."}
	}
	return strings.ToLower(strings.ReplaceAll(code, "-", "_")), nil
}

// ChildPath returns `parent.label`, or just `label` for a root unit.
func ChildPath(parentPath *string, code string) (string, error) {
	label, err := LabelFor(code)
	if err != nil {
		return "", err
	}
	if parentPath == nil {
		return label, nil
	}
	return *parentPath + "." + label, nil
}

// IsDescendantPath reports whether candidate is the ancestor itself or below it.
func IsDescendantPath(candidate, ancestor string) bool {
	if candidate == ancestor {
		return true
	}
	return strings.HasPrefix(candidate, ancestor+".")
}
