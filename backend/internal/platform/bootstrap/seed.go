package bootstrap

import (
	"context"
	"fmt"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/config"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/ids"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/permissions"
)

// RoleDefinition defines a role and its permission grants.
type RoleDefinition struct {
	Code   string
	NameEn string
	NameAr string
	Grants []auth.Grant
}

// DefaultRoles provides standard least-privilege starting roles.
func DefaultRoles() []RoleDefinition {
	// hr_admin gets all permissions in the catalogue with scope 'all'
	hrAdminGrants := make([]auth.Grant, 0)
	for _, p := range permissions.All() {
		hrAdminGrants = append(hrAdminGrants, auth.Grant{
			Permission: p.Code,
			Scope:      auth.ScopeAll,
		})
	}

	return []RoleDefinition{
		{
			Code:   "hr_admin",
			NameEn: "HR administrator",
			NameAr: "مدير الموارد البشرية",
			Grants: hrAdminGrants,
		},
		{
			Code:   "hr_officer",
			NameEn: "HR officer",
			NameAr: "أخصائي موارد بشرية",
			Grants: []auth.Grant{
				{Permission: "hr.employee.read", Scope: auth.ScopeSubtree},
				{Permission: "hr.employee.read.sensitive", Scope: auth.ScopeSubtree},
				{Permission: "hr.employee.create", Scope: auth.ScopeSubtree},
				{Permission: "hr.employee.update", Scope: auth.ScopeSubtree},
				{Permission: "hr.employee.change_status", Scope: auth.ScopeSubtree},
				{Permission: "hr.organization.read", Scope: auth.ScopeAll},
				{Permission: "hr.organization.manage", Scope: auth.ScopeSubtree},
				{Permission: "hr.audit.read", Scope: auth.ScopeSubtree},
				{Permission: "app.hr.access", Scope: auth.ScopeAll},
			},
		},
		{
			Code:   "manager",
			NameEn: "Manager",
			NameAr: "مدير",
			Grants: []auth.Grant{
				{Permission: "hr.employee.read", Scope: auth.ScopeSubtree},
				{Permission: "hr.organization.read", Scope: auth.ScopeAll},
				{Permission: "app.hr.access", Scope: auth.ScopeAll},
			},
		},
		{
			Code:   "employee",
			NameEn: "Employee",
			NameAr: "موظف",
			Grants: []auth.Grant{
				{Permission: "hr.employee.read", Scope: auth.ScopeOwn},
				{Permission: "hr.organization.read", Scope: auth.ScopeAll},
				{Permission: "app.hr.access", Scope: auth.ScopeAll},
			},
		},
		{
			Code:   "auditor",
			NameEn: "Auditor",
			NameAr: "مدقق",
			Grants: []auth.Grant{
				{Permission: "hr.employee.read", Scope: auth.ScopeAll},
				{Permission: "hr.audit.read", Scope: auth.ScopeAll},
				{Permission: "hr.organization.read", Scope: auth.ScopeAll},
				{Permission: "app.hr.access", Scope: auth.ScopeAll},
			},
		},
	}
}

// SeedResult holds the identifiers created by seeding.
type SeedResult struct {
	OrganizationID string `json:"organizationId"`
	AdminAccountID string `json:"adminAccountId"`
	Permissions    int    `json:"permissions"`
	Roles          int    `json:"roles"`
}

// Seed executes the idempotent database bootstrap.
func Seed(ctx context.Context, pool *db.Pool, cfg *config.Config, hasher auth.PasswordHasher) (*SeedResult, error) {
	passwordHash, err := hasher.Hash(cfg.BootstrapAdmin.Password)
	if err != nil {
		return nil, fmt.Errorf("hash admin password: %w", err)
	}

	var res SeedResult
	err = pool.InTx(ctx, func(tx db.Tx) error {
		// 1. Provision organization
		var orgID string
		err := tx.QueryRow(ctx, `
			insert into platform.organization (id, code, name_en, name_ar, time_zone)
			values ($1, $2, $3, $4, $5)
			on conflict (code) do update
				set name_en = excluded.name_en,
					name_ar = excluded.name_ar,
					time_zone = excluded.time_zone,
					updated_at = now()
			returning id::text
		`, ids.New(), cfg.Organization.Code, cfg.Organization.NameEn, cfg.Organization.NameAr, cfg.Organization.TimeZone).Scan(&orgID)
		if err != nil {
			return fmt.Errorf("upsert organization: %w", err)
		}
		res.OrganizationID = orgID

		// 2. Provision permissions
		allPerms := permissions.All()
		for _, p := range allPerms {
			_, err := tx.Exec(ctx, `
				insert into platform.permission (code, description)
				values ($1, $2)
				on conflict (code) do update set description = excluded.description
			`, p.Code, p.Description)
			if err != nil {
				return fmt.Errorf("upsert permission %s: %w", p.Code, err)
			}
		}
		res.Permissions = len(allPerms)

		// 3. Provision roles and role permissions
		roles := DefaultRoles()
		roleMap := make(map[string]string)
		for _, r := range roles {
			var roleID string
			err := tx.QueryRow(ctx, `
				insert into platform.role (id, organization_id, code, name_en, name_ar, is_system)
				values ($1, $2, $3, $4, $5, true)
				on conflict (organization_id, code) do update
					set name_en = excluded.name_en,
						name_ar = excluded.name_ar,
						is_system = true
				returning id::text
			`, ids.New(), orgID, r.Code, r.NameEn, r.NameAr).Scan(&roleID)
			if err != nil {
				return fmt.Errorf("upsert role %s: %w", r.Code, err)
			}
			roleMap[r.Code] = roleID

			_, err = tx.Exec(ctx, `delete from platform.role_permission where role_id = $1`, roleID)
			if err != nil {
				return fmt.Errorf("clear role permissions for %s: %w", r.Code, err)
			}

			for _, g := range r.Grants {
				_, err = tx.Exec(ctx, `
					insert into platform.role_permission (role_id, permission_code, scope)
					values ($1, $2, $3)
					on conflict (role_id, permission_code) do update set scope = excluded.scope
				`, roleID, g.Permission, string(g.Scope))
				if err != nil {
					return fmt.Errorf("grant %s to role %s: %w", g.Permission, r.Code, err)
				}
			}
		}
		res.Roles = len(roles)

		// 4. Provision admin account
		adminEmail := cfg.BootstrapAdmin.Email
		var accountID string
		var existingOrgID string
		row := tx.QueryRow(ctx, `select id::text, organization_id::text from platform.account where email = $1`, adminEmail)
		err = row.Scan(&accountID, &existingOrgID)
		if err == nil {
			if existingOrgID != orgID {
				return fmt.Errorf("admin email %s already belongs to a different organization", adminEmail)
			}
		} else if err == db.ErrNoRows {
			accountID = ids.New()
			_, err = tx.Exec(ctx, `
				insert into platform.account (id, organization_id, email, display_name, password_hash, locale, status)
				values ($1, $2, $3, $4, $5, 'en', 'active')
			`, accountID, orgID, adminEmail, "Platform administrator", passwordHash)
			if err != nil {
				return fmt.Errorf("create admin account: %w", err)
			}
		} else {
			return fmt.Errorf("check admin account: %w", err)
		}
		res.AdminAccountID = accountID

		// 5. Assign hr_admin role to admin account
		hrAdminRoleID := roleMap["hr_admin"]
		_, err = tx.Exec(ctx, `
			insert into platform.account_role (account_id, role_id)
			values ($1, $2)
			on conflict (account_id, role_id) do nothing
		`, accountID, hrAdminRoleID)
		if err != nil {
			return fmt.Errorf("assign admin role: %w", err)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}
	return &res, nil
}
