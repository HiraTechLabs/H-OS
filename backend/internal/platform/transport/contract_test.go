package transport_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/transport"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/router"
	platformtransport "github.com/HiraTechLabs/H-OS/backend/internal/platform/transport"
	"gopkg.in/yaml.v3"
)

type openAPIDoc struct {
	Paths map[string]map[string]any `yaml:"paths"`
}

func TestOpenAPI_AllRegisteredEndpointsDocumented(t *testing.T) {
	// Construct router with all registered routes
	r := router.New()

	authHandler := platformtransport.NewAuthHandler(nil, nil)
	authHandler.Register(r)

	accountsHandler := platformtransport.NewAccountHandler(nil, nil)
	accountsHandler.Register(r)

	registryHandler := platformtransport.NewRegistryHandler(nil)
	registryHandler.Register(r)

	healthHandler := platformtransport.NewHealthHandler(nil)
	healthHandler.Register(r)

	hrHandler := transport.NewHandler(
		nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil,
	)
	hrHandler.Register(r)

	registeredRoutes := r.Routes()

	// Read and parse openapi.yaml
	openapiPath := filepath.Join("..", "..", "..", "..", "platform", "contracts", "openapi.yaml")
	data, err := os.ReadFile(openapiPath)
	if err != nil {
		t.Fatalf("failed to read openapi.yaml: %v", err)
	}

	var doc openAPIDoc
	if err := yaml.Unmarshal(data, &doc); err != nil {
		t.Fatalf("failed to parse openapi.yaml: %v", err)
	}

	// Verify each API route (under /api/v1) is documented
	for _, route := range registeredRoutes {
		if !strings.HasPrefix(route.Pattern, "/api/v1") {
			continue // skip /healthz, /readyz
		}

		subPath := strings.TrimPrefix(route.Pattern, "/api/v1")
		pathItem, exists := doc.Paths[subPath]
		if !exists {
			t.Errorf("registered route %s %s not found in OpenAPI specification", route.Method, route.Pattern)
			continue
		}

		methodKey := strings.ToLower(route.Method)
		if _, methodExists := pathItem[methodKey]; !methodExists {
			t.Errorf("registered method %s for route %s not found in OpenAPI specification", route.Method, route.Pattern)
		}
	}
}
