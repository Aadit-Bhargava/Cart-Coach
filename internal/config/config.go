package config

import (
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"

	"github.com/joho/godotenv"
)

// Config holds application settings loaded from the environment.
type Config struct {
	URL        string // full connection string; overrides the DB_* parts
	DBHost     string
	DBPort     string
	DBName     string
	DBUser     string
	DBPassword string
	Port       string
}

// New loads .env (if present) and builds a Config from the environment.
func New() (*Config, error) {
	// A missing .env is fine; real environment variables still apply.
	if err := godotenv.Load(); err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}

	cfg := &Config{
		URL:        os.Getenv("DATABASE_URL"),
		DBHost:     os.Getenv("DB_HOST"),
		DBPort:     getenv("DB_PORT", "5432"),
		DBName:     getenv("DB_NAME", "postgres"),
		DBUser:     os.Getenv("DB_USER"),
		DBPassword: os.Getenv("DB_PASSWORD"),
		Port:       getenv("PORT", "8080"),
	}
	if cfg.URL != "" {
		return cfg, nil
	}
	for name, v := range map[string]string{
		"DB_HOST":     cfg.DBHost,
		"DB_USER":     cfg.DBUser,
		"DB_PASSWORD": cfg.DBPassword,
	} {
		if v == "" {
			return nil, fmt.Errorf("%s is not set", name)
		}
	}
	return cfg, nil
}

// DatabaseURL returns DATABASE_URL if set, otherwise builds the Postgres
// connection string from the DB_* parts. The password is escaped, so it
// may contain any characters.
func (c *Config) DatabaseURL() string {
	if c.URL != "" {
		return c.URL
	}
	u := url.URL{
		Scheme: "postgresql",
		User:   url.UserPassword(c.DBUser, c.DBPassword),
		Host:   net.JoinHostPort(c.DBHost, c.DBPort),
		Path:   "/" + c.DBName,
	}
	return u.String()
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
