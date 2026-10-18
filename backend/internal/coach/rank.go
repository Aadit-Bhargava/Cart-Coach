package coach

import (
	"slices"
	"sort"
	"strings"

	"github.com/aaditbhargava/cart-coach/internal/model"
)

// Not worth suggesting for protein, whatever their protein per 100 g says.
var skipCategories = []string{"Spices", "Cooking Oils", "Sauces and Spreads"}

type Candidate struct {
	Product         model.Product
	PackProtein     float64
	ProteinPerRupee float64
	score           float64
}

type Input struct {
	Profile  model.Profile
	Cart     []model.CartItem // the user's own items only
	Excluded []int64          // suggestions the user removed

	// The period the cart covers and the daily protein need, from the saved profile.
	Days          int
	DailyProteinG int
}

type Plan struct {
	Have       float64 // protein in the user's items, grams
	Spent      float64
	Gap        float64 // grams still to reach the target
	BudgetLeft float64
	Candidates []Candidate // best first, at most maxCandidates

	PeriodDays int // days the cart covers
	DailyNeedG int // daily protein need, grams
}

const (
	maxCandidates = 25
	minGap        = 4.0 // below this the goal is close enough
)

var allergenAliases = map[string]string{
	"peanut": "peanuts", "peanuts": "peanuts", "groundnut": "peanuts", "groundnuts": "peanuts",
	"nuts": "tree-nuts", "tree nuts": "tree-nuts", "tree-nuts": "tree-nuts", "almond": "tree-nuts", "cashew": "tree-nuts",
	"dairy": "dairy", "milk": "dairy", "lactose": "dairy",
	"egg": "egg", "eggs": "egg",
	"gluten": "gluten", "wheat": "gluten",
	"soy": "soy", "soya": "soy",
	"fish": "fish", "shellfish": "fish", "seafood": "fish",
	"honey": "honey",
}

// Allowed reports whether a product fits the user's diet and allergies. When the
// user has declared a diet, a product with unknown diet is not allowed.
func Allowed(prof model.Profile, p model.Product) bool {
	switch prof.Diet {
	case "veg":
		if p.Diet != "veg" {
			return false
		}
	case "eggetarian":
		if p.Diet != "veg" && p.Diet != "egg" {
			return false
		}
	case "vegan":
		if p.Diet != "veg" || slices.Contains(p.Allergens, "dairy") || slices.Contains(p.Allergens, "egg") || slices.Contains(p.Allergens, "honey") {
			return false
		}
	}
	name := strings.ToLower(p.Name)
	for _, a := range prof.Allergies {
		if tag, ok := allergenAliases[a]; ok {
			if slices.Contains(p.Allergens, tag) {
				return false
			}
			continue
		}
		// An allergy we have no tag for: fall back to the product name.
		if strings.Contains(name, a) {
			return false
		}
	}
	return true
}

// BuildPlan works out the protein gap and the eligible candidates for it.
func BuildPlan(all []model.Product, in Input) Plan {
	byID := make(map[int64]model.Product, len(all))
	for _, p := range all {
		byID[p.ID] = p
	}
	plan := Plan{PeriodDays: in.Days, DailyNeedG: in.DailyProteinG}
	inCart := map[int64]bool{}
	for _, it := range in.Cart {
		p, ok := byID[it.ProductID]
		if !ok || it.Quantity < 1 {
			continue
		}
		inCart[p.ID] = true
		plan.Spent += p.Price * float64(it.Quantity)
		if pp, ok := PackProtein(p); ok {
			plan.Have += pp * float64(it.Quantity)
		}
	}
	plan.Gap = float64(in.Profile.ProteinTargetG) - plan.Have
	plan.BudgetLeft = in.Profile.Budget - plan.Spent
	if plan.Gap < minGap || plan.BudgetLeft <= 0 {
		return plan
	}

	for _, p := range all {
		pp, ok := PackProtein(p)
		if !ok || p.Price <= 0 || *p.ProteinG < 15 || pp < minGap || pp > plan.Gap || p.Price > plan.BudgetLeft {
			continue
		}
		if inCart[p.ID] || slices.Contains(in.Excluded, p.ID) || slices.Contains(skipCategories, p.CategoryName()) || !Allowed(in.Profile, p) {
			continue
		}
		c := Candidate{Product: p, PackProtein: pp, ProteinPerRupee: pp / p.Price}
		c.score = c.ProteinPerRupee
		for _, w := range in.Profile.Likes {
			if strings.Contains(strings.ToLower(p.Name), w) {
				c.score *= 1.5
				break
			}
		}
		plan.Candidates = append(plan.Candidates, c)
	}
	sort.SliceStable(plan.Candidates, func(i, j int) bool { return plan.Candidates[i].score > plan.Candidates[j].score })
	if len(plan.Candidates) > maxCandidates {
		plan.Candidates = plan.Candidates[:maxCandidates]
	}
	return plan
}
