// Package permissions owns the permission catalogue. The catalogue is data, not code, so the
// TypeScript client is generated from the same file and cannot drift (PRINCIPLE 5).
package permissions

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"sort"
)

//go:embed permissions.json
var catalogueJSON []byte

// Definition is one permission in the catalogue.
type Definition struct {
	Code        string `json:"code"`
	Description string `json:"description"`
}

type catalogue struct {
	Version     int          `json:"version"`
	Permissions []Definition `json:"permissions"`
}

var (
	all    []Definition
	byCode map[string]Definition
)

func init() {
	var parsed catalogue
	if err := json.Unmarshal(catalogueJSON, &parsed); err != nil {
		panic(fmt.Sprintf("permissions.json is invalid: %v", err))
	}
	byCode = make(map[string]Definition, len(parsed.Permissions))
	for _, definition := range parsed.Permissions {
		if definition.Code == "" {
			panic("permissions.json contains an empty code")
		}
		if _, exists := byCode[definition.Code]; exists {
			panic("permissions.json contains duplicate code " + definition.Code)
		}
		byCode[definition.Code] = definition
		all = append(all, definition)
	}
	sort.Slice(all, func(i, j int) bool { return all[i].Code < all[j].Code })
}

// All returns the catalogue in stable order.
func All() []Definition {
	out := make([]Definition, len(all))
	copy(out, all)
	return out
}

// Codes returns every permission code.
func Codes() []string {
	out := make([]string, 0, len(all))
	for _, definition := range all {
		out = append(out, definition.Code)
	}
	return out
}

// Valid reports whether a code is part of the catalogue. Any other value is a programming error
// in a role definition or an application registration, and is caught at start-up or in tests.
func Valid(code string) bool {
	_, ok := byCode[code]
	return ok
}

// Description returns the human description, or the code when unknown.
func Description(code string) string {
	if definition, ok := byCode[code]; ok {
		return definition.Description
	}
	return code
}

// Domain permission codes used by the platform.
const (
	HREmployeeRead          = "hr.employee.read"
	HREmployeeReadSensitive = "hr.employee.read.sensitive"
	HREmployeeCreate        = "hr.employee.create"
	HREmployeeUpdate        = "hr.employee.update"
	HREmployeeChangeStatus  = "hr.employee.change_status"
	HREmployeeExport        = "hr.employee.export"
	HROrganizationRead      = "hr.organization.read"
	HROrganizationManage    = "hr.organization.manage"
	HRAuditRead             = "hr.audit.read"
	PlatformAccountManage   = "platform.account.manage"
	PlatformIntegrationRetry = "platform.integration.retry"
)
