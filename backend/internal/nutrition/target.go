// Package nutrition holds the documented rule that turns a person's age, weight,
// height and activity into a daily protein target.
//
// The factors follow common sports-nutrition ranges. They are general guidance,
// not medical advice and not a clinically validated model. The user can always
// edit the number.
//
// frontend/src/lib/target.ts mirrors this file for demo mode. Change both together.
package nutrition

import (
	"errors"
	"fmt"
	"math"
)

type Activity string

const (
	General   Activity = "general"
	Active    Activity = "active"
	Endurance Activity = "endurance"
	Strength  Activity = "strength"
)

const (
	MinDaily = 40
	MaxDaily = 220
)

// AllowedDays are the periods a cart can cover.
var AllowedDays = []int{1, 3, 7}

func ParseActivity(s string) (Activity, bool) {
	switch a := Activity(s); a {
	case General, Active, Endurance, Strength:
		return a, true
	}
	return "", false
}

type Stats struct {
	AgeYears int
	WeightKg float64
	HeightCm float64
}

// Validate checks the ranges, with messages that are shown to people as written.
func (s Stats) Validate() error {
	if s.AgeYears < 18 || s.AgeYears > 100 {
		return errors.New("Enter your age (18 to 100).")
	}
	if !inRange(s.WeightKg, 30, 250) {
		return errors.New("Enter your weight in kg (30 to 250).")
	}
	if !inRange(s.HeightCm, 120, 230) {
		return errors.New("Enter your height in cm (120 to 230).")
	}
	return nil
}

func inRange(v, lo, hi float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0) && v >= lo && v <= hi
}

func factor(s Stats, a Activity) (float64, string) {
	switch a {
	case Active:
		return 1.2, "regular exercise"
	case Endurance:
		return 1.5, "endurance training"
	case Strength:
		return 1.6, "strength training"
	}
	if s.AgeYears >= 65 {
		return 1.0, "everyday movement"
	}
	return 0.8, "everyday movement"
}

// referenceWeight is the weight the rule is applied to. Height is used only
// here, as a safety cap: far above the weight at BMI 25, only part of the excess
// counts, so nobody gets an extreme target. It is never shown to the user.
func referenceWeight(s Stats) float64 {
	h := s.HeightCm / 100
	w25 := 25 * h * h
	if s.WeightKg > 1.2*w25 {
		return w25 + 0.4*(s.WeightKg-w25)
	}
	return s.WeightKg
}

// DailyProtein returns the daily protein target in grams, rounded to the nearest
// 5 and kept between MinDaily and MaxDaily, with a plain sentence explaining it.
// The caller must have validated the stats.
func DailyProtein(s Stats, a Activity) (grams int, basis string) {
	f, label := factor(s, a)
	g := int(math.Round(referenceWeight(s)*f/5)) * 5
	return clamp(g), fmt.Sprintf("%.1f g per kg of body weight, for %s", f, label)
}

// ResolveDaily uses an amount the user stated ("about 140 g protein") when it is
// inside the allowed range, and the rule otherwise.
func ResolveDaily(s Stats, a Activity, stated int) (grams int, basis string) {
	if stated >= MinDaily && stated <= MaxDaily {
		return stated, "the amount you gave"
	}
	return DailyProtein(s, a)
}

// CartTarget is the protein a cart should cover: the daily target for each day.
func CartTarget(daily, days int) int { return daily * days }

func clamp(g int) int { return min(MaxDaily, max(MinDaily, g)) }
