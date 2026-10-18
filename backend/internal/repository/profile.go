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
	err := r.pool.QueryRow(ctx,
		`select goal_text, protein_target_g, diet, allergies, likes, budget::float8, auto_add
		 from user_profiles where user_id = $1`, userID,
	).Scan(&p.GoalText, &p.ProteinTargetG, &p.Diet, &p.Allergies, &p.Likes, &p.Budget, &p.AutoAdd)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrProfileNotFound
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *ProfileRepository) Save(ctx context.Context, userID int64, p model.SavedProfile) error {
	_, err := r.pool.Exec(ctx,
		`insert into user_profiles (user_id, goal_text, protein_target_g, diet, allergies, likes, budget, auto_add)
		 values ($1, $2, $3, $4, $5, $6, $7, $8)
		 on conflict (user_id) do update set
		   goal_text = excluded.goal_text, protein_target_g = excluded.protein_target_g, diet = excluded.diet,
		   allergies = excluded.allergies, likes = excluded.likes, budget = excluded.budget,
		   auto_add = excluded.auto_add, updated_at = now()`,
		userID, p.GoalText, p.ProteinTargetG, p.Diet, p.Allergies, p.Likes, p.Budget, p.AutoAdd)
	return err
}
