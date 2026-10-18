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
	"github.com/aaditbhargava/cart-coach/internal/nutrition"
	"github.com/aaditbhargava/cart-coach/internal/repository"
)

// supportMessage is shown instead of a profile when the text suggests distress.
// It gives no numbers, targets or tips, as the project rules require.
const supportMessage = "It sounds like things might be hard right now. Cart Coach can't help with that, " +
	"but talking to someone you trust, or to a doctor or counsellor, can. " +
	"In India you can call Tele-MANAS on 14416 or 1800 891 4416 at any time, free of charge."

type ProfileHandler struct {
	users    *repository.UserRepository
	sessions *auth.Sessions
	profiles *repository.ProfileRepository
	decide   *repository.DecisionRepository
	gemini   *coach.Gemini
}

func NewProfileHandler(u *repository.UserRepository, s *auth.Sessions, p *repository.ProfileRepository, d *repository.DecisionRepository, g *coach.Gemini) *ProfileHandler {
	return &ProfileHandler{users: u, sessions: s, profiles: p, decide: d, gemini: g}
}

func (h *ProfileHandler) Register(r *gin.Engine) {
	auth := r.Group("/api", RequireUser(h.users, h.sessions))
	auth.GET("/profile", h.Get)
	auth.PUT("/profile", h.Put)
	auth.POST("/profile/understand", RateLimit(15), h.Understand)
	auth.POST("/profile/target", h.Target)
}

// statsRequest carries the personal details behind the protein target. They are
// used to compute the target and are never logged or sent to Gemini.
type statsRequest struct {
	AgeYears int     `json:"age_years"`
	WeightKg float64 `json:"weight_kg"`
	HeightCm float64 `json:"height_cm"`
}

func (s statsRequest) stats() nutrition.Stats {
	return nutrition.Stats{AgeYears: s.AgeYears, WeightKg: s.WeightKg, HeightCm: s.HeightCm}
}

type targetRequest struct {
	statsRequest
	Activity string `json:"activity"`
}

// Target works out the daily protein for the given details and activity. It
// saves nothing; the goal popup calls it when the user changes their activity.
func (h *ProfileHandler) Target(c *gin.Context) {
	var req targetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Check your age, weight and height, then try again."})
		return
	}
	stats := req.stats()
	if err := stats.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	activity, ok := nutrition.ParseActivity(req.Activity)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Choose an activity level from the list."})
		return
	}
	grams, basis := nutrition.DailyProtein(stats, activity)
	c.JSON(http.StatusOK, gin.H{"daily_protein_g": grams, "basis": basis})
}

type understandRequest struct {
	statsRequest
	Text string `json:"text"`
}

// Understand turns the user's own words into a profile for them to review. Gemini
// only reads the words (activity, diet, allergies, likes); the protein target is
// computed here from the personal details. It saves nothing; the user confirms
// the result with PUT /api/profile.
func (h *ProfileHandler) Understand(c *gin.Context) {
	var req understandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Write a few words about your goal, and check your age, weight and height."})
		return
	}
	text := strings.TrimSpace(req.Text)
	if n := utf8.RuneCountInString(text); n < 8 || n > 500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Describe your goal in 8 to 500 characters."})
		return
	}
	stats := req.stats()
	if err := stats.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	u, err := h.gemini.Understand(c.Request.Context(), text)
	if errors.Is(err, coach.ErrNotConfigured) {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Coach isn't available right now. Try again in a few minutes."})
		return
	}
	if err != nil {
		log.Printf("understand: %v", err)
		c.JSON(http.StatusBadGateway, gin.H{"error": "Coach couldn't read that right now. Try again in a moment."})
		return
	}
	if u.NeedsSupport {
		_ = h.decide.Add(c.Request.Context(), userID(c), model.Decision{Title: "Goal text needed a supportive reply", Detail: "No targets or suggestions were given."})
		c.JSON(http.StatusOK, gin.H{"support_message": supportMessage})
		return
	}
	activity, _ := nutrition.ParseActivity(u.Activity) // CleanUnderstanding guarantees a valid value
	grams, basis := nutrition.ResolveDaily(stats, activity, u.StatedDailyProteinG)
	c.JSON(http.StatusOK, gin.H{"understanding": gin.H{
		"activity": u.Activity, "diet": u.Diet, "allergies": u.Allergies, "likes": u.Likes,
		"daily_protein_g": grams, "basis": basis,
	}})
}

func (h *ProfileHandler) Get(c *gin.Context) {
	p, err := h.profiles.Get(c.Request.Context(), userID(c))
	if errors.Is(err, repository.ErrProfileNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "You haven't set a goal yet."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "We couldn't load your goal. Try again in a moment."})
		return
	}
	c.JSON(http.StatusOK, p)
}

// Put saves the profile the user confirmed.
func (h *ProfileHandler) Put(c *gin.Context) {
	var req model.SavedProfile
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Some goal details are missing or invalid. Check them and try again."})
		return
	}
	if err := req.Validate(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := req.ValidateDetails(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.ApplyTarget() // the cart target is always computed here, never taken from the browser
	req.DetailsComplete = true
	req.GoalText = strings.TrimSpace(req.GoalText)
	if n := utf8.RuneCountInString(req.GoalText); n < 8 || n > 500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Describe your goal in 8 to 500 characters."})
		return
	}
	if err := h.profiles.Save(c.Request.Context(), userID(c), req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "We couldn't save your goal. Try again in a moment."})
		return
	}
	c.JSON(http.StatusOK, req)
}
