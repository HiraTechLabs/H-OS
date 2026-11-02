// Package outbox implements the transactional outbox.
//
// A domain event is written in the same transaction as the state change it announces, so an event
// is never lost and never announced without its change committing. Delivery is in-process and
// at-least-once, which is why handlers must be idempotent.
package outbox

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/clock"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/httpx"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/ids"
)

const (
	// MaxDeliveryAttempts bounds retries. A failed event is never deleted: it stays visible with
	// its attempt count so an operator can reconcile rather than guess.
	MaxDeliveryAttempts = 10
	pollInterval        = time.Second
	batchSize           = 50
)

// Subject identifies the record an event is about.
type Subject struct {
	App  string
	Type string
	ID   string
}

// Draft is an event about to be written.
type Draft struct {
	Type          string
	Version       int
	Subject       Subject
	Payload       map[string]any
	CorrelationID string
	OccurredAt    time.Time
}

// Envelope is a stored event as delivered to a handler.
type Envelope struct {
	ID             string
	Type           string
	Version        int
	OrganizationID string
	Subject        Subject
	Payload        map[string]any
	OccurredAt     time.Time
	TraceID        string
}

// Handler consumes one event. It must be idempotent.
type Handler func(ctx context.Context, event Envelope) error

// Writer enqueues events.
type Writer struct {
	clock clock.Clock
}

// NewWriter builds the writer.
func NewWriter(clk clock.Clock) *Writer { return &Writer{clock: clk} }

// Enqueue writes one event inside the caller's transaction and returns its identifier.
func (w *Writer) Enqueue(ctx context.Context, q db.Querier, organizationID string, draft Draft) (string, error) {
	id := ids.New()
	traceID := httpx.TraceID(ctx)
	if traceID == "" {
		traceID = ids.New()
	}
	occurredAt := draft.OccurredAt
	if occurredAt.IsZero() {
		occurredAt = w.clock.Now()
	}
	payload := draft.Payload
	if payload == nil {
		payload = map[string]any{}
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	var correlationID *string
	if draft.CorrelationID != "" {
		correlationID = &draft.CorrelationID
	}

	_, err = q.Exec(ctx, `
		insert into platform.outbox_event
			(id, organization_id, type, version, subject_app, subject_type, subject_id,
			 payload, trace_id, correlation_id, occurred_at)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		id, organizationID, draft.Type, draft.Version,
		draft.Subject.App, draft.Subject.Type, draft.Subject.ID,
		string(encoded), traceID, correlationID, occurredAt)
	if err != nil {
		return "", err
	}
	return id, nil
}

// FailedEvent is a pending event reported to an operator.
type FailedEvent struct {
	ID       string
	Type     string
	Attempts int
}

// Dispatcher delivers stored events to the registered handlers.
type Dispatcher struct {
	pool     *db.Pool
	logger   *slog.Logger
	mu       sync.RWMutex
	handlers map[string][]Handler
	running  atomic.Bool
	stop     chan struct{}
	stopOnce sync.Once
}

// NewDispatcher builds a dispatcher with no handlers. Handlers are registered during composition.
func NewDispatcher(pool *db.Pool, logger *slog.Logger) *Dispatcher {
	return &Dispatcher{
		pool:     pool,
		logger:   logger,
		handlers: make(map[string][]Handler),
		stop:     make(chan struct{}),
	}
}

// Register attaches a handler to an event type. Several handlers may consume the same type.
func (d *Dispatcher) Register(eventType string, handler Handler) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.handlers[eventType] = append(d.handlers[eventType], handler)
}

// Start begins polling. It is not started in the test profile: tests drive DispatchOnce explicitly
// so delivery is deterministic instead of timing-dependent.
func (d *Dispatcher) Start(interval time.Duration) {
	if interval <= 0 {
		interval = pollInterval
	}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-d.stop:
				return
			case <-ticker.C:
				if _, err := d.DispatchOnce(context.Background()); err != nil {
					d.logger.Warn("outbox.dispatch_failed", "cause", err)
				}
			}
		}
	}()
}

// Stop ends polling and waits for the loop to exit.
func (d *Dispatcher) Stop() {
	d.stopOnce.Do(func() { close(d.stop) })
}

// DispatchOnce delivers one batch. It is safe to call from a test and from the poller at once: the
// running flag makes a second concurrent pass a no-op instead of a double delivery.
func (d *Dispatcher) DispatchOnce(ctx context.Context) (int, error) {
	if !d.running.CompareAndSwap(false, true) {
		return 0, nil
	}
	defer d.running.Store(false)

	rows, err := d.pool.Query(ctx, `
		select id::text, type, version, organization_id::text, subject_app, subject_type, subject_id,
		       payload, occurred_at, trace_id, attempts
		from platform.outbox_event
		where published_at is null and attempts < $1
		order by occurred_at
		limit $2`, MaxDeliveryAttempts, batchSize)
	if err != nil {
		return 0, err
	}
	pending := make([]Envelope, 0, batchSize)
	attempts := make([]int, 0, batchSize)
	for rows.Next() {
		var (
			event    Envelope
			eventID  string
			payload  []byte
			attempt int
		)
		if err := rows.Scan(
			&eventID, &event.Type, &event.Version, &event.OrganizationID,
			&event.Subject.App, &event.Subject.Type, &event.Subject.ID,
			&payload, &event.OccurredAt, &event.TraceID, &attempt,
		); err != nil {
			rows.Close()
			return 0, err
		}
		event.ID = eventID
		if len(payload) > 0 {
			if err := json.Unmarshal(payload, &event.Payload); err != nil {
				rows.Close()
				return 0, err
			}
		}
		if event.Payload == nil {
			event.Payload = map[string]any{}
		}
		pending = append(pending, event)
		attempts = append(attempts, attempt)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}

	delivered := 0
	for index, event := range pending {
		d.mu.RLock()
		handlers := append([]Handler(nil), d.handlers[event.Type]...)
		d.mu.RUnlock()

		if err := d.deliver(ctx, handlers, event); err != nil {
			code := "handler_failed"
			d.logger.Warn("outbox.delivery_failed", "type", event.Type, "code", code, "cause", err)
			_, _ = d.pool.Exec(ctx, `
				update platform.outbox_event set attempts = $2, last_error_code = $3 where id = $1`,
				event.ID, attempts[index]+1, code)
			continue
		}
		if _, err := d.pool.Exec(ctx, `
			update platform.outbox_event set published_at = $2, attempts = $3
			where id = $1 and published_at is null`, event.ID, time.Now().UTC(), attempts[index]+1); err != nil {
			return delivered, err
		}
		delivered++
	}
	return delivered, nil
}

func (d *Dispatcher) deliver(ctx context.Context, handlers []Handler, event Envelope) error {
	for _, handler := range handlers {
		if err := handler(ctx, event); err != nil {
			return err
		}
	}
	return nil
}

// PendingEvents lists events that are not delivered yet. Failed events are included on purpose:
// an operator needs to see them, and silence is not a reconciliation.
func (d *Dispatcher) PendingEvents(ctx context.Context) ([]FailedEvent, error) {
	rows, err := d.pool.Query(ctx, `
		select id::text, type, attempts from platform.outbox_event
		where published_at is null order by occurred_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]FailedEvent, 0, 8)
	for rows.Next() {
		var event FailedEvent
		if err := rows.Scan(&event.ID, &event.Type, &event.Attempts); err != nil {
			return nil, err
		}
		out = append(out, event)
	}
	return out, rows.Err()
}
