// Package auth holds the signed session cookie, password hashing and login throttling.
package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/aaditbhargava/cart-coach/internal/config"
)

const (
	CookieName = "cc_session"
	TTL        = 7 * 24 * time.Hour
)

// Sessions issues and checks signed session tokens: base64(userID.expiry).base64(HMAC).
// The token only proves "the server signed this user id", so it holds nothing secret.
type Sessions struct {
	secret []byte
	now    func() time.Time
}

// NewSessions uses SESSION_SECRET. Without one it makes a random secret for this
// run, which is fine locally but signs everyone out on restart, and breaks with
// more than one server instance. Set SESSION_SECRET in production.
func NewSessions(cfg *config.Config) *Sessions {
	secret := []byte(cfg.SessionSecret)
	if len(secret) == 0 {
		secret = make([]byte, 32)
		if _, err := rand.Read(secret); err != nil {
			panic(err)
		}
		log.Printf("warning: SESSION_SECRET is not set; using a random one, so sessions end when the server restarts")
	}
	return &Sessions{secret: secret, now: time.Now}
}

func (s *Sessions) sign(payload string) string {
	m := hmac.New(sha256.New, s.secret)
	m.Write([]byte(payload))
	return hex.EncodeToString(m.Sum(nil))
}

// Issue returns a token for the user and when it expires.
func (s *Sessions) Issue(userID int64) (string, time.Time) {
	exp := s.now().Add(TTL)
	payload := fmt.Sprintf("%d.%d", userID, exp.Unix())
	return base64.RawURLEncoding.EncodeToString([]byte(payload)) + "." + s.sign(payload), exp
}

// Verify returns the user id from a valid, unexpired token.
func (s *Sessions) Verify(token string) (int64, bool) {
	enc, sig, ok := strings.Cut(token, ".")
	if !ok {
		return 0, false
	}
	raw, err := base64.RawURLEncoding.DecodeString(enc)
	if err != nil {
		return 0, false
	}
	payload := string(raw)
	if !hmac.Equal([]byte(sig), []byte(s.sign(payload))) {
		return 0, false
	}
	idStr, expStr, ok := strings.Cut(payload, ".")
	if !ok {
		return 0, false
	}
	id, err1 := strconv.ParseInt(idStr, 10, 64)
	exp, err2 := strconv.ParseInt(expStr, 10, 64)
	if err1 != nil || err2 != nil || id < 1 || s.now().Unix() >= exp {
		return 0, false
	}
	return id, true
}
