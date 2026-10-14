# Cart Coach Implementation Plan (Simple Version)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A simple full-stack demo of AI in e-commerce: a user logs in, sets a fitness goal with calorie/protein targets, shops Open Food Facts products into a cart, and Claude suggests product swaps that move the cart toward those targets, with a reason for each.

**Architecture:** One Go binary (the existing Gin + pgx + fx code, moved to `backend/`) exposes a small JSON API and serves the built React app. Open Food Facts (OFF) is called live, with no product cache. The AI step: the server fetches real alternative products from OFF for each cart item, hands cart + targets + candidates to Claude, and Claude chooses the swaps and writes the explanations.

**Tech Stack:** Go 1.26 / Gin / pgx v5 / fx / golang-jwt v5 / bcrypt / anthropic-sdk-go; Postgres 16; React 18 + TypeScript + Vite + React Router; Vitest + Testing Library.

**Spec:** None separate; derived from the user's chat request. The decisions below are the spec.

## Design Decisions (the spec)

- **Cart meaning:** the cart is one day of food. Gap = daily targets − cart totals (kcal, protein).
- **Goals:** `lose_fat | maintain | build_muscle`; user types `daily_calories` and `daily_protein_g` (no calculator).
- **Auth:** email + password, bcrypt, JWT HS256 (24h) in `Authorization: Bearer`. Emails stored lowercase, unique.
- **No product cache:** cart rows store a product snapshot (`jsonb`) taken when the item is added. Nothing else from OFF is persisted.
- **AI is required for suggestions:** no `ANTHROPIC_API_KEY` or a Claude failure => `POST /api/suggestions` returns 503 `{"error":"AI suggestions unavailable"}`. Claude may only pick swaps from the candidates the server sent; anything else is discarded.
- **Existing code:** `POST /users` is replaced by register/login; `/database/ping` stays.
- **Monolith:** `STATIC_DIR` (default `../frontend/dist`) is served with SPA fallback for non-`/api` GETs.

### Schema (one migration file, run at startup with `create table if not exists`)

| Table | Columns |
|---|---|
| `users` | id bigserial pk, email text not null, name text not null, password_hash text not null, created_at timestamptz default now(); unique index on `lower(email)` |
| `profiles` | user_id bigint pk fk users on delete cascade, goal text check in the 3 goals, daily_calories int check >0, daily_protein_g int check >0 |
| `cart_items` | user_id fk users on delete cascade, barcode text, quantity int check 1..99, product jsonb not null; primary key (user_id, barcode) |

## Global Constraints

- Go module stays `github.com/aaditbhargava/cart-coach`, rooted at `backend/`; keep the existing layered style (`handler` → `repository`, fx wiring in `cmd/server/main.go`).
- OFF requests send `User-Agent: CartCoach/1.0 (bhargavaaadit@gmail.com)` and use a 5s timeout. OFF values are per 100 g; per-unit = value × `unit_g` / 100.
- Quantity is an int 1–99. API errors are `{"error": "<message>"}`.
- DB tests need Postgres via `TEST_DATABASE_URL` and `t.Skip` when unset.
- `ANTHROPIC_API_KEY`, `JWT_SECRET` come from env only; never commit `.env`.

## Review Focus

1. OFF products missing kcal or protein: never shown or added (Task 3).
2. OFF down/slow: search returns 502 `{"error":"food database unavailable"}`; suggestions treat a failed candidate fetch for one item as "no candidates for that item" (Tasks 3, 5).
3. Claude returns malformed JSON, a barcode not in the candidate list, or a swap for an item not in the cart: invalid picks dropped; if none remain, empty result with a message, not a 500 (Task 5).
4. Empty cart or no profile: no Claude call; no profile => 409 `profile_required` (Task 5).
5. Cross-user isolation on cart/profile, `Alice@x.com` vs `alice@x.com` duplicate registration, expired/garbage token => 401 (Tasks 2, 4).

---

## File Structure

```
backend/                         (git mv of cmd/, internal/, go.mod, go.sum, .env.example)
  internal/config/config.go      + JWTSecret, AnthropicKey, LLMModel, StaticDir
  internal/database/migrate.go   runs embedded schema.sql
  internal/database/schema.sql
  internal/auth/auth.go          bcrypt, JWT issue/parse, gin middleware
  internal/off/client.go         search, by-barcode, by-category + mapping
  internal/nutrition/nutrition.go  Product, Totals, PerUnit, CartTotals
  internal/ai/suggest.go         prompt, Claude call, reply parsing, pick validation
  internal/repository/           user.go, profile.go, cart.go
  internal/handler/              auth.go, profile.go, product.go, cart.go, suggestion.go, static.go
frontend/                        Vite React TS: pages Login, Register, Onboarding, Shop, Cart; component Suggestions
docker-compose.yml  Makefile  README.md
```

---

### Task 1: Restructure into `backend/`, dev Postgres

**Files:**
- Move: `cmd/`, `internal/`, `go.mod`, `go.sum`, `.env.example` → `backend/` (`git mv`)
- Modify: `.vscode/launch.json` (paths), `.gitignore` (`frontend/node_modules`, `frontend/dist`, `backend/.env`)
- Create: `docker-compose.yml` (`postgres:16`, DB `cartcoach`, user/password `cartcoach`, a second DB `cartcoach_test` via mounted init SQL), `Makefile` (`backend-test`, `backend-run`, `frontend-dev`, `build`)

**Interfaces:**
- Produces: `docker compose up -d db` gives `postgres://cartcoach:cartcoach@localhost:5432/cartcoach` and `.../cartcoach_test`.

- [ ] **Step 1: `git mv` files; update `launch.json`, `.gitignore`.**
- [ ] **Step 2: Write `docker-compose.yml` and `Makefile`.**
- [ ] **Step 3: Verify** — Run: `cd backend && go build ./... && go vet ./...` Expected: exit 0, no output.
- [ ] **Step 4: Commit** — `git commit -m "chore: move Go service to backend/, add dev postgres"`

### Task 2: Schema + auth

**Files:**
- Create: `backend/internal/database/{migrate.go,schema.sql}`, `backend/internal/auth/auth.go`, `backend/internal/handler/auth.go`, `backend/internal/handler/helpers_test.go`, `backend/internal/handler/auth_test.go`
- Modify: `backend/internal/config/config.go` (`JWTSecret` required), `backend/internal/repository/user.go`, `backend/cmd/server/main.go`, `backend/internal/server/server.go`; delete `backend/internal/handler/user.go`

**Interfaces:**
- Produces:
  - `database.Migrate(ctx context.Context, pool *pgxpool.Pool) error` (fx `Invoke` before server start). `schema.sql` creates the three tables; for the pre-existing dev `users` table it also runs `alter table users add column if not exists password_hash text not null default ''`.
  - `auth.HashPassword(pw string) (string, error)`; `auth.CheckPassword(hash, pw string) bool`
  - `auth.NewTokens(secret string, ttl time.Duration) *Tokens`; `(*Tokens).Issue(userID int64) (string, error)`; `(*Tokens).Parse(tok string) (int64, error)`
  - `auth.Middleware(t *Tokens) gin.HandlerFunc` (401 on missing/bad/expired); `auth.UserID(c *gin.Context) int64`
  - `UserRepository.Create(ctx, email, name, passwordHash string) (*User, error)` (`ErrEmailTaken`), `ByEmail(ctx, email) (*User, string, error)` (`ErrNotFound`); email lowercased inside the repo.
  - Routes (all under an `/api` group; handlers expose `Register(g *gin.RouterGroup)`): `POST /api/auth/register {email,name,password≥8}` → 201 `{token,user}`; `POST /api/auth/login {email,password}` → 200 `{token,user}` or 401 `{"error":"invalid credentials"}`.
  - Test helpers in `helpers_test.go`: `testPool(t) *pgxpool.Pool` (skips without `TEST_DATABASE_URL`, migrates, truncates all tables), `newTestRouter(t, deps) *gin.Engine`, `registerUser(t, r, email) (token string, userID int64)`.

- [ ] **Step 1: Failing tests** in `auth_test.go`: `TestRegisterThenLogin`, `TestRegisterDuplicateEmailCaseInsensitive` (`Alice@x.com` then `alice@x.com` => 409), `TestLoginWrongPassword` (401), `TestMiddlewareRejectsGarbageAndExpiredToken` (expired from `NewTokens(secret, -time.Minute)`), `TestRegisterShortPassword` (400).
- [ ] **Step 2: Run** `cd backend && TEST_DATABASE_URL=postgres://cartcoach:cartcoach@localhost:5432/cartcoach_test go test ./internal/handler -run 'Register|Login|Middleware' -v` Expected: FAIL.
- [ ] **Step 3: Implement** the files above.
- [ ] **Step 4: Run** same. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: schema and JWT auth"`

### Task 3: Open Food Facts client + product search

**Files:**
- Create: `backend/internal/nutrition/nutrition.go`, `backend/internal/nutrition/nutrition_test.go`, `backend/internal/off/client.go`, `backend/internal/off/client_test.go`, `backend/internal/handler/product.go`, `backend/internal/handler/product_test.go`
- Modify: `backend/internal/config/config.go` (`OFFBaseURL`, default `https://world.openfoodfacts.org`), `backend/cmd/server/main.go`

**Interfaces:**
- Produces:
  ```go
  // nutrition
  type Product struct {
      Barcode, Name, Brand, ImageURL, PrimaryCategory string
      Kcal100, Protein100 float64
      UnitG float64
  }
  type Totals struct{ Kcal, Protein float64 }
  type Line struct{ Product Product; Quantity int }
  func (p Product) PerUnit() Totals
  func CartTotals(lines []Line) Totals
  // off
  func NewClient(baseURL string, hc *http.Client) *Client
  func (c *Client) Search(ctx context.Context, q string, limit int) ([]nutrition.Product, error)
  func (c *Client) ByBarcode(ctx context.Context, code string) (*nutrition.Product, error)   // ErrNotFound
  func (c *Client) ByCategory(ctx context.Context, categoryTag string, limit int) ([]nutrition.Product, error)
  var ErrUnavailable, ErrNotFound error
  ```
- OFF endpoints: `/cgi/search.pl?search_terms=…&search_simple=1&action=process&json=1&page_size=N`, `/api/v2/product/{code}.json`, `/api/v2/search?categories_tags_en=…&sort_by=unique_scans_n&page_size=N`; all with `fields=code,product_name,brands,image_front_small_url,nutriments,categories_tags,serving_quantity`. Mapping: drop products missing `energy-kcal_100g`, `proteins_100g` or a name; `UnitG` = `serving_quantity` if >0 else 100; `PrimaryCategory` = last `categories_tags` entry. Non-2xx or transport error => wraps `ErrUnavailable`.
- Route: `GET /api/products/search?q=` (auth; q ≥ 2 chars else 400) → `{"products":[…]}`; OFF failure => 502 `{"error":"food database unavailable"}`.

- [ ] **Step 1: Failing tests:** `nutrition`: `TestPerUnitUsesUnitG` (100 kcal/100g, UnitG 30 → 30), `TestCartTotalsMultipliesQuantity`. `off` (httptest): `TestMapDropsMissingNutriments` (3 products: no kcal / no protein / complete → 1 returned), `TestSendsUserAgent`, `TestUnitGFallsBackTo100`, `TestNon2xxIsErrUnavailable`, `TestByBarcodeNotFound` (`status:0` body). `handler`: `TestSearchRequiresAuthAndMinLength`, `TestSearchReturns502WhenOFFDown`.
- [ ] **Step 2: Run** `cd backend && go test ./internal/nutrition ./internal/off ./internal/handler -run 'PerUnit|CartTotals|Map|Agent|UnitG|Non2xx|ByBarcode|Search' -v` Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same. Expected: PASS.
- [ ] **Step 5: Manual smoke:** `curl -H "Authorization: Bearer $T" 'localhost:8080/api/products/search?q=greek%20yogurt'` Expected: real products with non-zero `Kcal100` and `Protein100`.
- [ ] **Step 6: Commit** — `git commit -m "feat: Open Food Facts client and product search"`

### Task 4: Profile + cart API

**Files:**
- Create: `backend/internal/repository/{profile.go,cart.go}`, `backend/internal/handler/{profile.go,cart.go}`, `backend/internal/handler/{profile_test.go,cart_test.go}`
- Modify: `backend/cmd/server/main.go`

**Interfaces:**
- Consumes: `off.Client.ByBarcode`, `nutrition.Line`, `nutrition.CartTotals`, test helpers from Task 2.
- Produces:
  - `Profile{Goal string; DailyCalories, DailyProteinG int}`; `ProfileRepository.Get(ctx, userID) (*Profile, error)` (`ErrNotFound`), `Upsert(ctx, userID int64, p Profile) error`.
  - `CartRepository.Lines(ctx, userID) ([]nutrition.Line, error)`, `Add(ctx, userID int64, p nutrition.Product, qty int) error` (adds to existing; error if sum > 99), `SetQuantity(ctx, userID, barcode string, qty int) error`, `Remove(ctx, userID, barcode string) error`, `Swap(ctx, userID int64, from string, to nutrition.Product) error` (one transaction: delete `from`, insert `to` with `from`'s quantity, merging if `to` exists; `ErrNotFound` if `from` absent).
  - Routes (auth): `GET /api/profile` (404 if unset), `PUT /api/profile {goal,daily_calories (800–6000),daily_protein_g (20–400)}`; `GET /api/cart` → `{"items":[{"product":Product,"quantity":int}],"totals":{"kcal":f,"protein":f}}`; `POST /api/cart/items {barcode,quantity}` (product fetched via `ByBarcode`, unknown => 404); `PUT /api/cart/items/:barcode {quantity}`; `DELETE /api/cart/items/:barcode`; `POST /api/cart/swap {from,to}` (`to` fetched via `ByBarcode`). Mutations return the same body as `GET /api/cart`. Quantity outside 1–99 => 400.

- [ ] **Step 1: Failing tests:** profile: `TestProfileGetBeforeSet404`, `TestProfilePutThenGet`, `TestProfileRejectsBadGoalAndRanges` (table), `TestProfileIsolatedPerUser`. cart (fake OFF via httptest): `TestAddItemTwiceAccumulates`, `TestQuantityBounds` (0, -1, 100 → 400), `TestCartTotalsMatchItems`, `TestSwapKeepsQuantityAndMerges`, `TestSwapMissingFromIs404`, `TestCartIsolatedPerUser` (B cannot see or delete A's item), `TestAddUnknownBarcode404`.
- [ ] **Step 2: Run** `go test ./internal/handler -run 'Profile|Cart|AddItem|Quantity|Swap' -v` Expected: FAIL.
- [ ] **Step 3: Implement.** Every query filters on `user_id` from the JWT, never from request input.
- [ ] **Step 4: Run** same. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: profile and cart API"`

### Task 5: AI swap suggestions (the showcase)

**Files:**
- Create: `backend/internal/ai/suggest.go`, `backend/internal/ai/suggest_test.go`, `backend/internal/handler/suggestion.go`, `backend/internal/handler/suggestion_test.go`
- Modify: `backend/internal/config/config.go` (`AnthropicKey`, `LLMModel` default `claude-haiku-5-5`), `backend/cmd/server/main.go`, `backend/.env.example` (all new vars)

**Interfaces:**
- Consumes: `off.Client.ByCategory`, `CartRepository.Lines`, `ProfileRepository.Get`, `nutrition.CartTotals`.
- Produces:
  ```go
  // ai
  type Swap struct { FromBarcode, ToBarcode, Reason string }
  type Input struct {
      Goal string; Target, Current nutrition.Totals
      Cart []nutrition.Line
      Candidates map[string][]nutrition.Product // key = cart item barcode
  }
  type Suggester interface { Suggest(ctx context.Context, in Input) ([]Swap, error) }
  func NewClaude(apiKey, model string) Suggester          // Suggest errors with ErrUnavailable when apiKey == ""
  func parseSwaps(reply string) ([]Swap, error)            // first JSON object in reply, shape {"swaps":[{"from","to","reason"}]}
  func validate(swaps []Swap, in Input, max int) []Swap    // keeps only (from in cart, to in Candidates[from]); dedupe by from; non-empty reason; cap max
  var ErrUnavailable error
  ```
- Prompt (system): "You are a nutrition-aware shopping assistant. Choose up to 3 swaps from the provided candidates that best move the cart toward the user's calorie and protein targets for their goal. Never invent products. Reasons must be one sentence, at most 140 characters, and mention the nutrient change. Reply with JSON only: {\"swaps\":[{\"from\":\"<barcode>\",\"to\":\"<barcode>\",\"reason\":\"...\"}]}". User message: JSON of goal, targets, current totals, cart lines (barcode, name, qty, per-unit kcal/protein) and candidates (barcode, name, per-unit kcal/protein).
- Endpoint `POST /api/suggestions` (auth, no body) → 200 `{"totals":{…},"target":{"kcal","protein"},"suggestions":[{"from":Product,"to":Product,"quantity":int,"reason":string,"delta":{"kcal":f,"protein":f}}],"message":string}` where `delta` = (to.PerUnit − from.PerUnit) × quantity. Flow: no profile => 409 `{"error":"profile_required"}`; empty cart => 200 empty suggestions with message "Add items to your cart to get suggestions" (no Claude call); fetch `ByCategory(item.PrimaryCategory, 10)` per cart item concurrently (a failure or empty result for an item => no candidates for it; candidates exclude the item's own barcode); no candidates at all => empty with message "No alternatives found"; call `Suggest` under a 15s timeout; `ErrUnavailable` or any Claude error => 503 `{"error":"AI suggestions unavailable"}`; no valid swaps after `validate` => 200 empty with message "Your cart already looks good for your goal".

- [ ] **Step 1: Failing tests:** `ai`: `TestParseSwapsExtractsJSONWithProse` ("Sure!\n{…}" parses), `TestParseSwapsMalformedIsError`, `TestValidateDropsUnknownBarcodes`, `TestValidateDropsPairNotInCandidates`, `TestValidateDedupesAndCaps`, `TestValidateDropsEmptyReason`, `TestNewClaudeWithoutKeyIsUnavailable`. `handler` (real router/DB, fake `Suggester`, fake OFF): `TestSuggestionsRequiresProfile409`, `TestSuggestionsEmptyCartSkipsClaude` (fake records zero calls), `TestSuggestionsReturnsValidatedSwapsWithDeltas`, `TestSuggestionsDiscardsHallucinatedPick` (fake returns unknown `to` → empty + message, status 200), `TestSuggestionsAIErrorIs503`, `TestSuggestionsOFFFailureForOneItemStillWorks`.
- [ ] **Step 2: Run** `cd backend && go test ./internal/ai ./internal/handler -run 'Parse|Validate|NewClaude|Suggestions' -v` Expected: FAIL.
- [ ] **Step 3: Implement** with `github.com/anthropics/anthropic-sdk-go` (`client.Messages.New`, `MaxTokens: 600`). Keep `parseSwaps`/`validate` pure so the SDK call is the only untested line. Missing `ANTHROPIC_API_KEY` must not stop startup.
- [ ] **Step 4: Run** `cd backend && go test ./...` (with `TEST_DATABASE_URL`) Expected: PASS.
- [ ] **Step 5: Manual AI check (needs real key):** set `ANTHROPIC_API_KEY`, register, set `build_muscle` 2500/150, add a sugary yogurt, `curl -X POST -H "Authorization: Bearer $T" localhost:8080/api/suggestions`. Expected: ≥1 swap to a real higher-protein product with a sensible reason.
- [ ] **Step 6: Commit** — `git commit -m "feat: Claude-powered swap suggestions"`

### Task 6: Frontend (auth, onboarding, shop, cart, suggestions)

**Files:**
- Create: `frontend/` via `npm create vite@latest frontend -- --template react-ts`; `src/api/{client.ts,types.ts}`, `src/auth/AuthContext.tsx`, `src/pages/{Login,Register,Onboarding,Shop,Cart}.tsx`, `src/components/Suggestions.tsx`, `src/App.tsx`, `src/test/setup.ts`, tests `Login.test.tsx`, `Onboarding.test.tsx`, `Cart.test.tsx`, `Suggestions.test.tsx`
- Modify: `frontend/vite.config.ts` (dev proxy `/api` → `http://localhost:8080`; vitest `jsdom` + setup), `frontend/package.json` (deps `react-router-dom`; dev `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`)

**Interfaces:**
- Consumes: the API in Tasks 2–5; TypeScript types in `types.ts` use the backend's JSON field names exactly.
- Produces:
  - `api` object: `register`, `login`, `getProfile`, `putProfile`, `searchProducts(q)`, `getCart`, `addItem(barcode,qty)`, `setQty`, `removeItem`, `swap(from,to)`, `suggest()`; throws `ApiError{status,message}`; sends `Authorization` from `localStorage["token"]`; a 401 clears the token and logs the user out.
  - `useAuth(): { user; login; register; logout }`; routes `/login`, `/register`, `/onboarding`, `/shop`, `/cart`; `/` → `/cart`; unauthenticated => `/login`; authenticated with 404 profile => `/onboarding`.
  - Onboarding: goal radios; prefill defaults on goal change until the user edits (lose_fat 1800/130, maintain 2200/110, build_muscle 2800/160); client-side ranges match the backend (800–6000, 20–400).
  - Shop: 300ms debounced search, product cards (name, brand, image, per-unit kcal/protein, "Add"), "Food database is unavailable, try again" on 502.
  - Cart: quantity stepper (1–99), remove, kcal and protein progress bars (`role="progressbar"`, fill capped at 100%, "over" state when above target), and `<Suggestions />`.
  - `<Suggestions />`: "Get AI suggestions" button (manual trigger, shows a loading state); each suggestion shows "from → to", the `reason`, and kcal/protein deltas; "Swap" calls `api.swap` then refetches the cart and clears the list; shows `message` when empty; 409 shows a link to `/onboarding`; 503 shows "AI suggestions are unavailable right now".

- [ ] **Step 1: Failing tests:** `Login`: `shows API error on bad credentials`, `stores token and goes to /cart on success`. `Onboarding`: `prefills defaults when goal changes until edited`, `blocks submit for calories outside 800-6000`. `Cart`: `quantity stepper respects 1 and 99`, `progress bar caps at 100% and flags over target`. `Suggestions`: `renders reason and deltas`, `swap calls API then refreshes cart`, `shows message when empty`, `shows unavailable notice on 503`.
- [ ] **Step 2: Run** `cd frontend && npx vitest run` Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` Expected: PASS, no type errors.
- [ ] **Step 5: Commit** — `git commit -m "feat(frontend): auth, onboarding, shop, cart, AI suggestions"`

### Task 7: Serve SPA from Go + README

**Files:**
- Create: `backend/internal/handler/static.go`, `backend/internal/handler/static_test.go`, `README.md` (replace stub)
- Modify: `backend/internal/config/config.go` (`StaticDir`), `backend/internal/server/server.go`

**Interfaces:**
- Produces: `handler.RegisterStatic(r *gin.Engine, dir string)` — `NoRoute`: for GET/HEAD not under `/api`, serve the file if it exists in `dir`, else `index.html`; unknown `/api/*` => JSON 404 `{"error":"not found"}`; if `dir/index.html` is absent, register nothing.

- [ ] **Step 1: Failing tests (temp dir):** `TestServesExistingAsset`, `TestUnknownPathFallsBackToIndex`, `TestUnknownApiPathIs404JSON`, `TestMissingIndexMeansNoStaticRoutes`, `TestPathTraversalIsRejected`.
- [ ] **Step 2: Run** `cd backend && go test ./internal/handler -run Static -v` Expected: FAIL.
- [ ] **Step 3: Implement**, then write README (prereqs, `docker compose up -d db`, env vars, `make backend-run`, `make frontend-dev`, `make build`).
- [ ] **Step 4: Full verification** — Run: `make backend-test && cd frontend && npx vitest run && npm run build` Expected: all PASS; `frontend/dist/index.html` exists.
- [ ] **Step 5: Manual end-to-end:** `cd backend && go run ./cmd/server`, open `http://localhost:8080`; register → onboarding (build_muscle) → search "yogurt" → add 2 items → Cart → "Get AI suggestions" → Swap. Expected: cart totals change by the displayed deltas.
- [ ] **Step 6: Commit** — `git commit -m "feat: serve SPA from Go, README"`

---

## Self-Review

- **Spec coverage:** login + goal/calorie/protein capture (Tasks 2, 4, 6); live Open Food Facts data (3); cart (4, 6); Claude-driven alternatives toward calorie/protein goals (5, 6); Go backend + React frontend in `backend/` and `frontend/` (1, 6); monolith (7); DB limited to users, profiles, cart_items (schema).
- **Type consistency:** `nutrition.Product/Totals/Line` are defined in Task 3 and used unchanged in Tasks 4–5; `ai.Suggester` is defined and consumed in Task 5; frontend types mirror backend JSON (Task 6).
- **Removed from the earlier draft:** product cache table, goose migrations, deterministic scoring/ranking, fallback suggestions, suggestion history table, Dockerfile.
