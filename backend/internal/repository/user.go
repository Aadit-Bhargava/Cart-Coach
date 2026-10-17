package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	// ErrEmailTaken is returned when a user with the same email already exists.
	ErrEmailTaken = errors.New("email already in use")
	// ErrUserNotFound is returned when no user matches the lookup.
	ErrUserNotFound = errors.New("user not found")
)

type User struct {
	ID        int64     `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

// Create inserts a user and returns the stored row.
func (r *UserRepository) Create(ctx context.Context, email, name string) (*User, error) {
	u := &User{}
	err := r.pool.QueryRow(ctx,
		`insert into users (email, name) values ($1, $2)
		 returning id, email, name, created_at`,
		email, name,
	).Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt)

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
		return nil, ErrEmailTaken
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}

// GetByEmail returns the user with the given email.
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*User, error) {
	u := &User{}
	err := r.pool.QueryRow(ctx,
		`select id, email, name, created_at from users where email = $1`,
		email,
	).Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}
