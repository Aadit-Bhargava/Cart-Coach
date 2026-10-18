package auth

import (
	"sync"
	"time"
)

// Throttle blocks a key after too many recent failures. It keeps its counts in
// memory, so it resets on restart and is per server instance.
type Throttle struct {
	mu     sync.Mutex
	max    int
	window time.Duration
	fails  map[string][]time.Time
	now    func() time.Time
}

func NewThrottle(max int, window time.Duration) *Throttle {
	return &Throttle{max: max, window: window, fails: map[string][]time.Time{}, now: time.Now}
}

func (t *Throttle) prune(key string) []time.Time {
	recent := t.fails[key][:0]
	for _, at := range t.fails[key] {
		if t.now().Sub(at) < t.window {
			recent = append(recent, at)
		}
	}
	if len(recent) == 0 {
		delete(t.fails, key)
		return nil
	}
	t.fails[key] = recent
	return recent
}

// Blocked reports whether the key has used up its attempts.
func (t *Throttle) Blocked(key string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	return len(t.prune(key)) >= t.max
}

// Fail records one failed attempt.
func (t *Throttle) Fail(key string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.prune(key)
	t.fails[key] = append(t.fails[key], t.now())
}

// Reset forgets a key's failures, after a successful sign-in.
func (t *Throttle) Reset(key string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.fails, key)
}
