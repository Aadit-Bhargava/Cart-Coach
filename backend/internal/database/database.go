package database

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/fx"

	"github.com/aaditbhargava/cart-coach/internal/config"
)

// New creates the Postgres pool and closes it when the app stops.
// Connections are established lazily, so startup does not fail if the
// database is unreachable; /database/ping reports that instead.
func New(lc fx.Lifecycle, cfg *config.Config) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL())
	if err != nil {
		return nil, err
	}
	lc.Append(fx.Hook{
		OnStop: func(context.Context) error {
			pool.Close()
			return nil
		},
	})
	return pool, nil
}
