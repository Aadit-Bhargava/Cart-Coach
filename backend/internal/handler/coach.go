package handler

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"

	"github.com/aaditbhargava/cart-coach/internal/auth"
	"github.com/aaditbhargava/cart-coach/internal/coach"
	"github.com/aaditbhargava/cart-coach/internal/model"
	"github.com/aaditbhargava/cart-coach/internal/repository"
)

type CoachHandler struct {
	users     *repository.UserRepository
	sessions  *auth.Sessions
	coach     *coach.Service
	decisions *repository.DecisionRepository
}

func NewCoachHandler(u *repository.UserRepository, s *auth.Sessions, c *coach.Service, d *repository.DecisionRepository) *CoachHandler {
	return &CoachHandler{users: u, sessions: s, coach: c, decisions: d}
}

func (h *CoachHandler) Register(r *gin.Engine) {
	auth := r.Group("/api", RequireUser(h.users, h.sessions))
	auth.POST("/coach/suggest", RateLimit(30), h.Suggest)
	auth.GET("/decisions", h.ListDecisions)
	auth.POST("/decisions", h.AddDecision)
}

type suggestRequest struct {
	Profile            model.Profile    `json:"profile"`
	Cart               []model.CartItem `json:"cart"`
	ExcludedProductIDs []int64          `json:"excluded_product_ids"`
}

// Suggest returns up to three verified suggestions for the user's cart.
func (h *CoachHandler) Suggest(c *gin.Context) {
	var req suggestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "We couldn't read that request. Reload the page and try again."})
		return
	}
	if err := req.Profile.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.Cart) > 100 || len(req.ExcludedProductIDs) > 500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Your cart is too large for Coach to review. Remove a few items and try again."})
		return
	}
	for _, it := range req.Cart {
		if it.Quantity < 1 || it.Quantity > 50 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Each item can be added up to 50 times."})
			return
		}
	}
	if !req.Profile.AutoAdd {
		c.JSON(http.StatusForbidden, gin.H{"error": "Suggestions are off. Turn on \"Let Coach pre-fill my cart\" in your goal to get them."})
		return
	}

	res, err := h.coach.Suggest(c.Request.Context(), userID(c), coach.Input{Profile: req.Profile, Cart: req.Cart, Excluded: req.ExcludedProductIDs})
	if errors.Is(err, coach.ErrNotConfigured) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Coach isn't available right now. Try again in a few minutes."})
		return
	}
	if err != nil {
		log.Printf("suggest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Coach couldn't find suggestions right now. Try again in a moment."})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (h *CoachHandler) ListDecisions(c *gin.Context) {
	list, err := h.decisions.Recent(c.Request.Context(), userID(c), 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "We couldn't load your decision log. Try again in a moment."})
		return
	}
	c.JSON(http.StatusOK, gin.H{"decisions": list})
}

// AddDecision records something the user did (kept, removed or undid suggestions).
func (h *CoachHandler) AddDecision(c *gin.Context) {
	var d model.Decision
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "That log entry is incomplete."})
		return
	}
	d.Title, d.Detail = strings.TrimSpace(d.Title), strings.TrimSpace(d.Detail)
	if d.Title == "" || utf8.RuneCountInString(d.Title) > 200 || utf8.RuneCountInString(d.Detail) > 2000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "That log entry is too long."})
		return
	}
	if err := h.decisions.Add(c.Request.Context(), userID(c), d); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "We couldn't save that log entry. Try again in a moment."})
		return
	}
	c.Status(http.StatusNoContent)
}
