// Package transport is the HTTP boundary of H-HR. It decodes and validates a request, delegates
// authorization and business rules to a use case, and renders the result. It contains no business
// rule of its own (ARCH-005, SEC-004).
package transport

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/HiraTechLabs/H-OS/backend/internal/apps/hr/application"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/httpx"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/router"
)

const maxBodyBytes = 1 << 20

// Handler owns the H-HR route table and its use cases.
type Handler struct {
	sessions *auth.SessionService

	createEmployee   *application.CreateEmployee
	listEmployees    *application.ListEmployees
	getProfile       *application.GetEmployeeProfile
	updateEmployee   *application.UpdateEmployee
	changeStatus     *application.ChangeStatus
	changeAssignment *application.ChangeAssignment
	changeManager    *application.ChangeManager
	linkAccount      *application.LinkAccount
	addContact       *application.AddEmergencyContact
	addDocument      *application.AddDocumentReference

	getOrganization      *application.GetOrganization
	createBranch         *application.CreateBranch
	createWorkLocation   *application.CreateWorkLocation
	createOrgUnit        *application.CreateOrgUnit
	createJobTitle       *application.CreateJobTitle
	createJobGrade       *application.CreateJobGrade
	createWorkSchedule   *application.CreateWorkSchedule
}

// NewHandler wires the transport with its use cases.
func NewHandler(
	sessions *auth.SessionService,
	createEmployee *application.CreateEmployee,
	listEmployees *application.ListEmployees,
	getProfile *application.GetEmployeeProfile,
	updateEmployee *application.UpdateEmployee,
	changeStatus *application.ChangeStatus,
	changeAssignment *application.ChangeAssignment,
	changeManager *application.ChangeManager,
	linkAccount *application.LinkAccount,
	addContact *application.AddEmergencyContact,
	addDocument *application.AddDocumentReference,
	getOrganization *application.GetOrganization,
	createBranch *application.CreateBranch,
	createWorkLocation *application.CreateWorkLocation,
	createOrgUnit *application.CreateOrgUnit,
	createJobTitle *application.CreateJobTitle,
	createJobGrade *application.CreateJobGrade,
	createWorkSchedule *application.CreateWorkSchedule,
) *Handler {
	return &Handler{
		sessions:             sessions,
		createEmployee:       createEmployee,
		listEmployees:        listEmployees,
		getProfile:           getProfile,
		updateEmployee:       updateEmployee,
		changeStatus:         changeStatus,
		changeAssignment:     changeAssignment,
		changeManager:        changeManager,
		linkAccount:          linkAccount,
		addContact:           addContact,
		addDocument:          addDocument,
		getOrganization:      getOrganization,
		createBranch:         createBranch,
		createWorkLocation:   createWorkLocation,
		createOrgUnit:        createOrgUnit,
		createJobTitle:       createJobTitle,
		createJobGrade:       createJobGrade,
		createWorkSchedule:   createWorkSchedule,
	}
}

// Register adds every H-HR operation to the route table. Authentication is applied here, once, so
// no handler can be added without it.
func (h *Handler) Register(r *router.Router) {
	r.Handle(http.MethodPost, "/api/v1/employees", "Create an employee", h.protected(h.createEmployeeHandler))
	r.Handle(http.MethodGet, "/api/v1/employees", "List employees within the caller's data scope", h.protected(h.listEmployeesHandler))
	r.Handle(http.MethodGet, "/api/v1/employees/me", "Read the caller's own employee profile", h.protected(h.selfProfileHandler))
	r.Handle(http.MethodGet, "/api/v1/employees/{id}", "Read one employee profile", h.protected(h.profileHandler))
	r.Handle(http.MethodPatch, "/api/v1/employees/{id}", "Update the non-protected profile fields", h.protected(h.updateEmployeeHandler))
	r.Handle(http.MethodPost, "/api/v1/employees/{id}/status", "Change the employment status", h.protected(h.changeStatusHandler))
	r.Handle(http.MethodPost, "/api/v1/employees/{id}/assignment", "Change the organizational assignment", h.protected(h.changeAssignmentHandler))
	r.Handle(http.MethodPost, "/api/v1/employees/{id}/manager", "Change the direct manager", h.protected(h.changeManagerHandler))
	r.Handle(http.MethodPost, "/api/v1/employees/{id}/account-link", "Link a login account", h.protected(h.linkAccountHandler))
	r.Handle(http.MethodPost, "/api/v1/employees/{id}/emergency-contacts", "Add an emergency contact", h.protected(h.addContactHandler))
	r.Handle(http.MethodPost, "/api/v1/employees/{id}/documents", "Add a document reference", h.protected(h.addDocumentHandler))

	r.Handle(http.MethodGet, "/api/v1/organization", "Read organization reference data", h.protected(h.organizationHandler))
	r.Handle(http.MethodPost, "/api/v1/organization/branches", "Create a branch", h.protected(h.createBranchHandler))
	r.Handle(http.MethodPost, "/api/v1/organization/locations", "Create a work location", h.protected(h.createWorkLocationHandler))
	r.Handle(http.MethodPost, "/api/v1/organization/org-units", "Create an organization unit", h.protected(h.createOrgUnitHandler))
	r.Handle(http.MethodPost, "/api/v1/organization/job-titles", "Create a job title", h.protected(h.createJobTitleHandler))
	r.Handle(http.MethodPost, "/api/v1/organization/job-grades", "Create a job grade", h.protected(h.createJobGradeHandler))
	r.Handle(http.MethodPost, "/api/v1/organization/work-schedules", "Create a work schedule", h.protected(h.createWorkScheduleHandler))
}

func (h *Handler) protected(handler http.HandlerFunc) http.HandlerFunc {
	return auth.Protected(h.sessions, handler)
}

func (h *Handler) createEmployeeHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var input application.CreateEmployeeInput
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	result, err := h.createEmployee.Execute(r.Context(), actor, input)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, result)
}

func (h *Handler) listEmployeesHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	input, err := decodeListQuery(r)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	result, err := h.listEmployees.Execute(r.Context(), actor, input)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, result)
}

func (h *Handler) selfProfileHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	profile, err := h.getProfile.Self(r.Context(), actor)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, profile)
}

func (h *Handler) profileHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	profile, err := h.getProfile.Execute(r.Context(), actor, r.PathValue("id"))
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, profile)
}

func (h *Handler) updateEmployeeHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var input application.UpdateEmployeeInput
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	if err := h.updateEmployee.Execute(r.Context(), actor, r.PathValue("id"), input); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteNoContent(w)
}

func (h *Handler) changeStatusHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var input application.ChangeStatusInput
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	if err := h.changeStatus.Execute(r.Context(), actor, r.PathValue("id"), input); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteNoContent(w)
}

func (h *Handler) changeAssignmentHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var input application.ChangeAssignmentInput
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	if err := h.changeAssignment.Execute(r.Context(), actor, r.PathValue("id"), input); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteNoContent(w)
}

func (h *Handler) changeManagerHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var input application.ChangeManagerInput
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	if err := h.changeManager.Execute(r.Context(), actor, r.PathValue("id"), input); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteNoContent(w)
}

func (h *Handler) linkAccountHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var input application.LinkAccountInput
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	if err := h.linkAccount.Execute(r.Context(), actor, r.PathValue("id"), input); err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteNoContent(w)
}

func (h *Handler) addContactHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var input application.CreateEmergencyContactInput
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	id, err := h.addContact.Execute(r.Context(), actor, r.PathValue("id"), input)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (h *Handler) addDocumentHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var input application.DocumentReferenceInput
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	id, err := h.addDocument.Execute(r.Context(), actor, r.PathValue("id"), input)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (h *Handler) organizationHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	overview, err := h.getOrganization.Execute(r.Context(), actor)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, overview)
}

func (h *Handler) createBranchHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var input application.CreateBranchInput
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	branch, err := h.createBranch.Execute(r.Context(), actor, input)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, branch)
}

func (h *Handler) createWorkLocationHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var input application.CreateWorkLocationInput
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	location, err := h.createWorkLocation.Execute(r.Context(), actor, input)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, location)
}

func (h *Handler) createOrgUnitHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var input application.CreateOrgUnitInput
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	unit, err := h.createOrgUnit.Execute(r.Context(), actor, input)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, unit)
}

func (h *Handler) createJobTitleHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var input application.CreateJobTitleInput
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	jobTitle, err := h.createJobTitle.Execute(r.Context(), actor, input)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, jobTitle)
}

func (h *Handler) createJobGradeHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var input application.CreateJobGradeInput
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	jobGrade, err := h.createJobGrade.Execute(r.Context(), actor, input)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, jobGrade)
}

func (h *Handler) createWorkScheduleHandler(w http.ResponseWriter, r *http.Request) {
	actor, err := auth.RequireActor(r.Context())
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	var input application.CreateWorkScheduleInput
	if err := httpx.DecodeJSON(w, r, &input, maxBodyBytes); err != nil {
		httpx.Error(w, r, err)
		return
	}
	schedule, err := h.createWorkSchedule.Execute(r.Context(), actor, input)
	if err != nil {
		httpx.Error(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, schedule)
}

// listQueryKeys is the closed set of accepted query parameters. An unknown parameter is a client
// fault, not something to ignore: a typo must not silently widen a search.
var listQueryKeys = map[string]struct{}{
	"q": {}, "status": {}, "branchId": {}, "orgUnitId": {}, "jobTitleId": {},
	"workLocationId": {}, "managerEmployeeId": {}, "limit": {}, "cursor": {},
}

func decodeListQuery(r *http.Request) (application.ListEmployeesInput, error) {
	query := r.URL.Query()
	for key := range query {
		if _, allowed := listQueryKeys[key]; !allowed {
			return application.ListEmployeesInput{}, problem.Validation("The request contains an unknown query parameter.", problem.Detail{
				Field: key, Code: "unknown_parameter", Message: "This parameter is not part of the contract.",
			})
		}
	}

	input := application.ListEmployeesInput{
		Query:             query.Get("q"),
		BranchID:          query.Get("branchId"),
		OrgUnitID:         query.Get("orgUnitId"),
		JobTitleID:        query.Get("jobTitleId"),
		WorkLocationID:    query.Get("workLocationId"),
		ManagerEmployeeID: query.Get("managerEmployeeId"),
		Cursor:            query.Get("cursor"),
	}

	if raw := strings.TrimSpace(query.Get("limit")); raw != "" {
		limit, err := strconv.Atoi(raw)
		if err != nil || limit < 1 || limit > 100 {
			return application.ListEmployeesInput{}, problem.Validation("The limit is not valid.", problem.Detail{
				Field: "limit", Code: "range", Message: "Must be an integer between 1 and 100.",
			})
		}
		input.Limit = limit
	}

	for _, raw := range query["status"] {
		for _, entry := range strings.Split(raw, ",") {
			entry = strings.TrimSpace(entry)
			if entry != "" {
				input.Statuses = append(input.Statuses, entry)
			}
		}
	}

	return input, nil
}
