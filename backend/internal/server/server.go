package server

import (
	"context"
	"errors"
	"net"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/fx"

	"github.com/aaditbhargava/cart-coach/internal/config"
	"github.com/aaditbhargava/cart-coach/internal/handler"
)

// NewEngine builds the gin engine and registers all routes.
func NewEngine(
	db *handler.DatabaseHandler,
	authH *handler.AuthHandler,
	products *handler.ProductHandler,
	profile *handler.ProfileHandler,
	coach *handler.CoachHandler,
) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	// Product pack images. They change rarely, so let browsers keep them for a day.
	static := r.Group("/static")
	static.Use(func(c *gin.Context) { c.Header("Cache-Control", "public, max-age=86400") })
	static.StaticFS("/", gin.Dir("./static", false))
	db.Register(r)
	authH.Register(r)
	products.Register(r)
	profile.Register(r)
	coach.Register(r)
	serveApp(r)
	return r
}

// Start runs the HTTP server for the lifetime of the fx app.
func Start(lc fx.Lifecycle, cfg *config.Config, engine *gin.Engine) {
	srv := &http.Server{Addr: ":" + cfg.Port, Handler: engine}

	lc.Append(fx.Hook{
		OnStart: func(context.Context) error {
			ln, err := net.Listen("tcp", srv.Addr)
			if err != nil {
				return err
			}
			go func() {
				if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
					panic(err)
				}
			}()
			return nil
		},
		OnStop: srv.Shutdown,
	})
}
