package registry_test

import (
	"strings"
	"testing"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/registry"
)

func TestRegistry_RobustValidationRules(t *testing.T) {
	// Base validation should succeed
	if err := registry.Validate(); err != nil {
		t.Fatalf("expected valid default registry, got: %v", err)
	}

	all := registry.All()

	// 1. Verify Unique IDs
	ids := make(map[string]bool)
	for _, app := range all {
		if ids[app.ID] {
			t.Errorf("duplicate ID found: %s", app.ID)
		}
		ids[app.ID] = true
	}

	// 2. Verify Unique Official Names
	names := make(map[string]bool)
	for _, app := range all {
		if names[app.Name] {
			t.Errorf("duplicate official name found: %s", app.Name)
		}
		names[app.Name] = true
	}

	// 3. Verify Unique and Valid Routes
	routes := make(map[string]bool)
	for _, app := range all {
		if routes[app.Route] {
			t.Errorf("duplicate route found: %s", app.Route)
		}
		routes[app.Route] = true

		if !strings.HasPrefix(app.Route, "/apps/") {
			t.Errorf("app %s route %s does not have /apps/ prefix", app.ID, app.Route)
		}
	}

	// 4. Verify Localized metadata present and non-empty
	for _, app := range all {
		if strings.TrimSpace(app.DisplayName.En) == "" || strings.TrimSpace(app.DisplayName.Ar) == "" {
			t.Errorf("app %s missing English or Arabic display name", app.ID)
		}
		if strings.TrimSpace(app.Description.En) == "" || strings.TrimSpace(app.Description.Ar) == "" {
			t.Errorf("app %s missing English or Arabic description", app.ID)
		}
	}

	// 5. Verify Module Ownership
	for _, app := range all {
		if strings.TrimSpace(app.Module) == "" {
			t.Errorf("app %s missing module ownership", app.ID)
		}
	}

	// 6. Verify Availability Status Honest Value
	for _, app := range all {
		switch app.Availability {
		case registry.Available, registry.UnderDevelopment, registry.Disabled:
		default:
			t.Errorf("app %s has invalid availability status: %s", app.ID, app.Availability)
		}
	}
}
