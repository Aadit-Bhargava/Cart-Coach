// Package model holds the types shared by the repositories, the Coach and the
// HTTP handlers. JSON names match openapi/openapi.yaml in the frontend.
package model

import (
	"errors"
	"regexp"
	"slices"
	"strings"
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
}

// SavedProfile is a Profile plus the words the user typed, kept so they can retake it.
type SavedProfile struct {
	Profile
	GoalText string `json:"goal_text"`
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
	if p.ProteinTargetG < 30 || p.ProteinTargetG > 200 {
		return errors.New("Choose a protein target between 30 and 200 g.")
	}
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
