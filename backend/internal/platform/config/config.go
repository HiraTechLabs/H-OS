// Package config loads and validates every runtime setting from the environment.
//
// Configuration is validated before any listener or database pool is opened, and the process
// fails fast with the complete list of problems (STK-003). No setting has a silent default that
// would make a misconfigured production deployment look healthy.
package config

import (
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Environment names are stable: deployments set exactly these variables.
const (
	EnvName              = "APP_ENV"
	PortName             = "PORT"
	APIBaseURLName       = "API_BASE_URL"
	DatabaseURLName      = "DATABASE_URL"
	CORSOriginsName      = "CORS_ORIGINS"
	SessionSecretName    = "SESSION_SECRET"
	SessionTTLName       = "SESSION_TTL_MINUTES"
	SessionIdleName      = "SESSION_IDLE_TIMEOUT_MINUTES"
	LoginRateLimitName   = "LOGIN_RATE_LIMIT"
	LogLevelName         = "LOG_LEVEL"
	BootstrapEmailName   = "BOOTSTRAP_ADMIN_EMAIL"
	BootstrapPasswordName = "BOOTSTRAP_ADMIN_PASSWORD"
	OrganizationCodeName = "ORGANIZATION_CODE"
	OrganizationNameENName = "ORGANIZATION_NAME_EN"
	OrganizationNameARName = "ORGANIZATION_NAME_AR"
	OrganizationTZName   = "ORGANIZATION_TIMEZONE"
	FieldEncryptionKeyName = "FIELD_ENCRYPTION_KEY"
)

// Environment is one of the three supported deployment profiles.
type Environment string

const (
	Development Environment = "development"
	Test        Environment = "test"
	Production  Environment = "production"
)

// Organization is the single organization provisioned by the bootstrap seeder.
type Organization struct {
	Code    string
	NameEn  string
	NameAr  string
	TimeZone string
}

// BootstrapAdmin is the first administrator account. The password is only used on creation.
type BootstrapAdmin struct {
	Email    string
	Password string
}

// Config is immutable after Load returns.
type Config struct {
	Env                  Environment
	Port                 int
	APIBaseURL           string
	DatabaseURL          string
	CORSOrigins          []string
	SessionSecret        string
	SessionTTL           time.Duration
	SessionIdleTimeout   time.Duration
	LoginRateLimit       int
	LogLevel             string
	BootstrapAdmin       BootstrapAdmin
	Organization         Organization
	FieldEncryptionKey   []byte
}

// ConfigurationError reports every invalid value at once so a deployment can be fixed in one pass.
type ConfigurationError struct {
	Issues []string
}

func (e *ConfigurationError) Error() string {
	return "invalid configuration:\n  " + strings.Join(e.Issues, "\n  ")
}

// Load reads the environment through getenv. Tests pass a map-backed lookup instead of touching
// the process environment.
func Load(getenv func(string) string) (Config, error) {
	var issues []string

	env := Environment(strings.TrimSpace(getenv(EnvName)))
	if env == "" {
		env = Development
	}
	switch env {
	case Development, Test, Production:
	default:
		issues = append(issues, fmt.Sprintf("%s: must be development, test or production", EnvName))
	}

	port := 3000
	if raw := strings.TrimSpace(getenv(PortName)); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > 65535 {
			issues = append(issues, fmt.Sprintf("%s: must be an integer between 1 and 65535", PortName))
		} else {
			port = parsed
		}
	}

	apiBaseURL := strings.TrimSpace(getenv(APIBaseURLName))
	if apiBaseURL == "" {
		issues = append(issues, fmt.Sprintf("%s: is required", APIBaseURLName))
	} else if parsed, err := url.Parse(apiBaseURL); err != nil || parsed.Scheme == "" || parsed.Host == "" {
		issues = append(issues, fmt.Sprintf("%s: must be an absolute URL", APIBaseURLName))
	}

	databaseURL := strings.TrimSpace(getenv(DatabaseURLName))
	if databaseURL == "" {
		issues = append(issues, fmt.Sprintf("%s: is required", DatabaseURLName))
	} else if parsed, err := url.Parse(databaseURL); err != nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") {
		issues = append(issues, fmt.Sprintf("%s: must be a postgres:// URL", DatabaseURLName))
	}

	var corsOrigins []string
	for _, entry := range strings.Split(getenv(CORSOriginsName), ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		if parsed, err := url.Parse(entry); err != nil || parsed.Scheme == "" || parsed.Host == "" {
			issues = append(issues, fmt.Sprintf("%s: %q is not an absolute origin", CORSOriginsName, entry))
			continue
		}
		corsOrigins = append(corsOrigins, entry)
	}

	sessionSecret := strings.TrimSpace(getenv(SessionSecretName))
	if len(sessionSecret) < 32 {
		issues = append(issues, fmt.Sprintf("%s: must be at least 32 characters", SessionSecretName))
	}

	sessionTTL := positiveMinutes(getenv(SessionTTLName), 480, 60*24*30, SessionTTLName, &issues)
	sessionIdle := positiveMinutes(getenv(SessionIdleName), 120, 60*24, SessionIdleName, &issues)
	loginRateLimit := positiveInt(getenv(LoginRateLimitName), 20, 1000, LoginRateLimitName, &issues)

	logLevel := strings.ToLower(strings.TrimSpace(getenv(LogLevelName)))
	if logLevel == "" {
		logLevel = "info"
	}
	switch logLevel {
	case "debug", "info", "warn", "error":
	default:
		issues = append(issues, fmt.Sprintf("%s: must be debug, info, warn or error", LogLevelName))
	}

	bootstrapEmail := strings.ToLower(strings.TrimSpace(getenv(BootstrapEmailName)))
	if !strings.Contains(bootstrapEmail, "@") {
		issues = append(issues, fmt.Sprintf("%s: must be an email address", BootstrapEmailName))
	}
	bootstrapPassword := getenv(BootstrapPasswordName)
	if len(bootstrapPassword) < 12 || len(bootstrapPassword) > 256 {
		issues = append(issues, fmt.Sprintf("%s: must be between 12 and 256 characters", BootstrapPasswordName))
	}

	organization := Organization{
		Code:    strings.TrimSpace(getenv(OrganizationCodeName)),
		NameEn:  strings.TrimSpace(getenv(OrganizationNameENName)),
		NameAr:  strings.TrimSpace(getenv(OrganizationNameARName)),
		TimeZone: strings.TrimSpace(getenv(OrganizationTZName)),
	}
	if len(organization.Code) < 2 || len(organization.Code) > 32 {
		issues = append(issues, fmt.Sprintf("%s: must be 2-32 characters", OrganizationCodeName))
	}
	if organization.NameEn == "" {
		issues = append(issues, fmt.Sprintf("%s: is required", OrganizationNameENName))
	}
	if organization.NameAr == "" {
		issues = append(issues, fmt.Sprintf("%s: is required", OrganizationNameARName))
	}
	if organization.TimeZone == "" {
		issues = append(issues, fmt.Sprintf("%s: is required", OrganizationTZName))
	} else if _, err := time.LoadLocation(organization.TimeZone); err != nil {
		issues = append(issues, fmt.Sprintf("%s: %q is not a known IANA time zone", OrganizationTZName, organization.TimeZone))
	}

	key, keyIssue := parseEncryptionKey(getenv(FieldEncryptionKeyName), env)
	if keyIssue != "" {
		issues = append(issues, keyIssue)
	}

	if len(issues) > 0 {
		return Config{}, &ConfigurationError{Issues: issues}
	}

	return Config{
		Env:                env,
		Port:               port,
		APIBaseURL:         apiBaseURL,
		DatabaseURL:        databaseURL,
		CORSOrigins:        corsOrigins,
		SessionSecret:      sessionSecret,
		SessionTTL:         sessionTTL,
		SessionIdleTimeout: sessionIdle,
		LoginRateLimit:     loginRateLimit,
		LogLevel:           logLevel,
		BootstrapAdmin:     BootstrapAdmin{Email: bootstrapEmail, Password: bootstrapPassword},
		Organization:       organization,
		FieldEncryptionKey: key,
	}, nil
}

// MustLoad is the process entry point: a configuration problem terminates the process before any
// resource is acquired.
func MustLoad() Config {
	cfg, err := Load(os.Getenv)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	return cfg
}

// IsProduction reports whether production-only hardening applies.
func (c Config) IsProduction() bool { return c.Env == Production }

// IsTest reports whether the process is a test process (no background dispatcher).
func (c Config) IsTest() bool { return c.Env == Test }

func positiveMinutes(raw string, fallback, max int, name string, issues *[]string) time.Duration {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Duration(fallback) * time.Minute
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed < 1 || parsed > max {
		*issues = append(*issues, fmt.Sprintf("%s: must be an integer between 1 and %d", name, max))
		return time.Duration(fallback) * time.Minute
	}
	return time.Duration(parsed) * time.Minute
}

func positiveInt(raw string, fallback, max int, name string, issues *[]string) int {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed < 1 || parsed > max {
		*issues = append(*issues, fmt.Sprintf("%s: must be an integer between 1 and %d", name, max))
		return fallback
	}
	return parsed
}

// parseEncryptionKey accepts 64 hex characters or base64-encoded 32 bytes. In development and
// test an empty value produces an ephemeral key with a warning-free nil slice: the field cipher
// then refuses to encrypt, which keeps accidental production use impossible while letting the
// rest of the API run without the key. Production requires the key.
func parseEncryptionKey(raw string, env Environment) ([]byte, string) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		if env == Production {
			return nil, fmt.Sprintf("%s: is required in production", FieldEncryptionKeyName)
		}
		return nil, ""
	}
	if decoded, err := hex.DecodeString(raw); err == nil && len(decoded) == 32 {
		return decoded, ""
	}
	if decoded, err := base64.StdEncoding.DecodeString(raw); err == nil && len(decoded) == 32 {
		return decoded, ""
	}
	return nil, fmt.Sprintf("%s: must be 64 hex characters or base64-encoded 32 bytes", FieldEncryptionKeyName)
}

// ErrNotConfigured is returned by the field cipher when no key is available.
var ErrNotConfigured = errors.New("field encryption key is not configured")
