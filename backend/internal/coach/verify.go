package coach

import (
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"github.com/aaditbhargava/cart-coach/internal/model"
)

// Choice is what the model returns for one pick.
type Choice struct {
	ProductID int64  `json:"product_id"`
	Why       string `json:"why"`
}

const maxPicks = 3

// Verify is the Verifier: it keeps only picks that are real, eligible candidates,
// recomputes every number from the catalog (never from the model), and stops
// before the protein goal or the budget is exceeded. It also drops any "why"
// text that contains a number, so the only numbers shown come from the catalog.
func Verify(choices []Choice, plan Plan) []model.Suggestion {
	byID := make(map[int64]Candidate, len(plan.Candidates))
	for _, c := range plan.Candidates {
		byID[c.Product.ID] = c
	}
	out := []model.Suggestion{}
	seen := map[int64]bool{}
	protein, cost := 0.0, 0.0
	for _, ch := range choices {
		c, ok := byID[ch.ProductID]
		if !ok || seen[c.Product.ID] || len(out) == maxPicks {
			continue
		}
		if protein+c.PackProtein > plan.Gap || cost+c.Product.Price > plan.BudgetLeft {
			continue
		}
		seen[c.Product.ID] = true
		protein += c.PackProtein
		cost += c.Product.Price
		out = append(out, model.Suggestion{
			ProductID: c.Product.ID,
			ProteinG:  round1(c.PackProtein),
			Price:     c.Product.Price,
			Reason:    fmt.Sprintf("+%s g protein, ₹%s more", trim(round1(c.PackProtein)), trim(c.Product.Price)),
			Why:       cleanWhy(ch.Why),
		})
	}
	return out
}

// Fallback picks without the model: best candidates first, while they still fit.
func Fallback(plan Plan) []model.Suggestion {
	choices := make([]Choice, 0, len(plan.Candidates))
	for _, c := range plan.Candidates {
		choices = append(choices, Choice{ProductID: c.Product.ID})
	}
	return Verify(choices, plan)
}

// bannedWhy lists words a "why" must not contain. It keeps the model from
// mentioning the person's body, weight or age, or making health claims.
var bannedWhy = regexp.MustCompile(`(?i)\b(weight|kg|kilo|bmi|age|aged|old|young|body|overweight|underweight|obese|skinny|thin|cure|treat|prevent|disease|lose|burn)\b`)

func cleanWhy(s string) string {
	s = strings.TrimSpace(s)
	if s == "" || len(s) > 90 || strings.ContainsAny(s, "\n\r") || bannedWhy.MatchString(s) {
		return ""
	}
	for _, r := range s {
		if unicode.IsDigit(r) || r == '₹' || r == '%' {
			return ""
		}
	}
	return s
}

func round1(f float64) float64 { return float64(int(f*10+0.5)) / 10 }

func trim(f float64) string {
	s := fmt.Sprintf("%.1f", f)
	return strings.TrimSuffix(s, ".0")
}
