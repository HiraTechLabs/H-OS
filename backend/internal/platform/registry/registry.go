// Package registry is the single authoritative definition of the H-OS product surface.
//
// The eight official applications, their identities, routes, icons, availability and access
// permissions live here and nowhere else. The launcher, the shell navigation, the client route
// table and the server-side access check all read this one registry, so they cannot drift apart:
// an application that the launcher shows is an application the shell can route to and the API
// will authorize, because it is the same record.
//
// The registry is code, not a database table. It describes what the product *is*; the database
// describes who may use it. Adding an application is a reviewed code change that passes the
// validation in Validate, never an ad-hoc row.
package registry

import (
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/permissions"
)

// Availability is the honest state of an application in this build.
type Availability string

const (
	// Available means the application is implemented and can be opened.
	Available Availability = "available"
	// UnderDevelopment means the application is part of the product but its screens are not
	// implemented yet. It is still listed, because hiding it would misrepresent the product.
	UnderDevelopment Availability = "under_development"
	// Disabled means the application is deliberately switched off for everybody.
	Disabled Availability = "disabled"
)

// LocalizedText is a label in both supported languages. Both halves are mandatory: a missing
// translation is a validation failure, not an empty string at runtime (UX-002).
type LocalizedText struct {
	En string `json:"en"`
	Ar string `json:"ar"`
}

// NavItem is one destination inside an application.
type NavItem struct {
	Path       string        `json:"path"`
	Label      LocalizedText `json:"label"`
	Permission string        `json:"permission"`
}

// Definition is one official application.
type Definition struct {
	// ID is the stable machine identity. It never changes and never appears in the UI.
	ID string `json:"id"`
	// Name is the official product name, preserved exactly as the owner wrote it.
	Name string `json:"name"`
	// DisplayName is the localized, human-readable name shown next to the official one.
	DisplayName LocalizedText `json:"displayName"`
	// Description explains the application's purpose in one sentence.
	Description LocalizedText `json:"description"`
	// Icon is a semantic icon key resolved by the design system, never a file path.
	Icon string `json:"icon"`
	// Route is the deep-linkable path of the application inside the single web shell.
	Route string `json:"route"`
	// Permission gates access. It must exist in the permission catalogue.
	Permission string `json:"permission"`
	// Module names the backend module that owns the application's behaviour.
	Module string `json:"module"`
	// Availability is the honest state of this build. It is returned to the client so the launcher
	// can say "under development" instead of pretending the screen exists.
	Availability Availability `json:"availability"`
	// Order is the launcher position. It is explicit so the order is not alphabetical by accident.
	Order int `json:"order"`
	// Navigation lists the application's screens.
	Navigation []NavItem `json:"navigation"`
}

// Applications is the complete, ordered list of official applications.
//
// The eight names and their order are fixed by the owner. Do not rename, merge, remove or add an
// application without an explicit product decision: the launcher, the routes and the audit trail
// all refer to these identities.
var Applications = []Definition{
	{
		ID:          "archive",
		Name:        "H-Archive",
		DisplayName: LocalizedText{En: "Archive", Ar: "الأرشيف"},
		Description: LocalizedText{En: "Corporate records, retention and document lifecycle.", Ar: "سجلات المؤسسة والاحتفاظ بالمستندات ودورة حياتها."},
		Icon:        "archive",
		Route:       "/apps/archive",
		Permission:  "app.archive.access",
		Module:      "internal/apps/archive",
		Availability: UnderDevelopment,
		Order:       10,
	},
	{
		ID:          "finance",
		Name:        "H-Finance",
		DisplayName: LocalizedText{En: "Finance", Ar: "المالية"},
		Description: LocalizedText{En: "Ledgers, budgets and financial reporting.", Ar: "الدفاتر والميزانيات والتقارير المالية."},
		Icon:        "finance",
		Route:       "/apps/finance",
		Permission:  "app.finance.access",
		Module:      "internal/apps/finance",
		Availability: UnderDevelopment,
		Order:       20,
	},
	{
		ID:          "sales",
		Name:        "H-SALES",
		DisplayName: LocalizedText{En: "Sales", Ar: "المبيعات"},
		Description: LocalizedText{En: "Opportunities, quotations and the sales pipeline.", Ar: "الفرص وعروض الأسعار ومسار المبيعات."},
		Icon:        "sales",
		Route:       "/apps/sales",
		Permission:  "app.sales.access",
		Module:      "internal/apps/sales",
		Availability: UnderDevelopment,
		Order:       30,
	},
	{
		ID:          "inventory",
		Name:        "H-Inventory",
		DisplayName: LocalizedText{En: "Inventory", Ar: "المخزون"},
		Description: LocalizedText{En: "Stock levels, movements and reorder control.", Ar: "مستويات المخزون والحركات وحدود إعادة الطلب."},
		Icon:        "inventory",
		Route:       "/apps/inventory",
		Permission:  "app.inventory.access",
		Module:      "internal/apps/inventory",
		Availability: UnderDevelopment,
		Order:       40,
	},
	{
		ID:          "rooms",
		Name:        "H-ROOMS",
		DisplayName: LocalizedText{En: "Rooms", Ar: "الغرف"},
		Description: LocalizedText{En: "Room inventory, bookings and occupancy.", Ar: "مخزون الغرف والحجوزات والإشغال."},
		Icon:        "rooms",
		Route:       "/apps/rooms",
		Permission:  "app.rooms.access",
		Module:      "internal/apps/rooms",
		Availability: UnderDevelopment,
		Order:       50,
	},
	{
		ID:          "hr",
		Name:        "H-HR",
		DisplayName: LocalizedText{En: "Human Resources", Ar: "الموارد البشرية"},
		Description: LocalizedText{En: "People records, organization structure and employment history.", Ar: "سجلات الموظفين والهيكل التنظيمي والتاريخ الوظيفي."},
		Icon:        "hr",
		Route:       "/apps/hr",
		Permission:  "app.hr.access",
		Module:      "internal/apps/hr",
		Availability: Available,
		Order:       60,
		Navigation: []NavItem{
			{Path: "/apps/hr", Label: LocalizedText{En: "Overview", Ar: "نظرة عامة"}, Permission: "app.hr.access"},
			{Path: "/apps/hr/employees", Label: LocalizedText{En: "Employees", Ar: "الموظفون"}, Permission: permissions.HREmployeeRead},
			{Path: "/apps/hr/organization", Label: LocalizedText{En: "Organization", Ar: "الهيكل التنظيمي"}, Permission: permissions.HROrganizationRead},
		},
	},
	{
		ID:          "camera",
		Name:        "H-CAMERA",
		DisplayName: LocalizedText{En: "Camera", Ar: "الكاميرات"},
		Description: LocalizedText{En: "Site cameras, live views and recorded events.", Ar: "كاميرات المواقع والبث المباشر والأحداث المسجلة."},
		Icon:        "camera",
		Route:       "/apps/camera",
		Permission:  "app.camera.access",
		Module:      "internal/apps/camera",
		Availability: UnderDevelopment,
		Order:       70,
	},
	{
		ID:          "assets",
		Name:        "H-ASSETS",
		DisplayName: LocalizedText{En: "Assets", Ar: "الأصول"},
		Description: LocalizedText{En: "Asset register, assignment and maintenance.", Ar: "سجل الأصول والإسناد والصيانة."},
		Icon:        "assets",
		Route:       "/apps/assets",
		Permission:  "app.assets.access",
		Module:      "internal/apps/assets",
		Availability: UnderDevelopment,
		Order:       80,
	},
}

// routePattern keeps routes deep-linkable and shell-relative: lowercase segments, no trailing
// slash, no query, no fragment. A route that fails this cannot be expressed by the web router.
var routePattern = regexp.MustCompile(`^(/[a-z0-9][a-z0-9-]*){2,}$`)

// idPattern keeps the identity usable as a permission segment and a URL segment.
var idPattern = regexp.MustCompile(`^[a-z][a-z0-9-]{1,31}$`)

// byID indexes the registry once. A duplicate ID is impossible after Validate; the index is built
// from the validated slice so a lookup and a listing can never disagree.
var byID = func() map[string]Definition {
	index := make(map[string]Definition, len(Applications))
	for _, application := range Applications {
		index[application.ID] = application
	}
	return index
}()

// All returns the registry in launcher order.
func All() []Definition {
	out := make([]Definition, len(Applications))
	copy(out, Applications)
	sort.SliceStable(out, func(i, j int) bool { return out[i].Order < out[j].Order })
	return out
}

// ByID resolves one application. The boolean reports whether the identity is official.
func ByID(id string) (Definition, bool) {
	application, ok := byID[id]
	return application, ok
}

// Visible returns the applications the caller may see, in launcher order.
//
// A registered application the caller has no permission for is omitted entirely: the launcher must
// not advertise a destination that would answer 403. Availability is preserved so the client can
// render "under development" honestly instead of pretending the screen exists.
func Visible(actor auth.Actor) []Definition {
	out := make([]Definition, 0, len(Applications))
	for _, application := range All() {
		if application.Availability == Disabled {
			continue
		}
		if !actor.Can(application.Permission) {
			continue
		}
		out = append(out, application)
	}
	return out
}

// Validate checks the registry's internal consistency. It runs at start-up and in tests: a
// malformed registry must stop the process, because every screen and every authorization decision
// depends on it.
func Validate() error {
	var issues []string

	seenIDs := make(map[string]struct{}, len(Applications))
	seenRoutes := make(map[string]struct{}, len(Applications))
	seenOrders := make(map[int]struct{}, len(Applications))
	seenNames := make(map[string]struct{}, len(Applications))

	for _, application := range Applications {
		label := application.ID
		if label == "" {
			issues = append(issues, "an application has an empty id")
			continue
		}
		if !idPattern.MatchString(application.ID) {
			issues = append(issues, fmt.Sprintf("%s: id must match %s", label, idPattern))
		}
		if _, duplicate := seenIDs[application.ID]; duplicate {
			issues = append(issues, fmt.Sprintf("%s: duplicate application id", label))
		}
		seenIDs[application.ID] = struct{}{}

		if strings.TrimSpace(application.Name) == "" {
			issues = append(issues, fmt.Sprintf("%s: official name is required", label))
		} else {
			if _, duplicate := seenNames[application.Name]; duplicate {
				issues = append(issues, fmt.Sprintf("%s: duplicate official name %q", label, application.Name))
			}
			seenNames[application.Name] = struct{}{}
		}

		if strings.TrimSpace(application.DisplayName.En) == "" || strings.TrimSpace(application.DisplayName.Ar) == "" {
			issues = append(issues, fmt.Sprintf("%s: display name must be present in English and Arabic", label))
		}
		if strings.TrimSpace(application.Description.En) == "" || strings.TrimSpace(application.Description.Ar) == "" {
			issues = append(issues, fmt.Sprintf("%s: description must be present in English and Arabic", label))
		}
		if strings.TrimSpace(application.Icon) == "" {
			issues = append(issues, fmt.Sprintf("%s: icon is required", label))
		}
		if strings.TrimSpace(application.Module) == "" {
			issues = append(issues, fmt.Sprintf("%s: owning module is required", label))
		}

		if !routePattern.MatchString(application.Route) {
			issues = append(issues, fmt.Sprintf("%s: route %q must be an absolute, lowercase, multi-segment path", label, application.Route))
		}
		if _, duplicate := seenRoutes[application.Route]; duplicate {
			issues = append(issues, fmt.Sprintf("%s: duplicate route %q", label, application.Route))
		}
		seenRoutes[application.Route] = struct{}{}

		if application.Order <= 0 {
			issues = append(issues, fmt.Sprintf("%s: order must be positive", label))
		}
		if _, duplicate := seenOrders[application.Order]; duplicate {
			issues = append(issues, fmt.Sprintf("%s: duplicate order %d", label, application.Order))
		}
		seenOrders[application.Order] = struct{}{}

		switch application.Availability {
		case Available, UnderDevelopment, Disabled:
		default:
			issues = append(issues, fmt.Sprintf("%s: availability %q is not one of available, under_development, disabled", label, application.Availability))
		}

		if application.Permission == "" {
			issues = append(issues, fmt.Sprintf("%s: access permission is required", label))
		} else {
			if !permissions.Valid(application.Permission) {
				issues = append(issues, fmt.Sprintf("%s: access permission %q is not in the catalogue", label, application.Permission))
			}
			expected := "app." + application.ID + ".access"
			if application.Permission != expected {
				issues = append(issues, fmt.Sprintf("%s: access permission must be %q, found %q", label, expected, application.Permission))
			}
		}

		seenPaths := make(map[string]struct{}, len(application.Navigation))
		for _, item := range application.Navigation {
			if !strings.HasPrefix(item.Path, application.Route) {
				issues = append(issues, fmt.Sprintf("%s: navigation path %q must live under %q", label, item.Path, application.Route))
			}
			if _, duplicate := seenPaths[item.Path]; duplicate {
				issues = append(issues, fmt.Sprintf("%s: duplicate navigation path %q", label, item.Path))
			}
			seenPaths[item.Path] = struct{}{}
			if strings.TrimSpace(item.Label.En) == "" || strings.TrimSpace(item.Label.Ar) == "" {
				issues = append(issues, fmt.Sprintf("%s: navigation item %q must be labelled in English and Arabic", label, item.Path))
			}
			if !permissions.Valid(item.Permission) {
				issues = append(issues, fmt.Sprintf("%s: navigation item %q requires unknown permission %q", label, item.Path, item.Permission))
			}
		}
	}

	if len(issues) > 0 {
		return fmt.Errorf("application registry is invalid:\n  %s", strings.Join(issues, "\n  "))
	}
	return nil
}
