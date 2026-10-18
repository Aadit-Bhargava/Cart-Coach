package handler

import (
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/aaditbhargava/cart-coach/internal/repository"
)

const userKey = "userID"

// RequireUser identifies the caller by the X-User-ID header.
//
// PROTOTYPE ONLY: there are no passwords or tokens, so anyone who knows a user id
// can act as that user. Replace this with real sign-in before storing anything
// that matters.
func RequireUser(users *repository.UserRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.GetHeader("X-User-ID"), 10, 64)
		if err != nil || id < 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "sign in first: X-User-ID header is missing"})
			return
		}
		if _, err := users.GetByID(c.Request.Context(), id); err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unknown user"})
			return
		}
		c.Set(userKey, id)
		c.Next()
	}
}

func userID(c *gin.Context) int64 { return c.GetInt64(userKey) }

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
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "too many requests, wait a moment and try again"})
			return
		}
		hits[id] = append(recent, now)
		mu.Unlock()
		c.Next()
	}
}
