package accounts

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/audit"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/clock"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/ids"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/permissions"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

// ManagedAccount is the administrative view of a login account.
type ManagedAccount struct {
	AccountID   string   `json:"accountId"`
	Email       string   `json:"email"`
	DisplayName string   `json:"displayName"`
	Status      string   `json:"status"`
	Roles       []string `json:"roles"`
}

// CreateInput is the administrative creation payload.
type CreateInput struct {
	Email       string
	DisplayName string
	Password    string
	Locale      string
	Roles       []string
}

// Management is the minimum account administration surface.
//
// Invariants, each of which exists to prevent a specific failure:
//
//   - every operation requires `platform.account.manage` at organization-wide scope, because login
//     accounts, roles and grants have no per-unit meaning;
//   - every operation is confined to the caller's organization;
//   - the caller can never change their own roles, status or lock state, so the last administrator
//     cannot lock themselves out or escalate their own privilege;
//   - audit rows carry emails, display names and role codes only — never password material.
type Management struct {
	pool     *db.Pool
	hasher   auth.PasswordHasher
	sessions *auth.SessionService
	audit    *audit.Recorder
	clock    clock.Clock
}

// NewManagement wires the administrative surface with explicit dependencies.
func NewManagement(pool *db.Pool, hasher auth.PasswordHasher, sessions *auth.SessionService, recorder *audit.Recorder, clk clock.Clock) *Management {
	return &Management{pool: pool, hasher: hasher, sessions: sessions, audit: recorder, clock: clk}
}

func assertAdministration(actor auth.Actor) error {
	scope, granted := actor.ScopeFor(permissions.PlatformAccountManage)
	if !granted || scope != auth.ScopeAll {
		return problem.Forbidden("Login-account administration requires organization-wide permission.")
	}
	return nil
}

func assertNotSelf(actor auth.Actor, accountID string) error {
	if actor.AccountID == accountID {
		return problem.Forbidden("You cannot administer your own login account.")
	}
	return nil
}

// List returns the login accounts of the caller's organization with their role codes.
func (m *Management) List(ctx context.Context, actor auth.Actor) ([]ManagedAccount, error) {
	if err := assertAdministration(actor); err != nil {
		return nil, err
	}
	rows, err := m.pool.Query(ctx, `
		select a.id::text, a.email, a.display_name, a.status, r.code
		from platform.account a
		left join platform.account_role ar on ar.account_id = a.id
		left join platform.role r on r.id = ar.role_id
		where a.organization_id = $1
		order by a.email, r.code`, actor.OrganizationID)
	if err != nil {
		return nil, problem.Internal(err)
	}
	defer rows.Close()

	out := make([]ManagedAccount, 0, 8)
	index := make(map[string]int, 8)
	for rows.Next() {
		var (
			id, email, displayName, status string
			roleCode                       *string
		)
		if err := rows.Scan(&id, &email, &displayName, &status, &roleCode); err != nil {
			return nil, problem.Internal(err)
		}
		position, seen := index[id]
		if !seen {
			out = append(out, ManagedAccount{AccountID: id, Email: email, DisplayName: displayName, Status: status, Roles: []string{}})
			position = len(out) - 1
			index[id] = position
		}
		if roleCode != nil {
			out[position].Roles = append(out[position].Roles, *roleCode)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, problem.Internal(err)
	}
	return out, nil
}

// Create adds a login account and its roles atomically.
func (m *Management) Create(ctx context.Context, actor auth.Actor, input CreateInput) (string, error) {
	if err := assertAdministration(actor); err != nil {
		return "", err
	}
	email := strings.ToLower(strings.TrimSpace(input.Email))
	displayName := strings.TrimSpace(input.DisplayName)
	passwordHash, err := m.hasher.Hash(input.Password)
	if err != nil {
		return "", problem.Internal(err)
	}
	accountID := ids.New()
	locale := input.Locale
	if locale != "ar" {
		locale = "en"
	}

	err = m.pool.InTx(ctx, func(tx db.Tx) error {
		if _, err := tx.Exec(ctx, `
			insert into platform.account
				(id, organization_id, email, display_name, password_hash, locale, status, created_at, updated_at)
			values ($1, $2, $3, $4, $5, $6, 'active', $7, $7)`,
			accountID, actor.OrganizationID, email, displayName, passwordHash, locale, m.clock.Now()); err != nil {
			return err
		}

		granted := make([]string, 0, len(input.Roles))
		for _, roleCode := range input.Roles {
			var roleID string
			if err := tx.QueryRow(ctx, `
				select id::text from platform.role
				where organization_id = $1 and code = $2`,
				actor.OrganizationID, roleCode).Scan(&roleID); err != nil {
				if errors.Is(err, db.ErrNoRows) {
					return problem.NotFound("The role '" + roleCode + "' does not exist in this organization.")
				}
				return err
			}
			if _, err := tx.Exec(ctx, `
				insert into platform.account_role (account_id, role_id, granted_at)
				values ($1, $2, $3) on conflict do nothing`, accountID, roleID, m.clock.Now()); err != nil {
				return err
			}
			granted = append(granted, roleCode)
		}

		return m.audit.Record(ctx, tx, &actor, actor.OrganizationID, audit.Input{
			Action:  "platform.account.created",
			Subject: audit.Subject{App: "platform", Type: "account", ID: accountID},
			After:   audit.Snapshot{"email": email, "displayName": displayName, "status": "active", "roles": granted},
		})
	})
	if err != nil {
		if isUniqueViolation(err) {
			// The unique index is the authority; a concurrent create of the same address is still a
			// conflict, never a leaked constraint error.
			return "", problem.Conflict("An account already exists for this email address.")
		}
		return "", err
	}
	return accountID, nil
}

// AssignRole grants a role.
func (m *Management) AssignRole(ctx context.Context, actor auth.Actor, accountID, roleCode string) error {
	if err := assertAdministration(actor); err != nil {
		return err
	}
	return m.changeRole(ctx, actor, accountID, roleCode, "platform.account.role_assigned", true)
}

// RevokeRole removes a role.
func (m *Management) RevokeRole(ctx context.Context, actor auth.Actor, accountID, roleCode string) error {
	if err := assertAdministration(actor); err != nil {
		return err
	}
	return m.changeRole(ctx, actor, accountID, roleCode, "platform.account.role_revoked", false)
}

// Disable stops the account from signing in and ends its sessions in the same transaction.
func (m *Management) Disable(ctx context.Context, actor auth.Actor, accountID string) error {
	if err := assertAdministration(actor); err != nil {
		return err
	}
	if err := assertNotSelf(actor, accountID); err != nil {
		return err
	}
	targetStatus, err := m.loadTargetStatus(ctx, actor, accountID)
	if err != nil {
		return err
	}

	return m.pool.InTx(ctx, func(tx db.Tx) error {
		if _, err := tx.Exec(ctx, `
			update platform.account set status = 'disabled', updated_at = $3
			where id = $1 and organization_id = $2`, accountID, actor.OrganizationID, m.clock.Now()); err != nil {
			return err
		}
		if err := m.sessions.RevokeAllForAccountWithin(ctx, tx, accountID); err != nil {
			return err
		}
		return m.audit.Record(ctx, tx, &actor, actor.OrganizationID, audit.Input{
			Action:  "platform.account.disabled",
			Subject: audit.Subject{App: "platform", Type: "account", ID: accountID},
			Before:  audit.Snapshot{"status": targetStatus},
			After:   audit.Snapshot{"status": "disabled"},
		})
	})
}

func (m *Management) changeRole(ctx context.Context, actor auth.Actor, accountID, roleCode, action string, grant bool) error {
	if err := assertNotSelf(actor, accountID); err != nil {
		return err
	}
	if _, err := m.loadTargetStatus(ctx, actor, accountID); err != nil {
		return err
	}

	return m.pool.InTx(ctx, func(tx db.Tx) error {
		var roleID string
		if err := tx.QueryRow(ctx, `
			select id::text from platform.role
			where organization_id = $1 and code = $2`,
			actor.OrganizationID, roleCode).Scan(&roleID); err != nil {
			if errors.Is(err, db.ErrNoRows) {
				return problem.NotFound("The role '" + roleCode + "' does not exist in this organization.")
			}
			return err
		}

		before, err := m.rolesOf(ctx, tx, accountID)
		if err != nil {
			return err
		}
		if grant {
			if _, err := tx.Exec(ctx, `
				insert into platform.account_role (account_id, role_id, granted_at)
				values ($1, $2, $3) on conflict do nothing`, accountID, roleID, m.clock.Now()); err != nil {
				return err
			}
		} else {
			if _, err := tx.Exec(ctx, `
				delete from platform.account_role where account_id = $1 and role_id = $2`,
				accountID, roleID); err != nil {
				return err
			}
		}
		after, err := m.rolesOf(ctx, tx, accountID)
		if err != nil {
			return err
		}

		return m.audit.Record(ctx, tx, &actor, actor.OrganizationID, audit.Input{
			Action:  action,
			Subject: audit.Subject{App: "platform", Type: "account", ID: accountID},
			Before:  audit.Snapshot{"roles": before},
			After:   audit.Snapshot{"roleCode": roleCode, "roles": after},
		})
	})
}

func (m *Management) loadTargetStatus(ctx context.Context, actor auth.Actor, accountID string) (string, error) {
	var organizationID, status string
	err := m.pool.QueryRow(ctx, `
		select organization_id::text, status from platform.account where id = $1`, accountID).
		Scan(&organizationID, &status)
	if err != nil {
		if errors.Is(err, db.ErrNoRows) {
			return "", problem.NotFound("The login account does not exist.")
		}
		return "", problem.Internal(err)
	}
	if organizationID != actor.OrganizationID {
		// Cross-organization probing must not be distinguishable from a missing record.
		return "", problem.NotFound("The login account does not exist.")
	}
	return status, nil
}

func (m *Management) rolesOf(ctx context.Context, q db.Querier, accountID string) ([]string, error) {
	rows, err := q.Query(ctx, `
		select r.code from platform.account_role ar
		join platform.role r on r.id = ar.role_id
		where ar.account_id = $1 order by r.code`, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	roles := make([]string, 0, 4)
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			return nil, err
		}
		roles = append(roles, code)
	}
	return roles, rows.Err()
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
