package auth

import (
	"strings"
	"testing"
	"time"
)

func TestValidatePassword(t *testing.T) {
	cases := []struct {
		pw   string
		want error
	}{
		{"short", ErrPasswordShort},
		{"        ", ErrPasswordShort},
		{"", ErrPasswordShort},
		{"Password", ErrPasswordCommon},
		{"12345678", ErrPasswordCommon},
		{strings.Repeat("a", 73), ErrPasswordLong},
		{"a fine passphrase", nil},
		{strings.Repeat("a", 72), nil},
	}
	for _, c := range cases {
		if got := ValidatePassword(c.pw); got != c.want {
			t.Errorf("ValidatePassword(%q) = %v, want %v", c.pw, got, c.want)
		}
	}
}

func TestHashAndCheck(t *testing.T) {
	hash, err := HashPassword("correct horse battery")
	if err != nil {
		t.Fatal(err)
	}
	if hash == "correct horse battery" || !strings.HasPrefix(hash, "$2") {
		t.Fatalf("password must be stored as a bcrypt hash, got %q", hash)
	}
	if !CheckPassword(hash, "correct horse battery") {
		t.Error("the right password must match")
	}
	if CheckPassword(hash, "wrong password") {
		t.Error("a wrong password must not match")
	}
	if CheckPassword("", "anything at all") {
		t.Error("an account with no password hash must never match")
	}
}

func TestThrottleBlocksAfterMaxFailuresAndRecovers(t *testing.T) {
	now := time.Now()
	th := NewThrottle(3, 10*time.Minute)
	th.now = func() time.Time { return now }

	for i := 0; i < 3; i++ {
		if th.Blocked("a") {
			t.Fatalf("blocked too early, after %d failures", i)
		}
		th.Fail("a")
	}
	if !th.Blocked("a") {
		t.Fatal("should be blocked after 3 failures")
	}
	if th.Blocked("b") {
		t.Error("other keys must not be affected")
	}

	now = now.Add(11 * time.Minute)
	if th.Blocked("a") {
		t.Error("the block must lift once the window has passed")
	}

	th.Fail("a")
	th.Fail("a")
	th.Fail("a")
	th.Reset("a")
	if th.Blocked("a") {
		t.Error("a successful sign-in must clear the failures")
	}
}
