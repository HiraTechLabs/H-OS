// Package httpx contains the transport primitives shared by every module: request identity,
// security headers, CSRF origin checking, JSON decoding and panic recovery.
package httpx

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/ids"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

type contextKey string

const (
	requestIDKey contextKey = "h-os.request-id"
	traceIDKey   contextKey = "h-os.trace-id"
)

// RequestID returns the correlation identifier assigned to the request.
func RequestID(ctx context.Context) string {
	if value, ok := ctx.Value(requestIDKey).(string); ok {
		return value
	}
	return ""
}

// TraceID returns the trace identifier assigned to the request.
func TraceID(ctx context.Context) string {
	if value, ok := ctx.Value(traceIDKey).(string); ok {
		return value
	}
	return ""
}

// RequestContextMiddleware assigns a request ID and trace ID before any handler runs (LOG-004).
// An inbound X-Request-Id is trusted only for shape, never for authorization.
func RequestContextMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := strings.TrimSpace(r.Header.Get("X-Request-Id"))
		if requestID == "" || len(requestID) > 128 {
			requestID = ids.New()
		}
		traceID := r.Header.Get("traceparent")
		if traceID == "" {
			traceID = ids.New()
		}
		ctx := context.WithValue(r.Context(), requestIDKey, requestID)
		ctx = context.WithValue(ctx, traceIDKey, traceID)
		w.Header().Set("X-Request-Id", requestID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// SecurityHeaders applies the baseline response headers. The API serves JSON only, so a strict
// set is sufficient (SEC-011).
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Content-Security-Policy", "frame-ancestors 'none'")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("X-Powered-By", "")
		next.ServeHTTP(w, r)
	})
}

// OriginGuard rejects state-changing requests from an origin that is neither the API origin nor
// an explicitly configured CORS origin. SameSite cookies and this check together close the
// form-based CSRF path that SameSite alone does not cover (SEC-011).
func OriginGuard(allowed []string) func(http.Handler) http.Handler {
	permitted := make(map[string]struct{}, len(allowed))
	for _, origin := range allowed {
		if origin != "" {
			permitted[origin] = struct{}{}
		}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.Method {
			case http.MethodGet, http.MethodHead, http.MethodOptions:
				next.ServeHTTP(w, r)
				return
			}
			origin := r.Header.Get("Origin")
			if origin == "" {
				next.ServeHTTP(w, r)
				return
			}
			if _, ok := permitted[origin]; ok {
				next.ServeHTTP(w, r)
				return
			}
			problem.Write(w, problem.From(problem.Forbidden("The request origin is not allowed for this method."), r.URL.Path, RequestID(r.Context())))
		})
	}
}

// Recovery turns a panic into a generic 500 problem and logs the stack-free cause. A crash in one
// handler must not take down the process or leak internals.
func Recovery(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if recovered := recover(); recovered != nil {
					logger.Error("http.panic", "requestId", RequestID(r.Context()), "path", r.URL.Path, "cause", fmt.Sprint(recovered))
					problem.Write(w, problem.From(problem.Internal(errors.New("panic")), r.URL.Path, RequestID(r.Context())))
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// Logging records one structured line per request. It never logs cookies, bodies or query values.
func Logging(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(recorder, r)
			logger.Info("http.request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", recorder.status,
				"durationMs", time.Since(start).Milliseconds(),
				"requestId", RequestID(r.Context()),
			)
		})
	}
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(status int) {
	s.status = status
	s.ResponseWriter.WriteHeader(status)
}

// DecodeJSON reads exactly one JSON value, rejects unknown fields (the contracts are strict) and
// bounds the body size. Validation details are field-level so the client can mark inputs.
func DecodeJSON(w http.ResponseWriter, r *http.Request, target any, maxBytes int64) error {
	if maxBytes <= 0 {
		maxBytes = 1 << 20
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return decodeError(err)
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return problem.Validation("The request body must contain exactly one JSON value.")
	}
	return nil
}

func decodeError(err error) error {
	var typeErr *json.UnmarshalTypeError
	var syntaxErr *json.SyntaxError
	switch {
	case errors.As(err, &typeErr):
		return problem.Validation("The request contains invalid values.", problem.Detail{
			Field:   typeErr.Field,
			Code:    "invalid_type",
			Message: fmt.Sprintf("Expected %s.", typeErr.Type.String()),
		})
	case errors.As(err, &syntaxErr):
		return problem.Validation("The request body is not valid JSON.")
	case errors.Is(err, io.EOF):
		return problem.Validation("The request body is required.")
	case strings.Contains(err.Error(), "unknown field"):
		return problem.Validation("The request contains an unknown field.", problem.Detail{
			Field:   strings.TrimSpace(strings.TrimPrefix(err.Error(), "json: unknown field")),
			Code:    "unknown_field",
			Message: "This field is not part of the contract.",
		})
	case strings.Contains(err.Error(), "http: request body too large"):
		return problem.Validation("The request body is too large.")
	default:
		return problem.Validation("The request body could not be read.")
	}
}

// WriteJSON renders a JSON response with the correct content type.
func WriteJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

// WriteNoContent renders an empty 204.
func WriteNoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

// Error writes an application error as problem+json.
func Error(w http.ResponseWriter, r *http.Request, err error) {
	problem.Write(w, problem.From(err, r.URL.Path, RequestID(r.Context())))
}
