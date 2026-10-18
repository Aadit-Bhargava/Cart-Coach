package handler

import (
	"errors"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"

	"github.com/aaditbhargava/cart-coach/internal/auth"
	"github.com/aaditbhargava/cart-coach/internal/config"
	"github.com/aaditbhargava/cart-coach/internal/repository"
)

const userKey = "userID"

// RequireUser identifies the caller from the signed session cookie.
func RequireUser(users *repository.UserRepository, sessions *auth.Sessions) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie(auth.CookieName)
		id, ok := sessions.Verify(token)
		if err != nil || !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Log in to continue."})
			return
		}
		if _, err := users.GetByID(c.Request.Context(), id); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "We couldn't find your account. Log in again."})
			return
		}
		c.Set(userKey, id)
		c.Next()
	}
}

func userID(c *gin.Context) int64 { return c.GetInt64(userKey) }

type AuthHandler struct {
	users    *repository.UserRepository
	sessions *auth.Sessions
	secure   bool

	loginFails *auth.Throttle // failed logins per email and IP
	ipFails    *auth.Throttle // failed logins per IP, across emails
	signups    *auth.Throttle // sign-ups per IP
}

func NewAuthHandler(u *repository.UserRepository, s *auth.Sessions, cfg *config.Config) *AuthHandler {
	return &AuthHandler{
		users: u, sessions: s, secure: cfg.CookieSecure,
		loginFails: auth.NewThrottle(5, 15*time.Minute),
		ipFails:    auth.NewThrottle(20, 15*time.Minute),
		signups:    auth.NewThrottle(10, time.Hour),
	}
}

func (h *AuthHandler) Register(r *gin.Engine) {
	r.POST("/api/auth/signup", h.Signup)
	r.POST("/api/auth/login", h.Login)
	r.POST("/api/auth/logout", h.Logout)
	r.GET("/api/auth/me", RequireUser(h.users, h.sessions), h.Me)
}

func (h *AuthHandler) setCookie(c *gin.Context, value string, expires time.Time) {
	c.SetSameSite(http.SameSiteLaxMode)
	maxAge := int(time.Until(expires).Seconds())
	if value == "" {
		maxAge = -1
	}
	c.SetCookie(auth.CookieName, value, maxAge, "/", "", h.secure, true)
}

func (h *AuthHandler) startSession(c *gin.Context, user *repository.User, status int) {
	token, exp := h.sessions.Issue(user.ID)
	h.setCookie(c, token, exp)
	c.JSON(status, user)
}

type credentials struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

const tooManyAttempts = "Too many attempts. Wait a few minutes, then try again."

func cleanEmail(s string) (string, bool) {
	s = strings.ToLower(strings.TrimSpace(s))
	if len(s) > 254 {
		return "", false
	}
	addr, err := mail.ParseAddress(s)
	if err != nil || addr.Address != s || !strings.Contains(s[strings.LastIndex(s, "@"):], ".") {
		return "", false
	}
	return s, true
}

// Signup creates an account and signs the user in.
func (h *AuthHandler) Signup(c *gin.Context) {
	var req credentials
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Enter your name, email and a password."})
		return
	}
	ip := c.ClientIP()
	if h.signups.Blocked(ip) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": tooManyAttempts})
		return
	}
	h.signups.Fail(ip) // every sign-up counts, so one address cannot create accounts in bulk

	name := strings.TrimSpace(req.Name)
	if name == "" || utf8.RuneCountInString(name) > 80 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Enter your name (up to 80 characters)."})
		return
	}
	email, ok := cleanEmail(req.Email)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Enter a valid email address."})
		return
	}
	if err := auth.ValidatePassword(req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		log.Printf("auth: hashing failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "We couldn't create your account. Try again in a moment."})
		return
	}
	user, err := h.users.CreateWithPassword(c.Request.Context(), email, name, hash)
	if errors.Is(err, repository.ErrEmailTaken) {
		c.JSON(http.StatusConflict, gin.H{"error": "An account with this email already exists. Log in instead."})
		return
	}
	if err != nil {
		log.Printf("auth: could not create user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "We couldn't create your account. Try again in a moment."})
		return
	}
	h.startSession(c, user, http.StatusCreated)
}

// Login checks the email and password and starts a session. A wrong email and a
// wrong password get the same answer, so it does not reveal which emails exist.
func (h *AuthHandler) Login(c *gin.Context) {
	var req credentials
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Enter your email and password."})
		return
	}
	email, _ := cleanEmail(req.Email)
	ip := c.ClientIP()
	pairKey := email + "|" + ip
	if h.loginFails.Blocked(pairKey) || h.ipFails.Blocked(ip) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": tooManyAttempts})
		return
	}

	user, hash, err := h.users.GetCredentials(c.Request.Context(), email)
	if err != nil && !errors.Is(err, repository.ErrUserNotFound) {
		log.Printf("auth: login lookup failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "We couldn't log you in. Try again in a moment."})
		return
	}
	if !auth.CheckPassword(hash, req.Password) || user == nil {
		h.loginFails.Fail(pairKey)
		h.ipFails.Fail(ip)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "That email and password don't match. Check them and try again."})
		return
	}
	h.loginFails.Reset(pairKey)
	h.startSession(c, user, http.StatusOK)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	h.setCookie(c, "", time.Now())
	c.Status(http.StatusNoContent)
}

// Me returns the signed-in user, so the page can restore a session on reload.
func (h *AuthHandler) Me(c *gin.Context) {
	user, err := h.users.GetByID(c.Request.Context(), userID(c))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "We couldn't find your account. Log in again."})
		return
	}
	c.JSON(http.StatusOK, user)
}

// RateLimit allows each user n requests per minute. It guards the routes that
// call Gemini, which cost money.
func RateLimit(n int) gin.HandlerFunc {
	var mu sync.Mutex
	hits := map[int64][]time.Time{}
	return func(c *gin.Context) {
		id := userID(c)
		now := time.Now()
		mu.Lock()
		recent := hits[id][:0]
		for _, t := range hits[id] {
			if now.Sub(t) < time.Minute {
				recent = append(recent, t)
			}
		}
		if len(recent) >= n {
			hits[id] = recent
			mu.Unlock()
			c.Header("Retry-After", "30")
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "That was a lot at once. Wait a few seconds, then try again."})
			return
		}
		hits[id] = append(recent, now)
		mu.Unlock()
		c.Next()
	}
}
