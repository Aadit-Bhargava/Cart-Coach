package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aaditbhargava/cart-coach/internal/model"
)

var ErrProfileNotFound = errors.New("profile not found")

type ProfileRepository struct{ pool *pgxpool.Pool }

func NewProfileRepository(pool *pgxpool.Pool) *ProfileRepository {
	return &ProfileRepository{pool: pool}
}

func (r *ProfileRepository) Get(ctx context.Context, userID int64) (*model.SavedProfile, error) {
	var p model.SavedProfile
	var age, days, daily *int32
	var weight, height *float64
	var activity *string
	err := r.pool.QueryRow(ctx,
		`select goal_text, protein_target_g, diet, allergies, likes, budget::float8, auto_add,
		        age_years, weight_kg::float8, height_cm::float8, activity, days, daily_protein_g
		 from user_profiles where user_id = $1`, userID,
	).Scan(&p.GoalText, &p.ProteinTargetG, &p.Diet, &p.Allergies, &p.Likes, &p.Budget, &p.AutoAdd,
		&age, &weight, &height, &activity, &days, &daily)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrProfileNotFound
	}
	if err != nil {
		return nil, err
	}
	// Columns are NULL for profiles saved before the personal details existed.
	if age != nil {
		v := int(*age)
		p.AgeYears = &v
	}
	p.WeightKg, p.HeightCm = weight, height
	if activity != nil {
		p.Activity = *activity
	}
	if days != nil {
		p.Days = int(*days)
	}
	if daily != nil {
		p.DailyProteinG = int(*daily)
	}
	p.DetailsComplete = p.Profile.DetailsComplete()
	return &p, nil
}

func (r *ProfileRepository) Save(ctx context.Context, userID int64, p model.SavedProfile) error {
	_, err := r.pool.Exec(ctx,
		`insert into user_profiles (user_id, goal_text, protein_target_g, diet, allergies, likes, budget, auto_add,
		                            age_years, weight_kg, height_cm, activity, days, daily_protein_g)
		 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		 on conflict (user_id) do update set
		   goal_text = excluded.goal_text, protein_target_g = excluded.protein_target_g, diet = excluded.diet,
		   allergies = excluded.allergies, likes = excluded.likes, budget = excluded.budget,
		   auto_add = excluded.auto_add, age_years = excluded.age_years, weight_kg = excluded.weight_kg,
		   height_cm = excluded.height_cm, activity = excluded.activity, days = excluded.days,
		   daily_protein_g = excluded.daily_protein_g, updated_at = now()`,
		userID, p.GoalText, p.ProteinTargetG, p.Diet, p.Allergies, p.Likes, p.Budget, p.AutoAdd,
		p.AgeYears, p.WeightKg, p.HeightCm, nilIfEmpty(p.Activity), nilIfZero(p.Days), nilIfZero(p.DailyProteinG))
	return err
}

func nilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func nilIfZero(n int) *int {
	if n == 0 {
		return nil
	}
	return &n
}
