package handler

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"

	"github.com/aaditbhargava/cart-coach/internal/coach"
	"github.com/aaditbhargava/cart-coach/internal/model"
	"github.com/aaditbhargava/cart-coach/internal/repository"
)

type CoachHandler struct {
	users     *repository.UserRepository
	coach     *coach.Service
	decisions *repository.DecisionRepository
}

func NewCoachHandler(u *repository.UserRepository, c *coach.Service, d *repository.DecisionRepository) *CoachHandler {
	return &CoachHandler{users: u, coach: c, decisions: d}
}

func (h *CoachHandler) Register(r *gin.Engine) {
	auth := r.Group("/api", RequireUser(h.users))
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	if err := req.Profile.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.Cart) > 100 || len(req.ExcludedProductIDs) > 500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cart is too large"})
		return
	}
	for _, it := range req.Cart {
		if it.Quantity < 1 || it.Quantity > 50 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "quantity must be 1 to 50"})
			return
		}
	}
	if !req.Profile.AutoAdd {
		c.JSON(http.StatusForbidden, gin.H{"error": "auto-add is off for this profile"})
		return
	}

	res, err := h.coach.Suggest(c.Request.Context(), userID(c), coach.Input{Profile: req.Profile, Cart: req.Cart, Excluded: req.ExcludedProductIDs})
	if errors.Is(err, coach.ErrNotConfigured) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Coach is not available right now"})
		return
	}
	if err != nil {
		log.Printf("suggest: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not find suggestions"})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (h *CoachHandler) ListDecisions(c *gin.Context) {
	list, err := h.decisions.Recent(c.Request.Context(), userID(c), 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load the decision log"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"decisions": list})
}

// AddDecision records something the user did (kept, removed or undid suggestions).
func (h *CoachHandler) AddDecision(c *gin.Context) {
	var d model.Decision
	if err := c.ShouldBindJSON(&d); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title and detail are required"})
		return
	}
	d.Title, d.Detail = strings.TrimSpace(d.Title), strings.TrimSpace(d.Detail)
	if d.Title == "" || utf8.RuneCountInString(d.Title) > 200 || utf8.RuneCountInString(d.Detail) > 2000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title is required (200 characters at most), detail 2000 at most"})
		return
	}
	if err := h.decisions.Add(c.Request.Context(), userID(c), d); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save the entry"})
		return
	}
	c.Status(http.StatusNoContent)
}
