// Package audit writes the append-only record of business changes.
//
// An audit entry is written inside the same transaction as the change it describes, so the two can
// never diverge. Operational log lines are never audit evidence: logs rotate, audit rows do not.
package audit

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/auth"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/clock"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/db"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/httpx"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/ids"
)

// sensitiveKeys must never reach the audit store in clear form. A sensitive field is recorded as
// changed-versus-unchanged ("[redacted]"), never as a value (SEC-008).
var sensitiveKeys = map[string]struct{}{
	"nationalid": {}, "national_id": {}, "passport": {}, "passportnumber": {}, "passport_number": {},
	"iban": {}, "bankaccount": {}, "bank_account": {}, "salary": {}, "basicamount": {}, "basic_amount": {},
	"netamount": {}, "net_amount": {}, "password": {}, "passwordhash": {}, "medicalnotes": {},
	"medical_notes": {}, "token": {},
}

// Snapshot is the state of a record before or after a change.
type Snapshot map[string]any

// Redact replaces sensitive values while keeping the key, so an auditor can still see that a field
// changed without seeing what it changed to.
func Redact(snapshot Snapshot) map[string]any {
	if snapshot == nil {
		return nil
	}
	out := make(map[string]any, len(snapshot))
	for key, value := range snapshot {
		if _, sensitive := sensitiveKeys[strings.ToLower(key)]; sensitive {
			if value == nil {
				out[key] = nil
			} else {
				out[key] = "[redacted]"
			}
			continue
		}
		out[key] = value
	}
	return out
}

// Subject identifies the record an audit entry is about, using the same app/type/id triple as the
// event envelope so the trail and the event stream can be joined.
type Subject struct {
	App  string
	Type string
	ID   string
}

// Input is one audit entry.
type Input struct {
	Action  string
	Subject Subject
	Before  Snapshot
	After   Snapshot
	Reason  string
}

// Recorder writes audit entries.
type Recorder struct {
	clock clock.Clock
}

// NewRecorder builds the recorder.
func NewRecorder(clk clock.Clock) *Recorder { return &Recorder{clock: clk} }

// Record appends one entry inside the caller's transaction. The caller decides the transaction
// boundary; this method never opens one, so a failed state change takes its audit row with it.
func (r *Recorder) Record(ctx context.Context, q db.Querier, actor *auth.Actor, organizationID string, input Input) error {
	var actorID *string
	if actor != nil {
		actorID = &actor.AccountID
	}
	var reason *string
	if input.Reason != "" {
		reason = &input.Reason
	}

	requestID := httpx.RequestID(ctx)
	if requestID == "" {
		requestID = "system"
	}
	traceID := httpx.TraceID(ctx)
	if traceID == "" {
		traceID = ids.New()
	}

	before, err := encodeSnapshot(Redact(input.Before))
	if err != nil {
		return err
	}
	after, err := encodeSnapshot(Redact(input.After))
	if err != nil {
		return err
	}

	_, err = q.Exec(ctx, `
		insert into platform.audit_record
			(id, organization_id, actor_account_id, action, subject_app, subject_type, subject_id,
			 before, after, reason, request_id, trace_id, occurred_at)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
		ids.New(), organizationID, actorID, input.Action,
		input.Subject.App, input.Subject.Type, input.Subject.ID,
		before, after, reason, requestID, traceID, r.clock.Now())
	return err
}

// encodeSnapshot turns a snapshot into the JSONB text pgx sends. A nil snapshot stays SQL NULL so
// "no previous state" and "empty previous state" remain distinguishable.
func encodeSnapshot(snapshot map[string]any) (any, error) {
	if snapshot == nil {
		return nil, nil
	}
	encoded, err := json.Marshal(snapshot)
	if err != nil {
		return nil, err
	}
	return string(encoded), nil
}
