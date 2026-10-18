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
	matched         bool // the name or category matches a word the shopper asked for
}

type Input struct {
	Profile  model.Profile
	Cart     []model.CartItem // the user's own items only
	Excluded []int64          // suggestions the user removed

	// The period the cart covers and the daily protein need, from the saved profile.
	Days          int
	DailyProteinG int

	// What the shopper just asked for, already cleaned, e.g. "paneer". Empty when nothing was asked.
	Preference string
}

type Plan struct {
	Have       float64 // protein in the user's items, grams
	Spent      float64
	Gap        float64 // grams still to reach the target
	BudgetLeft float64
	Candidates []Candidate // best first, at most maxCandidates

	PeriodDays int // days the cart covers
	DailyNeedG int // daily protein need, grams

	Preference        string   // the shopper's request, if any
	PreferenceMatches int      // eligible candidates that match it
	PreferenceMiss    Miss     // when none match: the closest reason why
	Rejected          []string // names of suggestions the shopper rejected, at most 10
}

const (
	maxCandidates               = 25
	maxCandidatesWithPreference = 60  // wider, so the model can see what the shopper asked for
	minGap                      = 4.0 // below this the goal is close enough
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
	return blockedBy(prof, p) == ""
}

// blockedBy says, in plain words, which diet or allergy rules a product out. It is empty when the product is allowed.
func blockedBy(prof model.Profile, p model.Product) string {
	switch prof.Diet {
	case "veg":
		if p.Diet != "veg" {
			return "your diet is vegetarian"
		}
	case "eggetarian":
		if p.Diet != "veg" && p.Diet != "egg" {
			return "your diet is eggetarian"
		}
	case "vegan":
		if p.Diet != "veg" || slices.Contains(p.Allergens, "dairy") || slices.Contains(p.Allergens, "egg") || slices.Contains(p.Allergens, "honey") {
			return "your diet is vegan"
		}
	}
	name := strings.ToLower(p.Name)
	for _, a := range prof.Allergies {
		if tag, ok := allergenAliases[a]; ok {
			if slices.Contains(p.Allergens, tag) {
				return "you avoid " + a
			}
			continue
		}
		// An allergy we have no tag for: fall back to the product name.
		if strings.Contains(name, a) {
			return "you avoid " + a
		}
	}
	return ""
}

// BuildPlan works out the protein gap and the eligible candidates for it.
func BuildPlan(all []model.Product, in Input) Plan {
	byID := make(map[int64]model.Product, len(all))
	for _, p := range all {
		byID[p.ID] = p
	}
	plan := Plan{PeriodDays: in.Days, DailyNeedG: in.DailyProteinG, Preference: in.Preference}
	for _, id := range in.Excluded {
		if p, ok := byID[id]; ok && len(plan.Rejected) < 10 {
			plan.Rejected = append(plan.Rejected, p.Name)
		}
	}
	words := PreferenceWords(in.Preference)
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
	if plan.Gap < minGap {
		plan.PreferenceMiss = Miss{Kind: MissCovered}
		return plan
	}
	if plan.BudgetLeft <= 0 {
		plan.PreferenceMiss = Miss{Kind: MissSpent}
		return plan
	}

	for _, p := range all {
		asked := matchesWords(p, words)
		if miss := missFor(p, in, plan, inCart); miss.Kind != MissNone {
			if asked && miss.closer(plan.PreferenceMiss) {
				plan.PreferenceMiss = miss
			}
			continue
		}
		pp, _ := PackProtein(p)
		c := Candidate{Product: p, PackProtein: pp, ProteinPerRupee: pp / p.Price}
		c.score = c.ProteinPerRupee
		for _, w := range in.Profile.Likes {
			if strings.Contains(strings.ToLower(p.Name), w) {
				c.score *= 1.5
				break
			}
		}
		if asked {
			c.matched = true
			plan.PreferenceMatches++
		}
		plan.Candidates = append(plan.Candidates, c)
	}
	// Items the shopper asked for come first, then the usual order.
	sort.SliceStable(plan.Candidates, func(i, j int) bool {
		a, b := plan.Candidates[i], plan.Candidates[j]
		if a.matched != b.matched {
			return a.matched
		}
		return a.score > b.score
	})
	limit := maxCandidates
	if len(words) > 0 {
		limit = maxCandidatesWithPreference
	}
	if len(plan.Candidates) > limit {
		plan.Candidates = plan.Candidates[:limit]
	}
	return plan
}

// matchesWords reports whether any word appears in the product's name or category.
func matchesWords(p model.Product, words []string) bool {
	if len(words) == 0 {
		return false
	}
	text := strings.ToLower(p.Name + " " + p.CategoryName())
	for _, w := range words {
		if strings.Contains(text, w) {
			return true
		}
	}
	return false
}

// missFor reports why a product cannot be suggested, or a zero Miss when it can.
func missFor(p model.Product, in Input, plan Plan, inCart map[int64]bool) Miss {
	pp, ok := PackProtein(p)
	switch {
	case blockedBy(in.Profile, p) != "":
		return Miss{Kind: MissProfile, Cause: blockedBy(in.Profile, p)}
	case slices.Contains(skipCategories, p.CategoryName()):
		return Miss{Kind: MissProtein}
	case !ok || p.Price <= 0 || *p.ProteinG < 15 || pp < minGap:
		return Miss{Kind: MissProtein}
	case p.Price > plan.BudgetLeft:
		return Miss{Kind: MissBudget}
	case pp > plan.Gap:
		return Miss{Kind: MissGap}
	case inCart[p.ID]:
		return Miss{Kind: MissInCart}
	case slices.Contains(in.Excluded, p.ID):
		return Miss{Kind: MissRemoved}
	}
	return Miss{}
}
