package domain_test

import (
	"testing"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/domain"
)

func TestBusinessDate_Validation(t *testing.T) {
	tests := []struct {
		date  string
		valid bool
	}{
		{"2026-11-02", true},
		{"2026-02-28", true},
		{"2024-02-29", true}, // Leap year
		{"2026-02-29", false}, // Not leap year
		{"2026-13-01", false},
		{"2026-00-01", false},
		{"invalid-date", false},
		{"", false},
	}

	for _, tt := range tests {
		valid := domain.IsBusinessDate(tt.date)
		if valid != tt.valid {
			t.Errorf("expected date %q validity to be %v, got %v", tt.date, tt.valid, valid)
		}
	}
}

func TestEmploymentStatus_Transitions(t *testing.T) {
	// PendingStart -> Active (valid)
	if !domain.CanTransition(domain.StatusPendingStart, domain.StatusActive) {
		t.Errorf("expected PendingStart->Active to be allowed")
	}

	// Active -> Suspended (valid)
	if !domain.CanTransition(domain.StatusActive, domain.StatusSuspended) {
		t.Errorf("expected Active->Suspended to be allowed")
	}

	// Active -> Terminated (valid)
	if !domain.CanTransition(domain.StatusActive, domain.StatusTerminated) {
		t.Errorf("expected Active->Terminated to be allowed")
	}

	// Terminated -> Active (invalid illegal transition, must rehire through pending_start)
	if domain.CanTransition(domain.StatusTerminated, domain.StatusActive) {
		t.Errorf("expected Terminated->Active to be rejected")
	}

	// Terminated -> PendingStart (valid rehire transition)
	if !domain.CanTransition(domain.StatusTerminated, domain.StatusPendingStart) {
		t.Errorf("expected Terminated->PendingStart to be allowed")
	}
}

func TestOrgUnitPath_Hierarchy(t *testing.T) {
	parent := "root_corp"
	childPath, err := domain.ChildPath(&parent, "FIN-DEPT")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if childPath != "root_corp.fin_dept" {
		t.Errorf("expected root_corp.fin_dept, got %q", childPath)
	}

	if !domain.IsDescendantPath(childPath, "root_corp") {
		t.Errorf("expected %q to be descendant of root_corp", childPath)
	}
	if domain.IsDescendantPath("other_corp.dept", "root_corp") {
		t.Errorf("expected other_corp.dept not to be descendant of root_corp")
	}
}

func TestEmployeeNumber_Formatting(t *testing.T) {
	num, err := domain.FormatEmployeeNumber(42)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if num != "EMP-00042" {
		t.Errorf("expected EMP-00042, got %q", num)
	}

	if !domain.IsEmployeeNumber(num) {
		t.Errorf("expected %q to be recognized as employee number", num)
	}
}
