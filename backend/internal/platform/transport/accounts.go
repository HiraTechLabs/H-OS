package transport

import (
	"net/http"
	"strings"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/accounts"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/httpx"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/router"
)

type createAccountRequest struct {
	Email       string   `json:"email"`
	DisplayName string   `json:"displayName"`
	Password    string   `json:"password"`
	Locale      string   `json:"locale"`
	Roles       []string `json:"roles"`
}

type roleAssignmentRequest struct {
	RoleCode string `json:"roleCode"`
}

// AccountHandler is the HTTP boundary of account administration (DEC-0003, SEC-002). The service
// checks the permission again, so a route cannot be reachable by accident.
type AccountHandler struct {
	sessions *auth.SessionService
	accounts *accounts.Management
}

// NewAccountHandler wires the account endpoints.
func NewAccountHandler(sessions *auth.SessionService, management *accounts.Management) *AccountHandler {
	return &AccountHandler{sessions: sessions, accounts: management}
}

// Register adds the account administration operations.
func (h *AccountHandler) Register(r *router.Router) {
	r.Handle(http.MethodGet, "/api/v1/platform/accounts", "List login accounts", auth.Protected(h.sessions, h.list))
	r.Handle(http.MethodPost, "/api/v1/platform/accounts", "Create a login account", auth.Protected(h.sessions, h.create))
	r.Handle(http.MethodPost, "/api/v1/platform/accounts/{accountId}/roles", "Grant a role", auth.Protected(h.sessions, h.assignRole))
	r.Handle(http.MethodDelete, "/api/v1/platform/accounts/{accountId}/roles/{roleCode}", "Revoke a role", auth.Protected(h.sessions, h.revokeRole))
	r.Handle(http.MethodPost, "/api/v1/platform/accounts/{accountId}/disable", "Disable a login account", auth.Protected(h.sessions, h.disable))
}

func (h *AccountHandler) list(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	items, err := h.accounts.List(r.Context(), actor)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *AccountHandler) create(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var input createAccountRequest
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	if err := validateCreateAccount(input); err != nil {
		httpx.Error(w, r, err)
		return
	}
	locale := input.Locale
	if locale == "" {
		locale = "en"
	}
	accountID, err := h.accounts.Create(r.Context(), actor, accounts.CreateInput{
		Email:       input.Email,
		DisplayName: input.DisplayName,
		Password:    input.Password,
		Locale:      locale,
		Roles:       input.Roles,
	})
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, map[string]string{"accountId": accountID})
}

func (h *AccountHandler) assignRole(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var input roleAssignmentRequest
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	if err := validateRoleCode(input.RoleCode); err != nil {
		httpx.Error(w, r, err)
		return
	}
	if err := h.accounts.AssignRole(r.Context(), actor, r.PathValue("accountId"), input.RoleCode); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteNoContent(w)
}

func (h *AccountHandler) revokeRole(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	roleCode := r.PathValue("roleCode")
	if err := validateRoleCode(roleCode); err != nil {
		httpx.Error(w, r, err)
		return
	}
	if err := h.accounts.RevokeRole(r.Context(), actor, r.PathValue("accountId"), roleCode); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteNoContent(w)
}

func (h *AccountHandler) disable(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	if err := h.accounts.Disable(r.Context(), actor, r.PathValue("accountId")); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteNoContent(w)
}

func validateCreateAccount(input createAccountRequest) error {
	var details []problem.Detail
	email := strings.ToLower(strings.TrimSpace(input.Email))
	if email == "" || len(email) > 320 || !strings.Contains(email, "@") {
		details = append(details, problem.Detail{Field: "email", Code: "format", Message: "Must be a valid email address."})
	}
	displayName := strings.TrimSpace(input.DisplayName)
	if length := len([]rune(displayName)); length < 1 || length > 100 {
		details = append(details, problem.Detail{Field: "displayName", Code: "length", Message: "Must be between 1 and 100 characters."})
	}
	if length := len(input.Password); length < 12 || length > 256 {
		details = append(details, problem.Detail{Field: "password", Code: "length", Message: "Must be between 12 and 256 characters."})
	}
	if input.Locale != "" && input.Locale != "en" && input.Locale != "ar" {
		details = append(details, problem.Detail{Field: "locale", Code: "enum", Message: "Must be en or ar."})
	}
	if len(input.Roles) > 8 {
		details = append(details, problem.Detail{Field: "roles", Code: "length", Message: "At most 8 roles may be granted."})
	}
	for _, role := range input.Roles {
		if length := len(role); length < 2 || length > 64 {
			details = append(details, problem.Detail{Field: "roles", Code: "length", Message: "Each role code must be between 2 and 64 characters."})
			break
		}
	}
	if len(details) > 0 {
		return problem.Validation("The request does not satisfy the contract.", details...)
	}
	return nil
}

func validateRoleCode(roleCode string) error {
	if length := len(roleCode); length < 2 || length > 64 {
		return problem.Validation("The role code is not valid.", problem.Detail{
			Field: "roleCode", Code: "length", Message: "Must be between 2 and 64 characters.",
		})
	}
	return nil
}
