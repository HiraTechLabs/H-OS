// Package transport holds the platform's own HTTP boundary: sessions, account administration, the
// application registry and the health probe. Application modules have their own transport package.
package transport

import (
	"net"
	"net/http"
	"strings"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/httpx"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/router"
)

const maxBodyBytes = 1 << 20

// SessionUser is the wire representation of the signed-in caller. It carries permissions and data
// scopes so the interface can hide what the caller must not do — never as a substitute for the
// server-side check (SEC-002).
type SessionUser struct {
	AccountID   string          `json:"accountId"`
	DisplayName string          `json:"displayName"`
	Email       string          `json:"email"`
	Locale      string          `json:"locale"`
	Roles       []string        `json:"roles"`
	Grants      []SessionGrant  `json:"grants"`
}

// SessionGrant is one permission with the data scope it reaches.
type SessionGrant struct {
	Permission string `json:"permission"`
	Scope      string `json:"scope"`
}

// ToSessionUser maps an actor to its wire shape.
func ToSessionUser(actor auth.Actor) SessionUser {
	grants := make([]SessionGrant, 0, len(actor.Grants))
	for _, grant := range actor.Grants {
		grants = append(grants, SessionGrant{Permission: grant.Permission, Scope: string(grant.Scope)})
	}
	roles := actor.Roles
	if roles == nil {
		roles = []string{}
	}
	return SessionUser{
		AccountID:   actor.AccountID,
		DisplayName: actor.DisplayName,
		Email:       actor.Email,
		Locale:      actor.Locale,
		Roles:       roles,
		Grants:      grants,
	}
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type sessionResponse struct {
	User      SessionUser `json:"user"`
	ExpiresAt string      `json:"expiresAt"`
}

// AuthHandler serves sign-in, sign-out and the current session.
type AuthHandler struct {
	sessions *auth.SessionService
	limiter  *auth.RateLimiter
}

// NewAuthHandler wires the session endpoints.
func NewAuthHandler(sessions *auth.SessionService, limiter *auth.RateLimiter) *AuthHandler {
	return &AuthHandler{sessions: sessions, limiter: limiter}
}

// Register adds the session operations. Login is public because it creates the session; every
// other operation either is guarded or is safe to answer without one.
func (h *AuthHandler) Register(r *router.Router) {
	r.HandlePublic(http.MethodPost, "/api/v1/auth/login", "Sign in and receive a session cookie", h.login)
	r.HandlePublic(http.MethodPost, "/api/v1/auth/logout", "End the current session", h.logout)
	r.Handle(http.MethodGet, "/api/v1/auth/me", "Read the current session", auth.Protected(h.sessions, h.me))
}

func (h *AuthHandler) login(w http.ResponseWriter, r *http.Request) {
	var input loginRequest
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	if err := validateLogin(input); err != nil {
		httpx.Error(w, r, err)
		return
	}

	if !h.limiter.Hit(clientKey(r)) {
		httpx.Error(w, r, problem.RateLimited("Too many sign-in attempts. Try again shortly."))
		return
	}

	issued, err := h.sessions.Authenticate(r.Context(), input.Email, input.Password)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	h.sessions.SetCookie(w, issued.Token, issued.ExpiresAt)
	httpx.WriteJSON(w, http.StatusOK, sessionResponse{
		User:      ToSessionUser(issued.Actor),
		ExpiresAt: issued.ExpiresAt.UTC().Format("2006-01-02T15:04:05.000Z07:00"),
	})
}

func (h *AuthHandler) logout(w http.ResponseWriter, r *http.Request) {
	// Sign-out is safe without a valid session: revoking an unknown token is a no-op and the cookie
	// is cleared anyway, so an expired session still ends cleanly.
	if token := auth.TokenFromRequest(r); token != "" {
		if err := h.sessions.Revoke(r.Context(), token); err != nil {
			httpx.Error(w, r, err)
			return
		}
	}
	h.sessions.ClearCookie(w)
	httpx.WriteNoContent(w)
}

func (h *AuthHandler) me(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ToSessionUser(actor))
}

func validateLogin(input loginRequest) error {
	email := strings.ToLower(strings.TrimSpace(input.Email))
	if email == "" || len(email) > 320 || !strings.Contains(email, "@") {
		return problem.Validation("The request does not satisfy the contract.", problem.Detail{
			Field: "email", Code: "format", Message: "Must be a valid email address.",
		})
	}
	if input.Password == "" || len(input.Password) > 256 {
		return problem.Validation("The request does not satisfy the contract.", problem.Detail{
			Field: "password", Code: "length", Message: "Must be between 1 and 256 characters.",
		})
	}
	return nil
}

// clientKey is the source address of the request. A proxy header is deliberately not trusted: an
// attacker who can set it would be able to pick a fresh rate-limit bucket per attempt.
func clientKey(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
