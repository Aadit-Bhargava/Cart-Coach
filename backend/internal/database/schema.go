package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/fx"
)

// schema is idempotent: it creates what is missing and never drops or rewrites data.
const schema = `
create table if not exists users (
    id         bigserial primary key,
    email      text not null unique,
    name       text not null,
    created_at timestamptz not null default now()
);

create table if not exists products (
    id         bigserial primary key,
    name       text not null,
    price      numeric(10, 2) not null check (price >= 0),
    created_at timestamptz not null default now()
);
alter table products add column if not exists brand     text;
alter table products add column if not exists category  text;
alter table products add column if not exists protein_g numeric(5, 1);
alter table products add column if not exists calories  integer;
alter table products add column if not exists image_url text;
alter table products add column if not exists diet      text not null default 'unknown';
alter table products add column if not exists allergens text[] not null default '{}';

create table if not exists user_profiles (
    user_id          bigint primary key references users(id) on delete cascade,
    goal_text        text not null,
    protein_target_g integer not null,
    diet             text not null,
    allergies        text[] not null default '{}',
    likes            text[] not null default '{}',
    budget           numeric(10, 2) not null,
    auto_add         boolean not null,
    updated_at       timestamptz not null default now()
);

create table if not exists coach_decisions (
    id         bigserial primary key,
    user_id    bigint not null references users(id) on delete cascade,
    title      text not null,
    detail     text not null,
    created_at timestamptz not null default now()
);
create index if not exists coach_decisions_user_idx on coach_decisions (user_id, id desc);
`

// Migrate brings the database up to the current schema.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, schema); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}

// RunMigrations applies the schema when the server starts. An unreachable
// database is logged, not fatal, to match New: /database/ping reports health.
func RunMigrations(lc fx.Lifecycle, pool *pgxpool.Pool) {
	lc.Append(fx.Hook{OnStart: func(ctx context.Context) error {
		ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
		defer cancel()
		if err := Migrate(ctx, pool); err != nil {
			log.Printf("warning: %v", err)
		}
		return nil
	}})
}
