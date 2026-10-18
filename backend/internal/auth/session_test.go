package auth

import (
	"strings"
	"testing"
	"time"

	"github.com/aaditbhargava/cart-coach/internal/config"
)

func newSessions(secret string) *Sessions {
	return NewSessions(&config.Config{SessionSecret: secret})
}

func TestIssueAndVerify(t *testing.T) {
	s := newSessions("secret-one")
	token, exp := s.Issue(42)
	if exp.Before(time.Now().Add(6 * 24 * time.Hour)) {
		t.Errorf("session should last about a week, expires %v", exp)
	}
	id, ok := s.Verify(token)
	if !ok || id != 42 {
		t.Fatalf("Verify = %d, %v; want 42, true", id, ok)
	}
}

func TestVerifyRejectsTampering(t *testing.T) {
	s := newSessions("secret-one")
	token, _ := s.Issue(42)
	enc, sig, _ := strings.Cut(token, ".")

	// A token for another user id, reusing user 42's signature.
	other, _ := newSessions("secret-one").Issue(7)
	otherEnc, _, _ := strings.Cut(other, ".")

	for name, bad := range map[string]string{
		"empty":               "",
		"no dot":              "abc",
		"not base64":          "!!!." + sig,
		"wrong signature":     enc + "." + strings.Repeat("0", len(sig)),
		"swapped payload":     otherEnc + "." + sig,
		"signed by other key": func() string { t, _ := newSessions("secret-two").Issue(42); return t }(),
	} {
		if id, ok := s.Verify(bad); ok {
			t.Errorf("%s: accepted as user %d", name, id)
		}
	}
}

func TestVerifyRejectsExpired(t *testing.T) {
	s := newSessions("secret-one")
	token, _ := s.Issue(42)
	s.now = func() time.Time { return time.Now().Add(TTL + time.Minute) }
	if _, ok := s.Verify(token); ok {
		t.Error("an expired token must be rejected")
	}
}
