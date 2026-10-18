package coach

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/aaditbhargava/cart-coach/internal/model"
	"github.com/aaditbhargava/cart-coach/internal/repository"
)

type Service struct {
	products  *repository.ProductRepository
	gemini    *Gemini
	decisions *repository.DecisionRepository
	profiles  *repository.ProfileRepository
}

func NewService(products *repository.ProductRepository, gemini *Gemini, decisions *repository.DecisionRepository, profiles *repository.ProfileRepository) *Service {
	return &Service{products: products, gemini: gemini, decisions: decisions, profiles: profiles}
}

func (s *Service) Gemini() *Gemini { return s.gemini }

// ErrDetailsMissing means the saved profile has no age, weight and height yet.
var ErrDetailsMissing = errors.New("profile details missing")

// ErrAutoAddOff means the user has not opted in to suggestions.
var ErrAutoAddOff = errors.New("auto-add is off")

type SuggestResult struct {
	Suggestions []model.Suggestion `json:"suggestions"`
	Log         model.Decision     `json:"log"`
	// Message is shown in the cart, e.g. when nothing matched what the shopper asked for.
	Message string `json:"message,omitempty"`
}

// Suggest plans, asks Gemini to choose, verifies the choice and logs it. If
// Gemini is unavailable it falls back to the plain ranking and says so in the log.
func (s *Service) Suggest(ctx context.Context, userID int64, cart []model.CartItem, excluded []int64, preference string) (*SuggestResult, error) {
	saved, err := s.profiles.Get(ctx, userID)
	if errors.Is(err, repository.ErrProfileNotFound) || (err == nil && !saved.DetailsComplete) {
		return nil, ErrDetailsMissing
	}
	if err != nil {
		return nil, err
	}
	if !saved.AutoAdd {
		return nil, ErrAutoAddOff
	}
	in := Input{Profile: saved.Profile, Cart: cart, Excluded: excluded, Days: saved.Days, DailyProteinG: saved.DailyProteinG, Preference: CleanPreference(preference)}

	all, err := s.products.All(ctx)
	if err != nil {
		return nil, err
	}
	byID, _ := s.products.ByID(ctx)
	plan := BuildPlan(all, in)

	res := &SuggestResult{Suggestions: []model.Suggestion{}}
	if len(plan.Candidates) == 0 {
		res.Log = model.Decision{Title: "No suggestions needed", Detail: noneDetail(plan)}
		s.record(ctx, userID, res.Log)
		return res, nil
	}

	cartNames := []string{}
	for _, it := range in.Cart {
		if p, ok := byID[it.ProductID]; ok {
			cartNames = append(cartNames, p.Name)
		}
	}

	source := "picked by Coach"
	choices, err := s.gemini.Choose(ctx, in.Profile, cartNames, plan)
	if err != nil {
		log.Printf("coach: gemini choose failed, using fallback ranking: %v", err)
		source = "Coach's AI was unavailable, so items were ranked by protein per rupee instead"
		choices = nil
	}
	if err == nil && len(choices) == 0 {
		// The model looked at the shortlist and chose nothing: respect that.
		res.Log = model.Decision{Title: "No suggestions needed", Detail: "Coach didn't find anything that fits your goal better than what is already in your cart."}
		s.record(ctx, userID, res.Log)
		return res, nil
	}
	if choices != nil {
		res.Suggestions = Verify(choices, plan)
	}
	if len(res.Suggestions) == 0 {
		// The call failed, or none of the model's picks passed verification: use the ranking.
		res.Suggestions = Fallback(plan)
		if choices != nil {
			source = "Coach's first picks didn't pass our checks, so items were ranked by protein per rupee instead"
		}
	}

	protein, cost := 0.0, 0.0
	lines := make([]string, 0, len(res.Suggestions))
	for _, sg := range res.Suggestions {
		p := byID[sg.ProductID]
		protein += sg.ProteinG
		cost += sg.Price
		lines = append(lines, fmt.Sprintf("%s: %s g protein per 100 g × pack = %s g; ₹%s (demo price)", p.Name, trim(*p.ProteinG), trim(sg.ProteinG), trim(sg.Price)))
	}
	res.Log = model.Decision{
		Title:  fmt.Sprintf("Coach suggests %d %s (+%s g protein, +₹%s)", len(res.Suggestions), plural(len(res.Suggestions)), trim(round1(protein)), trim(cost)),
		Detail: strings.Join(lines, " | ") + ". Numbers come from the product catalog (demo data); " + source + "." + askedFor(in.Preference),
	}
	res.Message = PreferenceMessage(plan.Preference, plan.PreferenceMatches)
	s.record(ctx, userID, res.Log)
	return res, nil
}

func noneDetail(plan Plan) string {
	switch {
	case plan.Gap < minGap:
		return "Your protein goal is covered by your own items."
	case plan.BudgetLeft <= 0:
		return "Your cart already uses your whole budget."
	default:
		return "Nothing in the catalog fits your goal, diet, allergies and budget."
	}
}

func plural(n int) string {
	if n == 1 {
		return "item"
	}
	return "items"
}

func (s *Service) record(ctx context.Context, userID int64, d model.Decision) {
	if err := s.decisions.Add(ctx, userID, d); err != nil {
		log.Printf("coach: could not save decision log entry: %v", err)
	}
}

// askedFor adds the shopper's own request to the decision log entry.
func askedFor(preference string) string {
	if preference == "" {
		return ""
	}
	return " You asked for: " + preference + "."
}
