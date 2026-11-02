package auth

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/clock"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/ids"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

// SessionCookie is the single session cookie name. Changing it invalidates every active session,
// so it is a constant rather than configuration (SEC-009).
const SessionCookie = "h_os_session"

const (
	maxFailedAttempts = 5
	lockDuration      = 15 * time.Minute
	touchInterval     = time.Minute
)

// SessionSettings are the two lifetimes the session service enforces.
type SessionSettings struct {
	TTL         time.Duration
	IdleTimeout time.Duration
	Secure      bool
}

// IssuedSession is the result of a successful sign-in.
type IssuedSession struct {
	Token     string
	ExpiresAt time.Time
	Actor     Actor
}

// SessionService owns credential verification, session issuance, resolution and revocation.
//
// Sessions are server-side rows: the cookie carries an opaque random token and the database stores
// only its SHA-256 digest, so a leaked backup cannot be replayed as a credential. Authorization is
// rebuilt from the database on every request, which is what makes revocation immediate.
type SessionService struct {
	pool     *db.Pool
	hasher   PasswordHasher
	clock    clock.Clock
	settings SessionSettings
	logger   *slog.Logger
}

// NewSessionService wires the session service. Every dependency is explicit; there is no
// container and no hidden global (ARCH-005).
func NewSessionService(pool *db.Pool, hasher PasswordHasher, clk clock.Clock, settings SessionSettings, logger *slog.Logger) *SessionService {
	return &SessionService{pool: pool, hasher: hasher, clock: clk, settings: settings, logger: logger}
}

type accountRow struct {
	ID                 string
	OrganizationID     string
	Email              string
	DisplayName        string
	PasswordHash       string
	Locale             string
	Status             string
	FailedLoginAttempts int
	LockedUntil        *time.Time
}

// Authenticate verifies credentials and issues a session.
//
// Unknown accounts, wrong passwords and malformed hashes all produce the same error, and the
// unknown-account path performs the same key-derivation work so response time does not reveal
// whether the address exists (SEC-011).
func (s *SessionService) Authenticate(ctx context.Context, email, password string) (IssuedSession, error) {
	normalized := strings.ToLower(strings.TrimSpace(email))

	row, err := s.findAccountByEmail(ctx, normalized)
	if err != nil {
		if errors.Is(err, errNoAccount) {
			verifyDummy(s.hasher, password)
			return IssuedSession{}, problem.Unauthenticated("Email or password is incorrect.")
		}
		return IssuedSession{}, problem.Internal(err)
	}

	now := s.clock.Now()
	if row.LockedUntil != nil && row.LockedUntil.After(now) {
		// Identical wording to a wrong password: a lock is not an oracle for account existence
		// beyond what the attacker already had to guess.
		return IssuedSession{}, problem.Unauthenticated("Email or password is incorrect.")
	}

	active := row.Status == "active"
	if active {
		valid, verifyErr := s.hasher.Verify(row.PasswordHash, password)
		if verifyErr != nil {
			// A malformed hash is an operational fault, never a successful login.
			s.logger.Error("auth.hash_invalid", "accountId", row.ID)
			valid = false
		}
		if !valid {
			active = false
		}
	}

	if !active {
		if err := s.registerFailedAttempt(ctx, row.ID, now); err != nil {
			s.logger.Error("auth.failed_attempt_not_recorded", "accountId", row.ID, "cause", err)
		}
		return IssuedSession{}, problem.Unauthenticated("Email or password is incorrect.")
	}

	if _, err := s.pool.Exec(ctx, `
		update platform.account
		set failed_login_attempts = 0, locked_until = null, last_login_at = $2, updated_at = $2
		where id = $1`, row.ID, now); err != nil {
		return IssuedSession{}, problem.Internal(err)
	}

	return s.issue(ctx, row.ID, now)
}

// errNoAccount is a sentinel: "not found" must not be confused with "database failed".
var errNoAccount = errors.New("account not found")

func (s *SessionService) findAccountByEmail(ctx context.Context, email string) (accountRow, error) {
	var row accountRow
	err := s.pool.QueryRow(ctx, `
		select a.id::text, a.organization_id::text, a.email, a.display_name, a.password_hash,
		       a.locale, a.status, a.failed_login_attempts, a.locked_until
		from platform.account a
		where a.email = $1`, email).Scan(
		&row.ID, &row.OrganizationID, &row.Email, &row.DisplayName, &row.PasswordHash,
		&row.Locale, &row.Status, &row.FailedLoginAttempts, &row.LockedUntil,
	)
	if err != nil {
		if errors.Is(err, db.ErrNoRows) {
			return accountRow{}, errNoAccount
		}
		return accountRow{}, err
	}
	return row, nil
}

// registerFailedAttempt increments and locks in one statement: concurrent failures cannot lose
// counts and every racer sees the same threshold.
func (s *SessionService) registerFailedAttempt(ctx context.Context, accountID string, now time.Time) error {
	lockedUntil := now.Add(lockDuration)
	_, err := s.pool.Exec(ctx, `
		update platform.account
		set failed_login_attempts = failed_login_attempts + 1,
		    locked_until = case when failed_login_attempts + 1 >= $2 then $3 else null end,
		    updated_at = $4
		where id = $1`, accountID, maxFailedAttempts, lockedUntil, now)
	return err
}

func (s *SessionService) issue(ctx context.Context, accountID string, now time.Time) (IssuedSession, error) {
	token, err := newSessionToken()
	if err != nil {
		return IssuedSession{}, problem.Internal(err)
	}
	expiresAt := now.Add(s.settings.TTL)
	if _, err := s.pool.Exec(ctx, `
		insert into platform.session (id, account_id, token_hash, created_at, last_seen_at, expires_at)
		values ($1, $2, $3, $4, $4, $5)`,
		ids.New(), accountID, HashToken(token), now, expiresAt); err != nil {
		return IssuedSession{}, problem.Internal(err)
	}

	actor, err := s.Resolve(ctx, token)
	if err != nil {
		return IssuedSession{}, err
	}
	return IssuedSession{Token: token, ExpiresAt: expiresAt, Actor: actor}, nil
}

// Resolve maps a session token to an actor, enforcing expiry, revocation, idle timeout and account
// status. An invalid token is not an error: callers answer 401 uniformly.
func (s *SessionService) Resolve(ctx context.Context, token string) (Actor, error) {
	if token == "" {
		return Actor{}, problem.Unauthenticated("")
	}
	now := s.clock.Now()

	var sessionID, accountID string
	var lastSeen, expiresAt time.Time
	err := s.pool.QueryRow(ctx, `
		select s.id::text, s.account_id::text, s.last_seen_at, s.expires_at
		from platform.session s
		where s.token_hash = $1 and s.revoked_at is null and s.expires_at > $2`,
		HashToken(token), now).Scan(&sessionID, &accountID, &lastSeen, &expiresAt)
	if err != nil {
		if errors.Is(err, db.ErrNoRows) {
			return Actor{}, problem.Unauthenticated("Your session has expired. Sign in again.")
		}
		return Actor{}, problem.Internal(err)
	}

	if now.Sub(lastSeen) > s.settings.IdleTimeout {
		s.revokeByID(ctx, sessionID, now)
		return Actor{}, problem.Unauthenticated("Your session has expired. Sign in again.")
	}

	var (
		organizationID, email, displayName, locale, status string
	)
	err = s.pool.QueryRow(ctx, `
		select a.organization_id::text, a.email, a.display_name, a.locale, a.status
		from platform.account a where a.id = $1`, accountID).
		Scan(&organizationID, &email, &displayName, &locale, &status)
	if err != nil {
		if errors.Is(err, db.ErrNoRows) {
			s.revokeByID(ctx, sessionID, now)
			return Actor{}, problem.Unauthenticated("Your session has expired. Sign in again.")
		}
		return Actor{}, problem.Internal(err)
	}
	if status != "active" {
		s.revokeByID(ctx, sessionID, now)
		return Actor{}, problem.Unauthenticated("Your session has expired. Sign in again.")
	}

	roles, grants, err := s.loadAuthorization(ctx, accountID)
	if err != nil {
		return Actor{}, problem.Internal(err)
	}

	// Touching at most once a minute keeps a busy session alive without a write per request.
	if now.Sub(lastSeen) > touchInterval {
		if _, err := s.pool.Exec(ctx, `update platform.session set last_seen_at = $2 where id = $1`, sessionID, now); err != nil {
			s.logger.Warn("session.touch_failed", "sessionId", sessionID, "cause", err)
		}
	}

	if locale != "ar" {
		locale = "en"
	}

	return Actor{
		AccountID:      accountID,
		OrganizationID: organizationID,
		DisplayName:    displayName,
		Email:          email,
		Locale:         locale,
		Roles:          roles,
		Grants:         grants,
		SessionID:      sessionID,
	}, nil
}

func (s *SessionService) loadAuthorization(ctx context.Context, accountID string) ([]string, []Grant, error) {
	roleRows, err := s.pool.Query(ctx, `
		select r.code
		from platform.account_role ar
		join platform.role r on r.id = ar.role_id
		where ar.account_id = $1
		order by r.code`, accountID)
	if err != nil {
		return nil, nil, err
	}
	roles := make([]string, 0, 4)
	for roleRows.Next() {
		var code string
		if err := roleRows.Scan(&code); err != nil {
			roleRows.Close()
			return nil, nil, err
		}
		roles = append(roles, code)
	}
	roleRows.Close()
	if err := roleRows.Err(); err != nil {
		return nil, nil, err
	}

	grantRows, err := s.pool.Query(ctx, `
		select rp.permission_code, rp.scope
		from platform.account_role ar
		join platform.role_permission rp on rp.role_id = ar.role_id
		where ar.account_id = $1
		order by rp.permission_code, rp.scope`, accountID)
	if err != nil {
		return nil, nil, err
	}
	grants := make([]Grant, 0, 16)
	for grantRows.Next() {
		var grant Grant
		var scope string
		if err := grantRows.Scan(&grant.Permission, &scope); err != nil {
			grantRows.Close()
			return nil, nil, err
		}
		grant.Scope = Scope(scope)
		if !ValidScope(grant.Scope) {
			// An unknown scope is a data fault. Failing closed keeps it from widening access.
			s.logger.Error("rbac.unknown_scope", "permission", grant.Permission, "scope", scope)
			continue
		}
		grants = append(grants, grant)
	}
	grantRows.Close()
	if err := grantRows.Err(); err != nil {
		return nil, nil, err
	}
	return roles, grants, nil
}

// Revoke ends one session. An already-revoked or unknown token is a no-op: sign-out must always
// look successful to the client.
func (s *SessionService) Revoke(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	_, err := s.pool.Exec(ctx, `
		update platform.session set revoked_at = $2
		where token_hash = $1 and revoked_at is null`, HashToken(token), s.clock.Now())
	if err != nil {
		return problem.Internal(err)
	}
	return nil
}

func (s *SessionService) revokeByID(ctx context.Context, sessionID string, now time.Time) {
	if _, err := s.pool.Exec(ctx, `update platform.session set revoked_at = $2 where id = $1`, sessionID, now); err != nil {
		s.logger.Warn("session.revoke_failed", "sessionId", sessionID, "cause", err)
	}
}

// RevokeAllForAccount ends every live session of an account. Termination and organization changes
// call it so the next request is already unauthorized (SEC-014).
func (s *SessionService) RevokeAllForAccount(ctx context.Context, accountID, reason string) error {
	tag, err := s.pool.Exec(ctx, `
		update platform.session set revoked_at = $2
		where account_id = $1 and revoked_at is null`, accountID, s.clock.Now())
	if err != nil {
		return problem.Internal(err)
	}
	s.logger.Info("sessions.revoked", "accountId", accountID, "reason", reason, "count", tag.RowsAffected())
	return nil
}

// RevokeAllForAccountWithin performs the same sweep inside the caller's transaction, so a state
// change and the session revocation commit or fail together (LOG-006).
func (s *SessionService) RevokeAllForAccountWithin(ctx context.Context, q db.Querier, accountID string) error {
	_, err := q.Exec(ctx, `
		update platform.session set revoked_at = $2
		where account_id = $1 and revoked_at is null`, accountID, s.clock.Now())
	return err
}

// DisableAccount suspends the login and ends every session. Used by account management and by the
// employee lifecycle when an account must stop working immediately.
func (s *SessionService) DisableAccount(ctx context.Context, accountID string) error {
	if _, err := s.pool.Exec(ctx, `
		update platform.account set status = 'disabled', updated_at = $2 where id = $1`,
		accountID, s.clock.Now()); err != nil {
		return problem.Internal(err)
	}
	return s.RevokeAllForAccount(ctx, accountID, "account_disabled")
}

// CountActiveSessions reports live sessions; it is a diagnostic, not an authorization input.
func (s *SessionService) CountActiveSessions(ctx context.Context, accountID string) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx, `
		select count(*)::int from platform.session
		where account_id = $1 and revoked_at is null`, accountID).Scan(&count)
	if err != nil {
		return 0, problem.Internal(err)
	}
	return count, nil
}

// SetCookie delivers the session token. HttpOnly and SameSite=Lax keep it away from scripts and
// cross-site form posts; Secure is on wherever the deployment serves HTTPS.
func (s *SessionService) SetCookie(w http.ResponseWriter, token string, expiresAt time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookie,
		Value:    token,
		Path:     "/",
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   s.settings.Secure,
		SameSite: http.SameSiteLaxMode,
	})
}

// ClearCookie removes the cookie on sign-out.
func (s *SessionService) ClearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Secure:   s.settings.Secure,
		SameSite: http.SameSiteLaxMode,
	})
}

// TokenFromRequest reads the session cookie without trusting anything else in the header.
func TokenFromRequest(r *http.Request) string {
	cookie, err := r.Cookie(SessionCookie)
	if err != nil {
		return ""
	}
	return cookie.Value
}
