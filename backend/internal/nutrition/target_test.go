package nutrition

import (
	"math"
	"testing"
)

func TestDailyProteinWorkedExamples(t *testing.T) {
	cases := []struct {
		name  string
		stats Stats
		act   Activity
		want  int
	}{
		{"endurance athlete", Stats{30, 72, 175}, Endurance, 110},
		{"heavy for height is capped", Stats{40, 120, 170}, General, 75},
		{"older adult, general", Stats{70, 60, 165}, General, 60},
		{"light and general hits the floor", Stats{25, 50, 160}, General, 40},
	}
	for _, c := range cases {
		got, _ := DailyProtein(c.stats, c.act)
		if got != c.want {
			t.Errorf("%s: DailyProtein = %d, want %d", c.name, got, c.want)
		}
	}
	_, basis := DailyProtein(Stats{30, 72, 175}, Endurance)
	if want := "1.5 g per kg of body weight, for endurance training"; basis != want {
		t.Errorf("basis = %q, want %q", basis, want)
	}
}

func TestDailyProteinFactors(t *testing.T) {
	s := Stats{30, 80, 180}
	for act, want := range map[Activity]int{General: 65, Active: 95, Endurance: 120, Strength: 130} {
		if got, _ := DailyProtein(s, act); got != want {
			t.Errorf("%s: got %d, want %d", act, got, want)
		}
	}
}

func TestDailyProteinAgeSixtyFive(t *testing.T) {
	if got, _ := DailyProtein(Stats{64, 70, 175}, General); got != 55 {
		t.Errorf("age 64 = %d, want 55", got)
	}
	if got, _ := DailyProtein(Stats{65, 70, 175}, General); got != 70 {
		t.Errorf("age 65 = %d, want 70", got)
	}
}

func TestDailyProteinClampsExtremeBodies(t *testing.T) {
	if got, _ := DailyProtein(Stats{30, 250, 160}, Strength); got != 220 {
		t.Errorf("250 kg at 160 cm = %d, want 220", got)
	}
	if got, _ := DailyProtein(Stats{25, 30, 160}, General); got != 40 {
		t.Errorf("30 kg at 160 cm = %d, want 40", got)
	}
}

func TestResolveDailyStatedOverride(t *testing.T) {
	s := Stats{30, 72, 175}
	if got, basis := ResolveDaily(s, Endurance, 140); got != 140 || basis != "the amount you gave" {
		t.Errorf("stated 140 = %d, %q", got, basis)
	}
	if got, _ := ResolveDaily(s, Endurance, 220); got != 220 {
		t.Errorf("stated 220 = %d, want 220", got)
	}
	ruleGrams, ruleBasis := DailyProtein(s, Endurance)
	for _, stated := range []int{0, 39, 3000, -5} {
		got, basis := ResolveDaily(s, Endurance, stated)
		if got != ruleGrams || basis != ruleBasis {
			t.Errorf("stated %d must fall back to the rule, got %d, %q", stated, got, basis)
		}
	}
}

func TestStatsValidate(t *testing.T) {
	if err := (Stats{30, 72, 175}).Validate(); err != nil {
		t.Fatalf("valid stats rejected: %v", err)
	}
	ageMsg := "Enter your age (18 to 100)."
	weightMsg := "Enter your weight in kg (30 to 250)."
	heightMsg := "Enter your height in cm (120 to 230)."
	cases := []struct {
		name  string
		stats Stats
		want  string
	}{
		{"age 17", Stats{17, 72, 175}, ageMsg},
		{"age 101", Stats{101, 72, 175}, ageMsg},
		{"weight 29.9", Stats{30, 29.9, 175}, weightMsg},
		{"weight 250.1", Stats{30, 250.1, 175}, weightMsg},
		{"weight NaN", Stats{30, math.NaN(), 175}, weightMsg},
		{"weight +Inf", Stats{30, math.Inf(1), 175}, weightMsg},
		{"height 119.9", Stats{30, 72, 119.9}, heightMsg},
		{"height 230.1", Stats{30, 72, 230.1}, heightMsg},
		{"height NaN", Stats{30, 72, math.NaN()}, heightMsg},
	}
	for _, c := range cases {
		err := c.stats.Validate()
		if err == nil || err.Error() != c.want {
			t.Errorf("%s: error = %v, want %q", c.name, err, c.want)
		}
	}
}

func TestCartTarget(t *testing.T) {
	for _, c := range []struct{ daily, days, want int }{{110, 3, 330}, {40, 1, 40}, {220, 7, 1540}} {
		if got := CartTarget(c.daily, c.days); got != c.want {
			t.Errorf("CartTarget(%d,%d) = %d, want %d", c.daily, c.days, got, c.want)
		}
	}
}

func TestParseActivity(t *testing.T) {
	for _, s := range []string{"general", "active", "endurance", "strength"} {
		if a, ok := ParseActivity(s); !ok || string(a) != s {
			t.Errorf("ParseActivity(%q) = %q, %v", s, a, ok)
		}
	}
	for _, s := range []string{"", "yoga", "Endurance"} {
		if _, ok := ParseActivity(s); ok {
			t.Errorf("ParseActivity(%q) should not parse", s)
		}
	}
}
