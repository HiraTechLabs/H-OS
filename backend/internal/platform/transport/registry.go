package transport

import (
	"net/http"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/httpx"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/registry"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/router"
)

// RegistryHandler serves the authoritative application registry.
type RegistryHandler struct {
	sessions *auth.SessionService
}

// NewRegistryHandler creates a handler for the application registry.
func NewRegistryHandler(sessions *auth.SessionService) *RegistryHandler {
	return &RegistryHandler{sessions: sessions}
}

// Register registers the registry endpoint on the router.
func (h *RegistryHandler) Register(r *router.Router) {
	r.Handle(http.MethodGet, "/api/v1/apps", "List visible applications for the current session", auth.Protected(h.sessions, h.listApps))
}

type appsResponse struct {
	Apps []registry.Definition `json:"apps"`
}

func (h *RegistryHandler) listApps(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	visible := registry.Visible(actor)
	httpx.WriteJSON(w, http.StatusOK, appsResponse{Apps: visible})
}
