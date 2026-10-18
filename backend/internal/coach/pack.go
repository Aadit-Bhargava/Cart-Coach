// Package coach picks cart suggestions. Go code decides what is eligible and
// checks every number; Gemini only chooses among eligible items and explains
// the choice in words.
package coach

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/aaditbhargava/cart-coach/internal/model"
)

var sizeRe = regexp.MustCompile(`(?i)(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b`)

// PackGrams reads the pack weight in grams from a product name such as
// "Kisan Fresh Masala Peanuts 150 g". Pieces and millilitres have no weight.
func PackGrams(name string) (float64, bool) {
	m := sizeRe.FindStringSubmatch(name)
	if m == nil {
		return 0, false
	}
	n, err := strconv.ParseFloat(m[1], 64)
	if err != nil {
		return 0, false
	}
	switch strings.ToLower(m[2]) {
	case "kg":
		return n * 1000, true
	case "g":
		return n, true
	}
	return 0, false
}

// PackProtein is the protein in the whole pack in grams. It is unknown when the
// protein value is missing or impossible, or the pack has no weight in grams.
func PackProtein(p model.Product) (float64, bool) {
	if p.ProteinG == nil || *p.ProteinG < 0 || *p.ProteinG > 100 {
		return 0, false
	}
	g, ok := PackGrams(p.Name)
	if !ok {
		return 0, false
	}
	return *p.ProteinG * g / 100, true
}
