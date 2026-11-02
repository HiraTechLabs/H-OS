package db

import (
	"context"
	"embed"
	"fmt"
	"sort"
	"strings"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// MigrateLockID is a constant advisory lock key used across all instances of H-OS
// to guarantee serial migration execution on PostgreSQL without race conditions.
const MigrateLockID = 749202611

// Migrate executes all pending SQL migrations against the database serially using an advisory lock.
func Migrate(ctx context.Context, pool *Pool) error {
	// Obtain PostgreSQL session-level advisory lock to serialize concurrent migrations across pods/processes
	var lockAcquired bool
	err := pool.QueryRow(ctx, `SELECT pg_try_advisory_lock($1)`, MigrateLockID).Scan(&lockAcquired)
	if err != nil {
		return fmt.Errorf("acquire migration advisory lock: %w", err)
	}
	if !lockAcquired {
		// Wait until lock is available
		if _, err := pool.Exec(ctx, `SELECT pg_advisory_lock($1)`, MigrateLockID); err != nil {
			return fmt.Errorf("wait for migration advisory lock: %w", err)
		}
	}
	defer func() {
		_, _ = pool.Exec(context.Background(), `SELECT pg_advisory_unlock($1)`, MigrateLockID)
	}()

	// Create schema migrations table if not exists
	_, err = pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS platform_schema_migrations (
			version VARCHAR(128) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("create migrations table: %w", err)
	}

	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read embedded migrations: %w", err)
	}

	var files []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			files = append(files, entry.Name())
		}
	}
	sort.Strings(files)

	for _, filename := range files {
		var applied bool
		err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM platform_schema_migrations WHERE version = $1)`, filename).Scan(&applied)
		if err != nil {
			return fmt.Errorf("check migration %s: %w", filename, err)
		}
		if applied {
			continue
		}

		sqlContent, err := migrationsFS.ReadFile("migrations/" + filename)
		if err != nil {
			return fmt.Errorf("read migration file %s: %w", filename, err)
		}

		err = pool.InTx(ctx, func(tx Tx) error {
			if _, err := tx.Exec(ctx, string(sqlContent)); err != nil {
				return fmt.Errorf("execute %s: %w", filename, err)
			}
			if _, err := tx.Exec(ctx, `INSERT INTO platform_schema_migrations (version) VALUES ($1)`, filename); err != nil {
				return fmt.Errorf("record migration %s: %w", filename, err)
			}
			return nil
		})
		if err != nil {
			return fmt.Errorf("apply migration %s: %w", filename, err)
		}
	}

	return nil
}

// IsReady checks whether all embedded migrations have been applied to the database.
func IsReady(ctx context.Context, pool *Pool) (bool, error) {
	var tableExists bool
	err := pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_name = 'platform_schema_migrations'
		)
	`).Scan(&tableExists)
	if err != nil || !tableExists {
		return false, err
	}

	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return false, err
	}

	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			var applied bool
			err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM platform_schema_migrations WHERE version = $1)`, entry.Name()).Scan(&applied)
			if err != nil || !applied {
				return false, err
			}
		}
	}

	return true, nil
}
