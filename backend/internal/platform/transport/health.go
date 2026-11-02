package transport

import (
	"context"
	"net/http"
	"time"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/httpx"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/router"
)

// HealthHandler serves liveness and readiness probes.
type HealthHandler struct {
	pool *db.Pool
}

// NewHealthHandler creates a health handler.
func NewHealthHandler(pool *db.Pool) *HealthHandler {
	return &HealthHandler{pool: pool}
}

// Register registers health endpoints on the router.
func (h *HealthHandler) Register(r *router.Router) {
	r.HandlePublic(http.MethodGet, "/healthz", "Liveness probe", h.live)
	r.HandlePublic(http.MethodGet, "/readyz", "Readiness probe", h.ready)
}

type healthResponse struct {
	Status    string            `json:"status"`
	Timestamp string            `json:"timestamp"`
	Checks    map[string]string `json:"checks,omitempty"`
}

func (h *HealthHandler) live(w http.ResponseWriter, r *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, healthResponse{
		Status:    "pass",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *HealthHandler) ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	checks := make(map[string]string)
	checks["database"] = "pass"

	if h.pool != nil {
		var one int
		if err := h.pool.QueryRow(ctx, "SELECT 1").Scan(&one); err != nil {
			checks["database"] = "fail"
			httpx.WriteJSON(w, http.StatusServiceUnavailable, healthResponse{
				Status:    "fail",
				Timestamp: time.Now().UTC().Format(time.RFC3339),
				Checks:    checks,
			})
			return
		}
	}

	httpx.WriteJSON(w, http.StatusOK, healthResponse{
		Status:    "pass",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Checks:    checks,
	})
}
