# One container serves the site and the API. Build from the repo root:
#   gcloud run deploy cart-coach --source .      (or: docker build -t cart-coach .)

# 1. Build the frontend. It talks to the Go service, so use the http API mode.
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_MODE=http
RUN npm run build

# 2. Build the Go server with the frontend embedded.
FROM golang:1.26 AS build
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY --from=web /web/dist ./web/dist
# The product images are generated locally and kept out of git, so they are packaged
# from this folder. Fail loudly if they are missing rather than ship a store without pictures.
RUN test -n "$(ls static/images/*.svg 2>/dev/null)" || \
    (echo "backend/static/images is missing. Run the seed program locally first, then deploy from the same folder." >&2; exit 1)
RUN CGO_ENABLED=0 go build -trimpath -o /out/server ./cmd/server

# 3. A small image with no shell. Cloud Run sets PORT; the server reads it.
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/server /app/server
COPY --from=build /src/static /app/static
ENV GIN_MODE=release
ENTRYPOINT ["/app/server"]
