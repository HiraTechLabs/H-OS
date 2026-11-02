// Package domain holds the H-HR business rules that must be true regardless of transport, storage
// or user interface. Nothing here imports HTTP, SQL or a logger.
package domain

// EmploymentStatus is one state of the employment lifecycle.
type EmploymentStatus string

// The lifecycle states (HR-DEC-0001).
const (
	StatusPendingStart EmploymentStatus = "pending_start"
	StatusActive       EmploymentStatus = "active"
	StatusProbation    EmploymentStatus = "probation"
	StatusSuspended    EmploymentStatus = "suspended"
	StatusNoticePeriod EmploymentStatus = "notice_period"
	StatusTerminated   EmploymentStatus = "terminated"
	StatusRetired      EmploymentStatus = "retired"
	StatusCancelled    EmploymentStatus = "cancelled"
)

// EmploymentStatuses is the closed set of states, in lifecycle order.
var EmploymentStatuses = []EmploymentStatus{
	StatusPendingStart, StatusActive, StatusProbation, StatusSuspended,
	StatusNoticePeriod, StatusTerminated, StatusRetired, StatusCancelled,
}

// transitions is the state machine. `terminated`, `retired` and `cancelled` only lead back to
// `pending_start`, because a rehire is a new employment episode, not a status reset.
var transitions = map[EmploymentStatus][]EmploymentStatus{
	StatusPendingStart: {StatusActive, StatusCancelled},
	StatusActive:       {StatusProbation, StatusSuspended, StatusNoticePeriod, StatusTerminated},
	StatusProbation:    {StatusActive, StatusNoticePeriod, StatusTerminated},
	StatusSuspended:    {StatusActive, StatusNoticePeriod, StatusTerminated},
	StatusNoticePeriod: {StatusActive, StatusTerminated},
	StatusTerminated:   {StatusPendingStart},
	StatusRetired:      {StatusPendingStart},
	StatusCancelled:    {StatusPendingStart},
}

var openStatuses = map[EmploymentStatus]struct{}{
	StatusPendingStart: {}, StatusActive: {}, StatusProbation: {},
	StatusSuspended: {}, StatusNoticePeriod: {},
}

var statusLabels = map[EmploymentStatus][2]string{
	StatusPendingStart: {"pending start", "بانتظار المباشرة"},
	StatusActive:       {"active", "نشط"},
	StatusProbation:    {"probation", "فترة تجربة"},
	StatusSuspended:    {"suspended", "موقوف"},
	StatusNoticePeriod: {"notice period", "فترة إشعار"},
	StatusTerminated:   {"terminated", "منتهي"},
	StatusRetired:      {"retired", "متقاعد"},
	StatusCancelled:    {"cancelled", "ملغى"},
}

// IsEmploymentStatus reports whether a stored value is a lifecycle state.
func IsEmploymentStatus(value string) bool {
	_, ok := transitions[EmploymentStatus(value)]
	return ok
}

// CanTransition reports whether the lifecycle allows a move. The API, the database and the UI
// never decide this; the domain does.
func CanTransition(from, to EmploymentStatus) bool {
	for _, allowed := range transitions[from] {
		if allowed == to {
			return true
		}
	}
	return false
}

// AllowedTransitions lists the states reachable from one state, for a refusal message.
func AllowedTransitions(from EmploymentStatus) []EmploymentStatus {
	return append([]EmploymentStatus(nil), transitions[from]...)
}

// IsOpenStatus reports whether an employment episode is still running.
func IsOpenStatus(status EmploymentStatus) bool {
	_, ok := openStatuses[status]
	return ok
}

// IsEndStatus reports whether a status ends an employment episode.
func IsEndStatus(status EmploymentStatus) bool {
	return status == StatusTerminated || status == StatusRetired || status == StatusCancelled
}

// StatusLabel returns the bilingual label used in timeline and audit summaries. Status codes are
// storage values and never appear in user-facing copy.
func StatusLabel(status EmploymentStatus) (en, ar string) {
	label, ok := statusLabels[status]
	if !ok {
		return string(status), string(status)
	}
	return label[0], label[1]
}
