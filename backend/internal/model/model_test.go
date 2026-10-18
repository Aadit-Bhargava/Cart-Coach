package model

import "testing"

func complete() Profile {
	age, weight, height := 30, 72.0, 175.0
	return Profile{
		ProteinTargetG: 9999, Diet: "veg", Budget: 600, AutoAdd: true,
		AgeYears: &age, WeightKg: &weight, HeightCm: &height,
		Activity: "endurance", Days: 3, DailyProteinG: 110,
	}
}

func TestDetailsComplete(t *testing.T) {
	if !complete().DetailsComplete() {
		t.Fatal("a fully filled profile must be complete")
	}
	missing := map[string]func(*Profile){
		"age":      func(p *Profile) { p.AgeYears = nil },
		"weight":   func(p *Profile) { p.WeightKg = nil },
		"height":   func(p *Profile) { p.HeightCm = nil },
		"activity": func(p *Profile) { p.Activity = "" },
		"days":     func(p *Profile) { p.Days = 0 },
		"daily":    func(p *Profile) { p.DailyProteinG = 0 },
	}
	for name, clear := range missing {
		p := complete()
		clear(&p)
		if p.DetailsComplete() {
			t.Errorf("a profile without %s must not be complete", name)
		}
	}
	// A profile saved before these fields existed.
	legacy := Profile{ProteinTargetG: 110, Diet: "veg", Budget: 600}
	if legacy.DetailsComplete() {
		t.Error("a legacy profile with no stats must not be complete")
	}
}

func TestValidateDetails(t *testing.T) {
	ok := complete()
	if err := ok.ValidateDetails(); err != nil {
		t.Fatalf("valid details rejected: %v", err)
	}

	cases := []struct {
		name   string
		change func(*Profile)
		want   string
	}{
		{"days 2", func(p *Profile) { p.Days = 2 }, "Choose 1, 3 or 7 days."},
		{"activity yoga", func(p *Profile) { p.Activity = "yoga" }, "Choose an activity level from the list."},
		{"daily 39", func(p *Profile) { p.DailyProteinG = 39 }, "Choose a daily protein amount between 40 and 220 g."},
		{"daily 221", func(p *Profile) { p.DailyProteinG = 221 }, "Choose a daily protein amount between 40 and 220 g."},
		{"no age", func(p *Profile) { p.AgeYears = nil }, "Enter your age (18 to 100)."},
		{"no weight", func(p *Profile) { p.WeightKg = nil }, "Enter your weight in kg (30 to 250)."},
		{"no height", func(p *Profile) { p.HeightCm = nil }, "Enter your height in cm (120 to 230)."},
	}
	for _, c := range cases {
		p := complete()
		c.change(&p)
		err := p.ValidateDetails()
		if err == nil || err.Error() != c.want {
			t.Errorf("%s: error = %v, want %q", c.name, err, c.want)
		}
	}
}

func TestApplyTargetIgnoresStoredValue(t *testing.T) {
	p := complete() // ProteinTargetG starts at 9999, as if the browser had sent it
	p.ApplyTarget()
	if p.ProteinTargetG != 330 {
		t.Errorf("ProteinTargetG = %d, want 330 (110 g x 3 days)", p.ProteinTargetG)
	}
}

func TestValidateNoLongerChecksTheCartTarget(t *testing.T) {
	p := Profile{ProteinTargetG: 9999, Diet: "veg", Budget: 600}
	if err := p.Validate(); err != nil {
		t.Errorf("Validate must leave the cart target to ApplyTarget, got %v", err)
	}
}
