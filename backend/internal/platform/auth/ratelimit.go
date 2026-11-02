package auth

import (
	"sync"
	"time"
)

// RateLimiter is a fixed-window, in-process limiter for hot unauthenticated endpoints.
//
// It bounds network-level abuse against one process; per-account lockout is the second layer,
// enforced by the session service. Because it lives in memory it resets on restart and does not
// coordinate across replicas — that is a stated limitation, not a control for distributed floods.
type RateLimiter struct {
	limit  int
	window time.Duration
	now    func() time.Time

	mu   sync.Mutex
	hits map[string][]time.Time
}

// NewRateLimiter builds a limiter allowing `limit` hits per window per key.
func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		limit:  limit,
		window: window,
		now:    func() time.Time { return time.Now().UTC() },
		hits:   make(map[string][]time.Time),
	}
}

// Hit records one hit for key and reports whether it is allowed. The check and the increment
// happen under one lock, so concurrent callers cannot exceed the limit by racing the counter.
func (l *RateLimiter) Hit(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	l.prune(now)

	windowStart := now.Truncate(l.window)
	inWindow := l.hits[key]
	kept := inWindow[:0]
	for _, at := range inWindow {
		if !at.Before(windowStart) {
			kept = append(kept, at)
		}
	}
	if len(kept) >= l.limit {
		l.hits[key] = kept
		return false
	}
	l.hits[key] = append(kept, now)
	return true
}

// Reset clears the window of one key, or every key when key is empty. It exists for tests and for
// an operator escape hatch after a lockout storm.
func (l *RateLimiter) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if key == "" {
		l.hits = make(map[string][]time.Time)
		return
	}
	delete(l.hits, key)
}

// prune drops keys with no hit inside the current window so the map cannot grow without bound.
func (l *RateLimiter) prune(now time.Time) {
	for key, hits := range l.hits {
		fresh := false
		for _, at := range hits {
			if now.Sub(at) < l.window {
				fresh = true
				break
			}
		}
		if !fresh {
			delete(l.hits, key)
		}
	}
}
