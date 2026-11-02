// Package router is a thin wrapper over net/http.ServeMux that records the route table.
//
// The recorded table is the source of truth used by the contract test: every documented OpenAPI
// operation must be registered, and every registered operation must be documented. Using the
// standard library router keeps the dependency surface small and the behaviour predictable.
package router

import (
	"net/http"
	"sort"
	"strings"
)

// Route is one registered operation.
type Route struct {
	Method      string
	Pattern     string
	Public      bool
	Description string
}

// Router owns the mux and the route metadata.
type Router struct {
	mux    *http.ServeMux
	routes []Route
}

// New creates an empty router.
func New() *Router {
	return &Router{mux: http.NewServeMux()}
}

// Handle registers a private operation. Authentication is required by default; public
// operations are an explicit, short list (SEC-001).
func (r *Router) Handle(method, pattern, description string, handler http.HandlerFunc) {
	r.register(method, pattern, description, false, handler)
}

// HandlePublic registers an operation that does not require a session.
func (r *Router) HandlePublic(method, pattern, description string, handler http.HandlerFunc) {
	r.register(method, pattern, description, true, handler)
}

func (r *Router) register(method, pattern, description string, public bool, handler http.HandlerFunc) {
	// Go's ServeMux method pattern: "GET /api/v1/employees/{id}".
	r.mux.HandleFunc(method+" "+pattern, handler)
	r.routes = append(r.routes, Route{
		Method:      method,
		Pattern:     pattern,
		Public:      public,
		Description: description,
	})
}

// Routes returns a sorted copy of the table.
func (r *Router) Routes() []Route {
	out := make([]Route, len(r.routes))
	copy(out, r.routes)
	sort.Slice(out, func(i, j int) bool {
		if out[i].Pattern == out[j].Pattern {
			return out[i].Method < out[j].Method
		}
		return out[i].Pattern < out[j].Pattern
	})
	return out
}

// ServeHTTP delegates to the standard mux.
func (r *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) { r.mux.ServeHTTP(w, req) }

// PatternMatches reports whether a registered pattern matches a concrete path. It is used by the
// contract test, not at runtime.
func PatternMatches(pattern, path string) bool {
	patternParts := strings.Split(strings.Trim(pattern, "/"), "/")
	pathParts := strings.Split(strings.Trim(path, "/"), "/")
	if len(patternParts) != len(pathParts) {
		return false
	}
	for i := range patternParts {
		if strings.HasPrefix(patternParts[i], "{") && strings.HasSuffix(patternParts[i], "}") {
			continue
		}
		if patternParts[i] != pathParts[i] {
			return false
		}
	}
	return true
}
