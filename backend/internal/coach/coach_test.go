package coach

import (
	"testing"

	"github.com/aaditbhargava/cart-coach/internal/model"
)

func prod(id int64, name, cat, diet string, price, protein float64, allergens ...string) model.Product {
	if allergens == nil {
		allergens = []string{}
	}
	return model.Product{ID: id, Name: name, Category: &cat, Price: price, ProteinG: &protein, Diet: diet, Allergens: allergens}
}

func TestPackGrams(t *testing.T) {
	cases := []struct {
		name string
		want float64
		ok   bool
	}{
		{"Kisan Fresh Masala Peanuts 150 g", 150, true},
		{"Whole Wheat Atta 5 kg", 5000, true},
		{"Toned Milk 1 L", 0, false},
		{"Frozen Paratha 10 pcs", 0, false},
		{"Plain Name", 0, false},
	}
	for _, c := range cases {
		got, ok := PackGrams(c.name)
		if got != c.want || ok != c.ok {
			t.Errorf("PackGrams(%q) = %v, %v; want %v, %v", c.name, got, ok, c.want, c.ok)
		}
	}
}

func TestPackProteinRejectsImpossibleValues(t *testing.T) {
	if _, ok := PackProtein(prod(1, "Odd Bar 100 g", "Snacks", "veg", 10, 120)); ok {
		t.Error("protein over 100 g per 100 g must be treated as unknown")
	}
	if got, ok := PackProtein(prod(2, "Peanuts 150 g", "Snacks", "veg", 10, 25)); !ok || got != 37.5 {
		t.Errorf("got %v, %v; want 37.5, true", got, ok)
	}
}

func TestAllowed(t *testing.T) {
	chicken := prod(1, "Chicken Sausages 250 g", "Meat, Fish and Eggs", "non-veg", 100, 12)
	egg := prod(2, "Farm Eggs 12 pcs", "Meat, Fish and Eggs", "egg", 100, 12, "egg")
	paneer := prod(3, "Paneer 200 g", "Dairy", "veg", 100, 18, "dairy")
	peanuts := prod(4, "Masala Peanuts 150 g", "Snacks", "veg", 50, 24, "peanuts")
	unknown := prod(5, "Mystery 100 g", "Snacks", "unknown", 50, 20)

	check := func(diet string, allergies []string, p model.Product, want bool) {
		t.Helper()
		if got := Allowed(model.Profile{Diet: diet, Allergies: allergies}, p); got != want {
			t.Errorf("diet=%s allergies=%v %s: got %v want %v", diet, allergies, p.Name, got, want)
		}
	}
	check("veg", nil, chicken, false)
	check("veg", nil, egg, false)
	check("veg", nil, paneer, true)
	check("eggetarian", nil, egg, true)
	check("eggetarian", nil, chicken, false)
	check("vegan", nil, paneer, false)
	check("vegan", nil, peanuts, true)
	check("non-veg", nil, chicken, true)
	check("veg", nil, unknown, false)    // declared diet and unknown product: not allowed
	check("unknown", nil, unknown, true) // nothing declared: nothing to conflict with
	check("veg", []string{"peanuts"}, peanuts, false)
	check("veg", []string{"peanut"}, peanuts, false) // alias
	check("veg", []string{"lactose"}, paneer, false)
	check("veg", []string{"masala"}, peanuts, false) // untagged allergy falls back to the name
}

func TestBuildPlanFiltersByGapBudgetAndCart(t *testing.T) {
	all := []model.Product{
		prod(1, "Paneer 200 g", "Dairy", "veg", 100, 18, "dairy"),           // 36 g in cart
		prod(2, "Masala Peanuts 150 g", "Snacks", "veg", 50, 24, "peanuts"), // 36 g: fits gap of 64
		prod(3, "Rajma 1 kg", "Staples", "veg", 100, 22),                    // 220 g: more than the gap
		prod(4, "Pricey Protein 100 g", "Snacks", "veg", 900, 60),           // over budget
		prod(5, "Turmeric 100 g", "Spices", "veg", 20, 20),                  // skipped category
		prod(6, "Low Protein Chips 100 g", "Snacks", "veg", 20, 6),          // under 15 g per 100 g
		prod(7, "Roasted Makhana 80 g", "Snacks", "veg", 90, 20),            // 16 g
	}
	plan := BuildPlan(all, Input{
		Profile: model.Profile{ProteinTargetG: 100, Diet: "veg", Budget: 600},
		Cart:    []model.CartItem{{ProductID: 1, Quantity: 1}},
	})
	if got := plan.Have; got != 36 {
		t.Fatalf("have = %v, want 36", got)
	}
	ids := []int64{}
	for _, c := range plan.Candidates {
		ids = append(ids, c.Product.ID)
	}
	if len(ids) != 2 || ids[0] != 2 || ids[1] != 7 {
		t.Errorf("candidates = %v, want [2 7]", ids)
	}

	plan = BuildPlan(all, Input{
		Profile:  model.Profile{ProteinTargetG: 100, Diet: "veg", Budget: 600},
		Cart:     []model.CartItem{{ProductID: 1, Quantity: 1}},
		Excluded: []int64{2},
	})
	if len(plan.Candidates) != 1 || plan.Candidates[0].Product.ID != 7 {
		t.Errorf("excluded product must not come back: %+v", plan.Candidates)
	}
}

func TestBuildPlanStopsWhenGoalIsCovered(t *testing.T) {
	all := []model.Product{prod(1, "Paneer 500 g", "Dairy", "veg", 100, 18)} // 90 g
	plan := BuildPlan(all, Input{
		Profile: model.Profile{ProteinTargetG: 90, Diet: "veg", Budget: 600},
		Cart:    []model.CartItem{{ProductID: 1, Quantity: 1}},
	})
	if len(plan.Candidates) != 0 {
		t.Errorf("no suggestions expected when the goal is covered, got %d", len(plan.Candidates))
	}
}

func TestVerifyDoesNotTrustTheModel(t *testing.T) {
	a := prod(1, "Masala Peanuts 150 g", "Snacks", "veg", 57, 24.6) // 36.9 g
	b := prod(2, "Roasted Chana 200 g", "Snacks", "veg", 70, 20)    // 40 g
	plan := Plan{
		Gap: 50, BudgetLeft: 100,
		Candidates: []Candidate{
			{Product: a, PackProtein: 36.9, ProteinPerRupee: 0.65},
			{Product: b, PackProtein: 40, ProteinPerRupee: 0.57},
		},
	}
	got := Verify([]Choice{
		{ProductID: 999, Why: "not a candidate"},           // unknown id: dropped
		{ProductID: 1, Why: "Good source of 99 g protein"}, // number in why: why is dropped, pick stays
		{ProductID: 1, Why: "duplicate"},                   // duplicate: dropped
		{ProductID: 2, Why: "Crunchy and filling"},         // would push protein past the gap: dropped
	}, plan)
	if len(got) != 1 {
		t.Fatalf("got %d suggestions, want 1: %+v", len(got), got)
	}
	s := got[0]
	if s.ProductID != 1 || s.ProteinG != 36.9 || s.Price != 57 {
		t.Errorf("numbers must come from the catalog: %+v", s)
	}
	if s.Why != "" {
		t.Errorf("a why containing digits must be dropped, got %q", s.Why)
	}
	if s.Reason != "+36.9 g protein, ₹57 more" {
		t.Errorf("reason = %q", s.Reason)
	}
}

func TestProfileValidate(t *testing.T) {
	ok := model.Profile{ProteinTargetG: 110, Diet: "veg", Budget: 600, Allergies: []string{" Peanuts ", "peanuts", ""}}
	if err := ok.Validate(); err != nil {
		t.Fatal(err)
	}
	if len(ok.Allergies) != 1 || ok.Allergies[0] != "peanuts" {
		t.Errorf("allergies not cleaned: %v", ok.Allergies)
	}
	for _, bad := range []model.Profile{
		{ProteinTargetG: 10, Diet: "veg", Budget: 600},
		{ProteinTargetG: 110, Diet: "carnivore", Budget: 600},
		{ProteinTargetG: 110, Diet: "veg", Budget: 5},
	} {
		if bad.Validate() == nil {
			t.Errorf("expected an error for %+v", bad)
		}
	}
}
