package application

import (
	"context"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/audit"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/clock"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/ids"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/outbox"
)

// Change is one recorded business change.
type Change struct {
	// Action is the stable audit action, e.g. `hr.employee.status_changed`.
	Action      string
	EmployeeID  string
	EffectiveOn string
	SummaryEn   string
	SummaryAr   string
	Reason      *string
	Before      audit.Snapshot
	After       audit.Snapshot
	// Event is optional. When present the change is also announced on the outbox.
	EventType      string
	EventVersion   int
	EventPayload   map[string]any
	RelatedType    *string
	RelatedID      *string
}

// Recorder writes the audit record, the employee timeline entry and the outbox event inside the
// caller's transaction, so history, audit and events can never diverge (SEC-007, ARCH-007).
// Operational logs are never used as audit evidence.
type Recorder struct {
	audit    *audit.Recorder
	outbox   *outbox.Writer
	timeline TimelineRepository
	clock    clock.Clock
}

// NewRecorder wires the recorder.
func NewRecorder(auditor *audit.Recorder, writer *outbox.Writer, timeline TimelineRepository, clk clock.Clock) *Recorder {
	return &Recorder{audit: auditor, outbox: writer, timeline: timeline, clock: clk}
}

// Record writes the three records as one unit of work.
func (r *Recorder) Record(ctx context.Context, q db.Querier, actor auth.Actor, organizationID string, change Change) error {
	recordedAt := r.clock.Now()

	actorRef := actor
	if err := r.audit.Record(ctx, q, &actorRef, organizationID, audit.Input{
		Action:  change.Action,
		Subject: audit.Subject{App: "hr", Type: "employee", ID: change.EmployeeID},
		Before:  change.Before,
		After:   change.After,
		Reason:  deref(change.Reason),
	}); err != nil {
		return err
	}

	eventType := change.EventType
	if eventType == "" {
		eventType = change.Action
	}
	actorAccountID := actor.AccountID
	if err := r.timeline.Add(ctx, q, TimelineEntryInput{
		ID:             ids.New(),
		OrganizationID: organizationID,
		EmployeeID:     change.EmployeeID,
		EventType:      eventType,
		OccurredOn:     change.EffectiveOn,
		RecordedAt:     recordedAt,
		SummaryEn:      change.SummaryEn,
		SummaryAr:      change.SummaryAr,
		ActorAccountID: &actorAccountID,
		Reason:         change.Reason,
		RelatedType:    change.RelatedType,
		RelatedID:      change.RelatedID,
	}); err != nil {
		return err
	}

	if change.EventType != "" {
		version := change.EventVersion
		if version <= 0 {
			version = 1
		}
		if _, err := r.outbox.Enqueue(ctx, q, organizationID, outbox.Draft{
			Type:    change.EventType,
			Version: version,
			Subject: outbox.Subject{App: "hr", Type: "employee", ID: change.EmployeeID},
			Payload: change.EventPayload,
		}); err != nil {
			return err
		}
	}
	return nil
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
