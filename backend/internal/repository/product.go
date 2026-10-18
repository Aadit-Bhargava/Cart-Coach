package repository

import (
	"context"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aaditbhargava/cart-coach/internal/model"
)

const productTTL = 5 * time.Minute

// ProductRepository reads the catalog. The catalog is small and read-only, so
// the whole list is cached in memory for a few minutes.
type ProductRepository struct {
	pool *pgxpool.Pool

	mu      sync.RWMutex
	cache   []model.Product
	byID    map[int64]model.Product
	fetched time.Time
}

func NewProductRepository(pool *pgxpool.Pool) *ProductRepository {
	return &ProductRepository{pool: pool}
}

// All returns every product ordered by id.
func (r *ProductRepository) All(ctx context.Context) ([]model.Product, error) {
	r.mu.RLock()
	if r.cache != nil && time.Since(r.fetched) < productTTL {
		defer r.mu.RUnlock()
		return r.cache, nil
	}
	r.mu.RUnlock()

	rows, err := r.pool.Query(ctx,
		`select id, name, brand, category, price::float8, protein_g::float8, calories, image_url, diet, allergens
		 from products order by id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := []model.Product{}
	byID := map[int64]model.Product{}
	for rows.Next() {
		var p model.Product
		if err := rows.Scan(&p.ID, &p.Name, &p.Brand, &p.Category, &p.Price, &p.ProteinG, &p.Calories, &p.ImageURL, &p.Diet, &p.Allergens); err != nil {
			return nil, err
		}
		if p.Allergens == nil {
			p.Allergens = []string{}
		}
		list = append(list, p)
		byID[p.ID] = p
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	r.mu.Lock()
	r.cache, r.byID, r.fetched = list, byID, time.Now()
	r.mu.Unlock()
	return list, nil
}

// ByID returns the cached product index, loading it if needed.
func (r *ProductRepository) ByID(ctx context.Context) (map[int64]model.Product, error) {
	if _, err := r.All(ctx); err != nil {
		return nil, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.byID, nil
}
