// Package web holds the built frontend, embedded into the server binary so one
// container serves both the site and the API. The Docker build copies the Vite
// output into web/dist; in a plain `go run`, only the placeholder file is there.
package web

import "embed"

//go:embed all:dist
var Dist embed.FS
