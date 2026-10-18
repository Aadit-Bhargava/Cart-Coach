// Package model holds the types shared by the repositories, the Coach and the
// HTTP handlers. JSON names match openapi/openapi.yaml in the frontend.
package model

import (
	"errors"
	"regexp"
	"slices"
	"strings"

	"github.com/aaditbhargava/cart-coach/internal/nutrition"
)

type Product struct {
	ID        int64    `json:"id"`
	Name      string   `json:"name"`
	Brand     *string  `json:"brand"`
	Category  *string  `json:"category"`
	Price     float64  `json:"price"`
	ProteinG  *float64 `json:"protein_g"` // per 100 g (or 100 ml)
	Calories  *int32   `json:"calories"`  // kcal per 100 g (or 100 ml)
	ImageURL  *string  `json:"image_url"`
	Diet      string   `json:"diet"`      // veg, egg, non-veg, unknown
	Allergens []string `json:"allergens"` // peanuts, tree-nuts, dairy, egg, gluten, soy, fish, honey
}

func (p Product) CategoryName() string {
	if p.Category == nil {
		return ""
	}
	return *p.Category
}

type Profile struct {
	ProteinTargetG int      `json:"protein_target_g"`
	Diet           string   `json:"diet"`
	Allergies      []string `json:"allergies"`
	Likes          []string `json:"likes"`
	Budget         float64  `json:"budget"`
	AutoAdd        bool     `json:"auto_add"`

	// Personal details behind the protein target. They are nil or zero on profiles
	// saved before these fields existed; DetailsComplete reports that.
	AgeYears      *int     `json:"age_years"`
	WeightKg      *float64 `json:"weight_kg"`
	HeightCm      *float64 `json:"height_cm"`
	Activity      string   `json:"activity"`
	Days          int      `json:"days"`
	DailyProteinG int      `json:"daily_protein_g"`
}

// SavedProfile is a Profile plus the words the user typed, kept so they can retake it.
type SavedProfile struct {
	Profile
	GoalText        string `json:"goal_text"`
	DetailsComplete bool   `json:"details_complete"`
}

type CartItem struct {
	ProductID int64 `json:"product_id"`
	Quantity  int   `json:"quantity"`
}

type Suggestion struct {
	ProductID int64   `json:"product_id"`
	ProteinG  float64 `json:"protein_g"`
	Price     float64 `json:"price"`
	Reason    string  `json:"reason"`
	Why       string  `json:"why,omitempty"`
}

type Decision struct {
	ID        int64  `json:"id,omitempty"`
	Title     string `json:"title"`
	Detail    string `json:"detail"`
	CreatedAt string `json:"created_at,omitempty"`
}

var Diets = []string{"veg", "vegan", "eggetarian", "non-veg", "unknown"}

var control = regexp.MustCompile(`[\x00-\x1f\x7f]`)

// CleanList lowercases, trims and de-duplicates user or model supplied words,
// dropping control characters and anything over 30 characters. At most 8 stay.
func CleanList(in []string) []string {
	out := []string{}
	for _, s := range in {
		s = strings.ToLower(strings.TrimSpace(control.ReplaceAllString(s, " ")))
		if s == "" || len(s) > 30 || slices.Contains(out, s) {
			continue
		}
		out = append(out, s)
		if len(out) == 8 {
			break
		}
	}
	return out
}

// Validate checks a profile that came from a request and normalises its lists.
func (p *Profile) Validate() error {
	if !slices.Contains(Diets, p.Diet) {
		return errors.New("Choose a diet from the list.")
	}
	if p.Budget < 50 || p.Budget > 5000 {
		return errors.New("Choose a budget between ₹50 and ₹5,000.")
	}
	p.Allergies = CleanList(p.Allergies)
	p.Likes = CleanList(p.Likes)
	return nil
}

// DetailsComplete reports whether every personal detail behind the target is present.
func (p Profile) DetailsComplete() bool {
	return p.AgeYears != nil && p.WeightKg != nil && p.HeightCm != nil &&
		p.Activity != "" && p.Days > 0 && p.DailyProteinG > 0
}

// ValidateDetails checks the personal details, with messages shown to people as written.
func (p *Profile) ValidateDetails() error {
	var s nutrition.Stats // a missing value is 0, which Validate reports with the right message
	if p.AgeYears != nil {
		s.AgeYears = *p.AgeYears
	}
	if p.WeightKg != nil {
		s.WeightKg = *p.WeightKg
	}
	if p.HeightCm != nil {
		s.HeightCm = *p.HeightCm
	}
	if err := s.Validate(); err != nil {
		return err
	}
	if _, ok := nutrition.ParseActivity(p.Activity); !ok {
		return errors.New("Choose an activity level from the list.")
	}
	if !slices.Contains(nutrition.AllowedDays, p.Days) {
		return errors.New("Choose 1, 3 or 7 days.")
	}
	if p.DailyProteinG < nutrition.MinDaily || p.DailyProteinG > nutrition.MaxDaily {
		return errors.New("Choose a daily protein amount between 40 and 220 g.")
	}
	return nil
}

// ApplyTarget sets the cart target from the daily amount and the period. The
// server always does this itself, so a target sent by the browser is ignored.
func (p *Profile) ApplyTarget() {
	p.ProteinTargetG = nutrition.CartTarget(p.DailyProteinG, p.Days)
}
