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

// CreateWithPassword inserts a user with a bcrypt password hash and returns the stored row.
func (r *UserRepository) CreateWithPassword(ctx context.Context, email, name, passwordHash string) (*User, error) {
	u := &User{}
	err := r.pool.QueryRow(ctx,
		`insert into users (email, name, password_hash) values ($1, $2, $3)
		 returning id, email, name, created_at`,
		email, name, passwordHash,
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

// GetCredentials returns the user and their password hash. The hash is empty for
// accounts that have no password.
func (r *UserRepository) GetCredentials(ctx context.Context, email string) (*User, string, error) {
	u := &User{}
	var hash *string
	err := r.pool.QueryRow(ctx,
		`select id, email, name, created_at, password_hash from users where email = $1`, email,
	).Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", ErrUserNotFound
	}
	if err != nil {
		return nil, "", err
	}
	if hash == nil {
		return u, "", nil
	}
	return u, *hash, nil
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

// GetByID returns the user with the given id.
func (r *UserRepository) GetByID(ctx context.Context, id int64) (*User, error) {
	u := &User{}
	err := r.pool.QueryRow(ctx,
		`select id, email, name, created_at from users where id = $1`, id,
	).Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}
