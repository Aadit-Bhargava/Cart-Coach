package server

import (
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/aaditbhargava/cart-coach/web"
)

// serveApp serves the embedded frontend for every route the API does not own,
// and falls back to index.html so page reloads work. Unknown /api and /static
// paths get a JSON 404 instead of the page.
func serveApp(r *gin.Engine) {
	dist, err := fs.Sub(web.Dist, "dist")
	if err != nil {
		panic(err)
	}
	index, _ := fs.ReadFile(dist, "index.html") // nil when the frontend has not been built

	r.NoRoute(func(c *gin.Context) {
		p := c.Request.URL.Path
		isGet := c.Request.Method == http.MethodGet || c.Request.Method == http.MethodHead
		if !isGet || p == "/api" || strings.HasPrefix(p, "/api/") || strings.HasPrefix(p, "/static/") || index == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "We couldn't find that page."})
			return
		}

		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("X-Frame-Options", "DENY")

		name := strings.TrimPrefix(path.Clean(p), "/")
		if info, err := fs.Stat(dist, name); name != "" && err == nil && !info.IsDir() {
			if strings.HasPrefix(name, "assets/") { // file names carry a content hash
				c.Header("Cache-Control", "public, max-age=31536000, immutable")
			}
			c.FileFromFS(name, http.FS(dist))
			return
		}
		c.Header("Cache-Control", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", index)
	})
}
