package coach

import (
	"reflect"
	"strings"
	"testing"

	"github.com/aaditbhargava/cart-coach/internal/model"
)

func TestCleanPreference(t *testing.T) {
	for in, want := range map[string]string{
		"  paneer  ":                  "paneer",
		"paneer\n\n instead\tof  dal": "paneer instead of dal",
		"pan\x00eer\x07":              "pan eer",
		"   ":                         "",
		"":                            "",
	} {
		if got := CleanPreference(in); got != want {
			t.Errorf("CleanPreference(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestPreferenceWords(t *testing.T) {
	cases := []struct {
		in   string
		want []string
	}{
		{"paneer", []string{"paneer"}},
		{"I didn't want rajma, wanted Paneer instead!", []string{"rajma", "paneer"}},
		{"some more peanuts please", []string{"peanuts"}},
		{"ok", nil},
		{"", nil},
		{"paneer paneer PANEER", []string{"paneer"}},
		{"a b c oats dal tofu curd rajma makhana chana", []string{"oats", "dal", "tofu", "curd", "rajma", "makhana"}}, // capped at 6
	}
	for _, c := range cases {
		got := PreferenceWords(c.in)
		if len(got) == 0 && len(c.want) == 0 {
			continue
		}
		if !reflect.DeepEqual(got, c.want) {
			t.Errorf("PreferenceWords(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestPreferenceMessage(t *testing.T) {
	if got := PreferenceMessage("", 0); got != "" {
		t.Errorf("no preference must give no message, got %q", got)
	}
	if got := PreferenceMessage("paneer", 3); got != "" {
		t.Errorf("a preference that matched must give no message, got %q", got)
	}
	got := PreferenceMessage("sushi", 0)
	if !strings.Contains(got, "sushi") || !strings.Contains(got, "fits your goal, diet and budget") {
		t.Errorf("message = %q", got)
	}
	long := PreferenceMessage(strings.Repeat("x", 100), 0)
	if strings.Count(long, "x") > 40 {
		t.Errorf("a long request must be shortened in the message, got %q", long)
	}
}

func prefProfile() model.Profile {
	return model.Profile{ProteinTargetG: 330, Diet: "veg", Budget: 2000}
}

func TestBuildPlanPrefersWhatTheShopperAskedFor(t *testing.T) {
	all := []model.Product{
		prod(1, "Kisan Fresh Rajma 1 kg", "Staples", "veg", 100, 22),            // 220 g in the pack: best protein per rupee
		prod(2, "Sunrise Foods Paneer 200 g", "Dairy", "veg", 170, 18, "dairy"), // 36 g
	}
	plain := BuildPlan(all, Input{Profile: prefProfile(), Days: 3, DailyProteinG: 110})
	if got := plain.Candidates[0].Product.ID; got != 1 {
		t.Fatalf("without a preference the best protein per rupee should lead, got product %d", got)
	}
	asked := BuildPlan(all, Input{Profile: prefProfile(), Days: 3, DailyProteinG: 110, Preference: "paneer"})
	if got := asked.Candidates[0].Product.ID; got != 2 {
		t.Errorf("with a preference for paneer, paneer should lead, got product %d", got)
	}
	if asked.PreferenceMatches != 1 {
		t.Errorf("PreferenceMatches = %d, want 1", asked.PreferenceMatches)
	}
}

func TestBuildPlanWidensTheShortlistWhenAsked(t *testing.T) {
	var all []model.Product
	for i := 1; i <= 70; i++ { // 70 generic items, all with better protein per rupee than the paneer
		all = append(all, prod(int64(i), "Generic Peanuts "+strings.Repeat("x", i%3)+" 100 g", "Snacks", "veg", float64(20+i), 25))
	}
	all = append(all, prod(999, "Slow Paneer 100 g", "Dairy", "veg", 400, 18, "dairy"))

	plain := BuildPlan(all, Input{Profile: prefProfile(), Days: 3, DailyProteinG: 110})
	if len(plain.Candidates) != maxCandidates {
		t.Fatalf("a plain shortlist holds %d, got %d", maxCandidates, len(plain.Candidates))
	}
	for _, c := range plain.Candidates {
		if c.Product.ID == 999 {
			t.Fatal("the slow paneer should not be on the plain shortlist")
		}
	}
	asked := BuildPlan(all, Input{Profile: prefProfile(), Days: 3, DailyProteinG: 110, Preference: "paneer"})
	if asked.Candidates[0].Product.ID != 999 {
		t.Errorf("the asked-for paneer must lead the shortlist, got product %d", asked.Candidates[0].Product.ID)
	}
	if len(asked.Candidates) <= maxCandidates || len(asked.Candidates) > maxCandidatesWithPreference {
		t.Errorf("with a preference the shortlist widens, got %d", len(asked.Candidates))
	}
}

func TestAPreferenceNeverOverridesDietOrAllergies(t *testing.T) {
	all := []model.Product{
		prod(1, "Daily Catch Chicken Breast 500 g", "Meat, Fish and Eggs", "non-veg", 300, 30),
		prod(2, "Sunrise Foods Paneer 200 g", "Dairy", "veg", 170, 18, "dairy"),
	}
	plan := BuildPlan(all, Input{Profile: prefProfile(), Days: 3, DailyProteinG: 110, Preference: "chicken"})
	for _, c := range plan.Candidates {
		if c.Product.ID == 1 {
			t.Fatal("a vegetarian asking for chicken must not be offered chicken")
		}
	}
	if plan.PreferenceMatches != 0 {
		t.Errorf("PreferenceMatches = %d, want 0 (the match was filtered out by diet)", plan.PreferenceMatches)
	}

	allergic := prefProfile()
	allergic.Allergies = []string{"dairy"}
	plan = BuildPlan(all, Input{Profile: allergic, Days: 3, DailyProteinG: 110, Preference: "paneer"})
	for _, c := range plan.Candidates {
		if c.Product.ID == 2 {
			t.Fatal("a dairy allergy must beat a request for paneer")
		}
	}
}

func TestBuildPlanListsWhatTheShopperRejected(t *testing.T) {
	all := []model.Product{
		prod(1, "Kisan Fresh Rajma 1 kg", "Staples", "veg", 100, 22),
		prod(2, "Sunrise Foods Paneer 200 g", "Dairy", "veg", 170, 18, "dairy"),
	}
	plan := BuildPlan(all, Input{Profile: prefProfile(), Days: 3, DailyProteinG: 110, Excluded: []int64{1}, Preference: "paneer"})
	if !reflect.DeepEqual(plan.Rejected, []string{"Kisan Fresh Rajma 1 kg"}) {
		t.Errorf("Rejected = %v", plan.Rejected)
	}
}
