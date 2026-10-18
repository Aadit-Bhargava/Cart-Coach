package main

import (
	"go.uber.org/fx"

	"github.com/aaditbhargava/cart-coach/internal/coach"
	"github.com/aaditbhargava/cart-coach/internal/config"
	"github.com/aaditbhargava/cart-coach/internal/database"
	"github.com/aaditbhargava/cart-coach/internal/handler"
	"github.com/aaditbhargava/cart-coach/internal/repository"
	"github.com/aaditbhargava/cart-coach/internal/server"
)

func main() {
	fx.New(
		fx.Provide(
			config.New,
			database.New,
			repository.NewUserRepository,
			repository.NewProductRepository,
			repository.NewProfileRepository,
			repository.NewDecisionRepository,
			coach.NewGemini,
			coach.NewService,
			handler.NewProductHandler,
			handler.NewProfileHandler,
			handler.NewCoachHandler,
			handler.NewDatabaseHandler,
			handler.NewUserHandler,
			server.NewEngine,
		),
		fx.Invoke(database.RunMigrations, server.Start),
	).Run()
}
