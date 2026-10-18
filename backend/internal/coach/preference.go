package coach

import (
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"
)

// What the shopper types when they reject a suggestion ("paneer, not rajma") is untrusted text. It is
// cleaned here, used for keyword matching in Go, and passed to Gemini as data, never as instructions.

const (
	// MaxPreferenceRunes is the longest request accepted.
	MaxPreferenceRunes = 200
	maxPreferenceWords = 6
)

var (
	controlChars = regexp.MustCompile(`[\x00-\x1f\x7f]`)
	wordPattern  = regexp.MustCompile(`[\p{L}']+`)
)

// Words that carry no food: they are not matched against product names.
var stopWords = map[string]bool{
	"the": true, "and": true, "not": true, "dont": true, "don't": true, "didnt": true, "didn't": true,
	"want": true, "wanted": true, "wants": true, "instead": true, "rather": true, "than": true,
	"some": true, "any": true, "something": true, "more": true, "less": true, "with": true,
	"without": true, "for": true, "please": true, "like": true, "prefer": true, "give": true,
	"get": true, "add": true, "need": true, "but": true, "one": true, "can": true, "could": true,
	"would": true, "should": true, "too": true, "very": true, "also": true, "just": true,
	"only": true, "else": true, "other": true, "another": true, "different": true, "choose": true,
	"pick": true, "try": true,
}

// CleanPreference removes control characters and collapses whitespace.
func CleanPreference(s string) string {
	return strings.Join(strings.Fields(controlChars.ReplaceAllString(s, " ")), " ")
}

// PreferenceWords returns the food words in a request, lowercase, in order, without repeats, at most six.
func PreferenceWords(s string) []string {
	var out []string
	seen := map[string]bool{}
	for _, w := range wordPattern.FindAllString(strings.ToLower(s), -1) {
		w = strings.Trim(w, "'")
		if utf8.RuneCountInString(w) < 3 || stopWords[w] || seen[w] {
			continue
		}
		seen[w] = true
		out = append(out, w)
		if len(out) == maxPreferenceWords {
			break
		}
	}
	return out
}

// MissKind is why nothing the shopper asked for could be suggested. A higher value means the request got
// closer to being suggested, and the closest reason is the one worth telling the shopper.
type MissKind int

const (
	MissNone    MissKind = iota // no product in the store matches the words
	MissProfile                 // every match conflicts with the diet or an allergy
	MissProtein                 // the matches are not high-protein picks in the data
	MissBudget                  // the matches cost more than the budget left
	MissGap                     // a pack has more protein than the shopper still needs
	MissInCart                  // the shopper already has it
	MissRemoved                 // the shopper removed it earlier
	MissCovered                 // the protein goal is already met, so nothing is added at all
	MissSpent                   // the budget is already used up, so nothing is added at all
)

// Miss is the reason a request was left out. Cause names the diet or allergy for MissProfile.
type Miss struct {
	Kind  MissKind
	Cause string
}

// closer reports whether m got further towards being suggested than o.
func (m Miss) closer(o Miss) bool { return m.Kind > o.Kind }

// PreferenceMessage explains, in plain words, why what the shopper asked for was not suggested.
// It is empty when nothing was asked or something matching was found.
func PreferenceMessage(preference string, matches int, miss Miss) string {
	if preference == "" || matches > 0 {
		return ""
	}
	short := preference
	if r := []rune(short); len(r) > 40 {
		short = string(r[:40]) + "…"
	}
	switch miss.Kind {
	case MissProfile:
		return fmt.Sprintf("Coach left out \"%s\" because your profile says %s. Use Edit in \"What Coach understood\" if that's not right.", short, miss.Cause)
	case MissProtein:
		return fmt.Sprintf("\"%s\" isn't a high-protein pick in the demo data, so Coach left it out.", short)
	case MissBudget:
		return fmt.Sprintf("\"%s\" costs more than the budget you have left.", short)
	case MissGap:
		return fmt.Sprintf("A pack of \"%s\" has more protein than you still need, so Coach left it out.", short)
	case MissInCart:
		return fmt.Sprintf("You already have \"%s\" in your cart.", short)
	case MissRemoved:
		return fmt.Sprintf("You removed the \"%s\" Coach showed, so it won't suggest it again.", short)
	case MissCovered:
		return fmt.Sprintf("Your protein goal is already covered, so Coach has nothing to add, including \"%s\".", short)
	case MissSpent:
		return fmt.Sprintf("Your cart already uses your whole budget, so Coach can't add \"%s\".", short)
	}
	return fmt.Sprintf("Coach couldn't find \"%s\" in the store.", short)
}
