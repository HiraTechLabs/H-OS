package auth

import (
	"context"
	"net/http"

	"github.com/HiraTechLabs/H-OS/backend/internal/platform/httpx"
	"github.com/HiraTechLabs/H-OS/backend/internal/platform/problem"
)

type actorKey struct{}

// WithActor attaches the authenticated caller to the request context.
func WithActor(ctx context.Context, actor Actor) context.Context {
	return context.WithValue(ctx, actorKey{}, actor)
}

// ActorFrom returns the caller attached by Middleware.
func ActorFrom(ctx context.Context) (Actor, bool) {
	actor, ok := ctx.Value(actorKey{}).(Actor)
	return actor, ok
}

// RequireActor returns the caller or the standard unauthenticated problem. Use-case code uses this
// so no handler can accidentally run without an identity.
func RequireActor(ctx context.Context) (Actor, error) {
	actor, ok := ActorFrom(ctx)
	if !ok {
		return Actor{}, problem.Unauthenticated("")
	}
	return actor, nil
}

// Middleware enforces a valid session and attaches the caller. It wraps only the handlers that are
// not explicitly public, so authentication stays deny-by-default at the route table (SEC-001).
func Middleware(sessions *SessionService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := TokenFromRequest(r)
			if token == "" {
				problem.Write(w, problem.From(problem.Unauthenticated(""), r.URL.Path, httpx.RequestID(r.Context())))
				return
			}
			actor, err := sessions.Resolve(r.Context(), token)
			if err != nil {
				problem.Write(w, problem.From(err, r.URL.Path, httpx.RequestID(r.Context())))
				return
			}
			next.ServeHTTP(w, r.WithContext(WithActor(r.Context(), actor)))
		})
	}
}

// Protected adapts a handler that needs the caller, failing closed when the actor is missing.
func Protected(sessions *SessionService, handler http.HandlerFunc) http.HandlerFunc {
	guarded := Middleware(sessions)(handler)
	return func(w http.ResponseWriter, r *http.Request) { guarded.ServeHTTP(w, r) }
}
