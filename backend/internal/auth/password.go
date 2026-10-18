package auth

import (
	"crypto/rand"
	"errors"
	"strings"
	"sync"

	"golang.org/x/crypto/bcrypt"
)

const (
	bcryptCost  = 12
	minPassword = 8
	maxPassword = 72 // bcrypt ignores everything past 72 bytes, so longer passwords are refused
)

// The messages are shown to people, so they say what to do, in plain words.
var (
	ErrPasswordShort  = errors.New("Choose a password of at least 8 characters.")
	ErrPasswordLong   = errors.New("Choose a password of 72 characters or fewer.")
	ErrPasswordCommon = errors.New("That password is too easy to guess. Choose a different one.")
)

var common = map[string]bool{
	"password": true, "password1": true, "passw0rd": true, "12345678": true, "123456789": true,
	"1234567890": true, "qwertyui": true, "qwerty123": true, "iloveyou": true, "11111111": true,
	"abc12345": true, "letmein1": true, "welcome1": true, "admin123": true, "cartcoach": true,
}

// ValidatePassword checks length and refuses a few of the most common passwords.
func ValidatePassword(pw string) error {
	switch {
	case len(pw) < minPassword || strings.TrimSpace(pw) == "":
		return ErrPasswordShort
	case len(pw) > maxPassword:
		return ErrPasswordLong
	case common[strings.ToLower(pw)]:
		return ErrPasswordCommon
	}
	return nil
}

func HashPassword(pw string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(pw), bcryptCost)
	return string(h), err
}

var (
	dummyOnce sync.Once
	dummyHash []byte
)

// CheckPassword reports whether pw matches the stored hash. When there is no
// hash (no such account) it still does the same amount of work, so response
// time does not reveal which emails have accounts.
func CheckPassword(hash, pw string) bool {
	if hash == "" {
		dummyOnce.Do(func() {
			b := make([]byte, 16)
			_, _ = rand.Read(b)
			dummyHash, _ = bcrypt.GenerateFromPassword(b, bcryptCost)
		})
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(pw))
		return false
	}
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)) == nil
}
