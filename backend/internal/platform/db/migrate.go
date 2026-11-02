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

// Migrate executes all pending SQL migrations against the database.
func Migrate(ctx context.Context, pool *Pool) error {
	// Create schema migrations table if not exists
	_, err := pool.Exec(ctx, `
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
