package registry_test

import (
	"testing"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/permissions"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/registry"
)

func TestValidate_OfficialCatalogue(t *testing.T) {
	if err := registry.Validate(); err != nil {
		t.Fatalf("registry.Validate() returned error: %v", err)
	}
}

func TestRegistry_OfficialAppsCountAndOrder(t *testing.T) {
	apps := registry.All()
	if len(apps) != 10 {
		t.Fatalf("expected 10 official apps/systems, got %d", len(apps))
	}

	expectedIDs := []string{
		"archive",
		"finance",
		"sales",
		"inventory",
		"rooms",
		"hr",
		"camera",
		"assets",
		"collaboration",
		"tasks",
	}

	for i, expectedID := range expectedIDs {
		if apps[i].ID != expectedID {
			t.Errorf("expected index %d to have ID %q, got %q", i, expectedID, apps[i].ID)
		}
	}
}

func TestRegistry_OfficialNamesPreserved(t *testing.T) {
	expectedNames := map[string]string{
		"archive":       "H-Archive",
		"finance":       "H-Finance",
		"sales":         "H-SALES",
		"inventory":     "H-Inventory",
		"rooms":         "H-ROOMS",
		"hr":            "H-HR",
		"camera":        "H-CAMERA",
		"assets":        "H-ASSETS",
		"collaboration": "Team Collaboration & Chat Apps",
		"tasks":         "Task Management Tool / App",
	}

	for id, expectedName := range expectedNames {
		def, ok := registry.ByID(id)
		if !ok {
			t.Errorf("app %q not found in registry", id)
			continue
		}
		if def.Name != expectedName {
			t.Errorf("app %q: expected name %q, got %q", id, expectedName, def.Name)
		}
		if def.DisplayName.En == "" || def.DisplayName.Ar == "" {
			t.Errorf("app %q: missing English or Arabic display name", id)
		}
		if def.Description.En == "" || def.Description.Ar == "" {
			t.Errorf("app %q: missing English or Arabic description", id)
		}
		if def.Module == "" {
			t.Errorf("app %q: missing owning module", id)
		}
		if def.Route == "" {
			t.Errorf("app %q: missing route", id)
		}
	}
}

func TestRegistry_PermissionsDefinedInCatalogue(t *testing.T) {
	for _, app := range registry.All() {
		if !permissions.Valid(app.Permission) {
			t.Errorf("app %q permission %q not found in permission catalogue", app.ID, app.Permission)
		}
	}
}

func TestRegistry_Visible_PermissionFiltering(t *testing.T) {
	// Actor with no permissions
	anonymousActor := auth.Actor{
		AccountID: "acc_1",
		Grants:    []auth.Grant{},
	}
	visible := registry.Visible(anonymousActor)
	if len(visible) != 0 {
		t.Errorf("expected 0 apps visible to unprivileged actor, got %d", len(visible))
	}

	// Actor with only HR access
	hrActor := auth.Actor{
		AccountID: "acc_2",
		Grants: []auth.Grant{
			{Permission: "app.hr.access", Scope: auth.ScopeAll},
		},
	}
	visibleHR := registry.Visible(hrActor)
	if len(visibleHR) != 1 || visibleHR[0].ID != "hr" {
		t.Errorf("expected only H-HR visible to hrActor, got %+v", visibleHR)
	}

	// Super-admin actor with wildcard or all permissions
	allGrants := make([]auth.Grant, 0)
	for _, def := range permissions.All() {
		allGrants = append(allGrants, auth.Grant{Permission: def.Code, Scope: auth.ScopeAll})
	}
	adminActor := auth.Actor{
		AccountID: "acc_admin",
		Grants:    allGrants,
	}
	visibleAdmin := registry.Visible(adminActor)
	if len(visibleAdmin) != 10 {
		t.Errorf("expected all 10 apps visible to admin actor, got %d", len(visibleAdmin))
	}
}
