package main

import (
	"go.uber.org/fx"

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
			handler.NewDatabaseHandler,
			handler.NewUserHandler,
			server.NewEngine,
		),
		fx.Invoke(server.Start),
	).Run()
}
