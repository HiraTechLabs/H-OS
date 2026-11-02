// Package db owns the PostgreSQL connection pool and the transaction helper.
//
// One pool per process. Repositories accept a Querier, so the same method serves a pool-backed
// read and a transaction-backed write without a second implementation (ARCH-005).
package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Tx is the transaction handle InTx passes to its callback. It is an alias so callers can use it
// without importing the driver package.
type Tx = pgx.Tx

// ErrNoRows is returned when a single-row read finds nothing. Re-exported so callers can test for
// it without importing the driver package.
var ErrNoRows = pgx.ErrNoRows

// IsUniqueViolation reports whether an error is a PostgreSQL unique-constraint violation. The
// constraint stays the authority for uniqueness; the application only translates the failure into a
// stable conflict instead of leaking SQL.
func IsUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// Querier is the subset of pgx used by repositories.
type Querier interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Pool wraps pgxpool.Pool so callers depend on the local interface, not the driver package.
type Pool struct {
	pool *pgxpool.Pool
}

// Open parses and validates the connection string, then verifies connectivity.
func Open(ctx context.Context, databaseURL string, maxConns int32) (*Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	if maxConns > 0 {
		config.MaxConns = maxConns
	}
	config.MaxConnLifetime = time.Hour
	config.MaxConnIdleTime = 15 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}
	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return &Pool{pool: pool}, nil
}

// Close releases every connection.
func (p *Pool) Close() { p.pool.Close() }

// Exec implements Querier.
func (p *Pool) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	return p.pool.Exec(ctx, sql, args...)
}

// Query implements Querier.
func (p *Pool) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return p.pool.Query(ctx, sql, args...)
}

// QueryRow implements Querier.
func (p *Pool) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return p.pool.QueryRow(ctx, sql, args...)
}

// InTx runs fn inside a transaction. A panic or error rolls back; only a nil error commits.
// Business rules that must succeed together (state change + audit + outbox) use this helper.
func (p *Pool) InTx(ctx context.Context, fn func(tx Tx) error) error {
	tx, err := p.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		// Rollback after a commit is a no-op, so this is safe on every path.
		_ = tx.Rollback(ctx)
	}()

	if err := fn(tx); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}
