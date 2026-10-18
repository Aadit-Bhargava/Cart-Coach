package coach

import (
	"reflect"
	"testing"
)

func TestCleanUnderstandingActivity(t *testing.T) {
	for in, want := range map[string]string{
		"yoga":        "general",
		" Endurance ": "endurance",
		"STRENGTH":    "strength",
		"active":      "active",
		"":            "general",
		"marathoner":  "general",
	} {
		u := Understanding{Activity: in}
		CleanUnderstanding(&u)
		if u.Activity != want {
			t.Errorf("activity %q cleaned to %q, want %q", in, u.Activity, want)
		}
	}
}

func TestCleanUnderstandingStatedDailyProtein(t *testing.T) {
	for in, want := range map[int]int{3000: 0, 39: 0, -5: 0, 0: 0, 40: 40, 140: 140, 220: 220, 221: 0} {
		u := Understanding{StatedDailyProteinG: in}
		CleanUnderstanding(&u)
		if u.StatedDailyProteinG != want {
			t.Errorf("stated %d cleaned to %d, want %d", in, u.StatedDailyProteinG, want)
		}
	}
}

func TestCleanUnderstandingDietAndLists(t *testing.T) {
	u := Understanding{Diet: "carnivore"}
	CleanUnderstanding(&u)
	if u.Diet != "unknown" {
		t.Errorf("an invented diet must become unknown, got %q", u.Diet)
	}
	u = Understanding{Diet: "veg"}
	CleanUnderstanding(&u)
	if u.Diet != "veg" {
		t.Errorf("a valid diet must stay, got %q", u.Diet)
	}

	u = Understanding{
		Allergies: []string{"  Peanuts ", "peanuts", ""},
		Likes:     []string{"Paneer", "OATS", "a", "b", "c", "d", "e", "f", "g"},
	}
	CleanUnderstanding(&u)
	if want := []string{"peanuts"}; !reflect.DeepEqual(u.Allergies, want) {
		t.Errorf("allergies = %v, want %v", u.Allergies, want)
	}
	if len(u.Likes) != 8 || u.Likes[0] != "paneer" || u.Likes[1] != "oats" {
		t.Errorf("likes must be lowercased and capped at 8, got %v", u.Likes)
	}
}
