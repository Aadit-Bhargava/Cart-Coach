package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aaditbhargava/cart-coach/internal/model"
)

type DecisionRepository struct{ pool *pgxpool.Pool }

func NewDecisionRepository(pool *pgxpool.Pool) *DecisionRepository {
	return &DecisionRepository{pool: pool}
}

func (r *DecisionRepository) Add(ctx context.Context, userID int64, d model.Decision) error {
	_, err := r.pool.Exec(ctx, `insert into coach_decisions (user_id, title, detail) values ($1, $2, $3)`, userID, d.Title, d.Detail)
	return err
}

// Recent returns the user's latest entries, newest first.
func (r *DecisionRepository) Recent(ctx context.Context, userID int64, limit int) ([]model.Decision, error) {
	rows, err := r.pool.Query(ctx,
		`select id, title, detail, created_at from coach_decisions where user_id = $1 order by id desc limit $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Decision{}
	for rows.Next() {
		var d model.Decision
		var at time.Time
		if err := rows.Scan(&d.ID, &d.Title, &d.Detail, &at); err != nil {
			return nil, err
		}
		d.CreatedAt = at.UTC().Format(time.RFC3339)
		out = append(out, d)
	}
	return out, rows.Err()
}
