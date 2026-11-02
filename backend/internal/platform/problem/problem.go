// Package problem defines the H-OS error vocabulary and renders RFC 9457 problem+json.
//
// Errors are values with a stable machine code. Transport code never decides an HTTP status from
// a string; it maps a typed error. Copy shown to the user is resolved from the code by i18n, so
// server sentences are diagnostic only (STK-007, UX-006).
package problem

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
)

// Code is the stable machine value returned to clients.
type Code string

const (
	CodeValidation         Code = "validation_failed"
	CodeUnauthenticated    Code = "unauthenticated"
	CodeForbidden          Code = "forbidden"
	CodeNotFound           Code = "not_found"
	CodeConflict           Code = "conflict"
	CodePreconditionFailed Code = "precondition_failed"
	CodeRateLimited        Code = "rate_limited"
	CodeInternal           Code = "internal_error"
)

// ContentType is the media type required by RFC 9457.
const ContentType = "application/problem+json"

// Detail is one field-level validation failure.
type Detail struct {
	Field   string `json:"field"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Detail is the wire shape. Field names match the TypeScript client exactly.
type Problem struct {
	Type      string   `json:"type"`
	Title     string   `json:"title"`
	Status    int      `json:"status"`
	Detail    string   `json:"detail,omitempty"`
	Code      Code     `json:"code"`
	Instance  string   `json:"instance,omitempty"`
	RequestID string   `json:"requestId,omitempty"`
	Errors    []Detail `json:"errors,omitempty"`
}

// Error is a domain or application failure that maps to one HTTP status and one machine code.
type Error struct {
	Status  int
	Code    Code
	Message string
	Details []Detail
	Cause   error
}

func (e *Error) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *Error) Unwrap() error { return e.Cause }

// New builds an application error with an explicit status.
func New(status int, code Code, message string) *Error {
	return &Error{Status: status, Code: code, Message: message}
}

// Validation reports a request that does not satisfy its contract.
func Validation(message string, details ...Detail) *Error {
	return &Error{Status: http.StatusBadRequest, Code: CodeValidation, Message: message, Details: details}
}

// Unauthenticated means no valid session.
func Unauthenticated(message string) *Error {
	if message == "" {
		message = "Authentication is required."
	}
	return New(http.StatusUnauthorized, CodeUnauthenticated, message)
}

// Forbidden means the session is valid but the permission or scope is not.
func Forbidden(message string) *Error {
	if message == "" {
		message = "You do not have permission to perform this action."
	}
	return New(http.StatusForbidden, CodeForbidden, message)
}

// NotFound intentionally reveals no record details.
func NotFound(message string) *Error {
	return New(http.StatusNotFound, CodeNotFound, message)
}

// Conflict covers uniqueness and state collisions.
func Conflict(message string) *Error {
	return New(http.StatusConflict, CodeConflict, message)
}

// PreconditionFailed covers an operation refused by the current lifecycle state.
func PreconditionFailed(message string) *Error {
	return New(http.StatusPreconditionFailed, CodePreconditionFailed, message)
}

// RateLimited is returned by the login limiter.
func RateLimited(message string) *Error {
	return New(http.StatusTooManyRequests, CodeRateLimited, message)
}

// Internal wraps an unexpected failure. The cause is logged, never sent to the client.
func Internal(cause error) *Error {
	return &Error{Status: http.StatusInternalServerError, Code: CodeInternal, Message: "An unexpected error occurred.", Cause: cause}
}

// As extracts an application error from a wrapped chain.
func As(err error) (*Error, bool) {
	var appErr *Error
	if errors.As(err, &appErr) {
		return appErr, true
	}
	return nil, false
}

// TitleFor is the RFC 9457 title for a status.
func TitleFor(status int) string {
	switch status {
	case http.StatusBadRequest:
		return "Bad Request"
	case http.StatusUnauthorized:
		return "Unauthorized"
	case http.StatusForbidden:
		return "Forbidden"
	case http.StatusNotFound:
		return "Not Found"
	case http.StatusConflict:
		return "Conflict"
	case http.StatusPreconditionFailed:
		return "Precondition Failed"
	case http.StatusTooManyRequests:
		return "Too Many Requests"
	default:
		return "Internal Server Error"
	}
}

// From converts any error to the wire problem. Unexpected errors are rendered generically:
// internals, SQL and personal data never leak (SEC-008).
func From(err error, instance, requestID string) Problem {
	appErr, ok := As(err)
	if !ok {
		appErr = Internal(err)
	}
	detail := appErr.Message
	if appErr.Status >= 500 {
		detail = "An unexpected error occurred."
	}
	return Problem{
		Type:      "https://h-os.local/problems/" + string(appErr.Code),
		Title:     TitleFor(appErr.Status),
		Status:    appErr.Status,
		Detail:    detail,
		Code:      appErr.Code,
		Instance:  instance,
		RequestID: requestID,
		Errors:    appErr.Details,
	}
}

// Write renders the problem. It never fails halfway: an encoding failure is impossible for this
// shape, and the status line is already committed.
func Write(w http.ResponseWriter, p Problem) {
	w.Header().Set("Content-Type", ContentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(p.Status)
	_ = json.NewEncoder(w).Encode(p)
}
