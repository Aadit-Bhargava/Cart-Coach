# Cart Coach frontend

React, TypeScript (strict), Vite, Tailwind, TanStack Query and Zod.

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build
npm run gen:api    # regenerate src/api/schema.d.ts from openapi/openapi.yaml
```

## API modes

`VITE_API_MODE` (see `.env.example`):

- `demo` (default): runs in the browser with generated sample products (`src/demo`) and a rule-based Coach (`src/lib/coach.ts`). No backend needed.
- `http`: calls the Go service. The contract is the **draft** `openapi/openapi.yaml`; the backend does not implement `/api/products`, `/api/profile/understand` or `/api/coach/suggest` yet.

The demo fixtures come from the seed program: `go run ./cmd/seed -dry-run -n 120 -json ...` and `-extend -n 1000 -first-id 121`.

## Layout

- `src/api`: generated types, the `CartCoachApi` interface, `http.ts`, `demo.ts`, zod checks for model output.
- `src/state`: store (cart, profile, log), catalog query, Coach orchestration.
- `src/features`: top bar, categories, product card and detail, cart panel, goal dialog, decision log.
- `src/lib`: formatting, pack-size parsing, demo Coach rules.
