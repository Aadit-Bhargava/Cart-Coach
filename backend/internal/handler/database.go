package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DatabaseHandler serves database-related routes.
type DatabaseHandler struct {
	pool *pgxpool.Pool
}

func NewDatabaseHandler(pool *pgxpool.Pool) *DatabaseHandler {
	return &DatabaseHandler{pool: pool}
}

// Register mounts the handler's routes on the engine.
func (h *DatabaseHandler) Register(r *gin.Engine) {
	r.GET("/database/ping", h.Ping)
}

// Ping checks that the database connection is healthy.
func (h *DatabaseHandler) Ping(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	if err := h.pool.Ping(ctx); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
