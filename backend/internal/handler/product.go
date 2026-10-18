package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/aaditbhargava/cart-coach/internal/repository"
)

type ProductHandler struct{ products *repository.ProductRepository }

func NewProductHandler(p *repository.ProductRepository) *ProductHandler {
	return &ProductHandler{products: p}
}

func (h *ProductHandler) Register(r *gin.Engine) {
	r.GET("/api/products", h.List)
}

// List returns the whole catalog. It is public: browsing needs no account.
func (h *ProductHandler) List(c *gin.Context) {
	list, err := h.products.All(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "We couldn't load products. Try again in a moment."})
		return
	}
	c.Header("Cache-Control", "public, max-age=60")
	c.JSON(http.StatusOK, gin.H{"products": list})
}
