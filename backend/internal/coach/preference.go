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

// PreferenceMessage explains, in plain words, when nothing eligible matched the request.
func PreferenceMessage(preference string, matches int) string {
	if preference == "" || matches > 0 {
		return ""
	}
	short := preference
	if r := []rune(short); len(r) > 40 {
		short = string(r[:40]) + "…"
	}
	return fmt.Sprintf("Nothing matching \"%s\" fits your goal, diet and budget, so these are the best alternatives.", short)
}
