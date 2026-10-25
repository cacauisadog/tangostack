# Tangostack Agent Instructions

Repository-wide rules. `backend/AGENTS.md` adds backend-specific rules.

## Feature workflow: sketch on the frontend, build on the backend

Use this for every new frontend or full-stack feature. The frontend is where we
discover what data a screen needs; the **backend decides the final shape of the
API**, and the frontend then conforms to it.

1. **Sketch on the frontend.** Draft the screens against mocked data. This is
   the cheap place to find the rough data needs: no migrations, no models. The
   sketch is throwaway; it is allowed to be wrong.
2. **Build the real thing on the backend.** Django models and migrations, then
   Django Ninja schemas and endpoints with their tests. Follow Ninja's
   conventions (see "API conventions").
3. **Export the contract.** `make api-export` writes Ninja's OpenAPI schema to
   `api/openapi.json` (committed; a backend test fails if it is stale).
4. **Regenerate the client.** `make fe-api-generate` (or `make api-generate`
   for steps 3 and 4 together) runs Orval over `api/openapi.json` into
   `frontend/src/api/generated/` (committed, never hand-edited).
5. **Make the frontend conform.** Typecheck errors in the mocks, seed data, UI
   and tests show exactly where the sketch drifted from the real shape. Fix them
   until `make fe-check` passes; the mocks now follow the generated types.
6. **Switch off the mock** (`VITE_API_MOCKING=false`) and verify against the real
   backend. No app code should need to change.

### Contract ownership

- The backend owns the contract. `api/openapi.json` is generated from Django
  Ninja; never hand-edit it, and never keep a hand-written copy of it.
- If the frontend needs a different shape, change the Ninja schema and
  re-export. Do not bend the frontend away from what the spec says.

## API conventions

- Errors use Ninja's bodies: `404` is `{"detail": "Not Found"}` and `422` is
  `{"detail": [{"type", "loc", "msg", "ctx?"}]}`. Both are declared in the spec
  (`ErrorResponse`, `ValidationErrorResponse`). The frontend's `ApiError` reads `detail`.
- Schemas are named `<Thing>Create` / `<Thing>Update` / `<Thing>Response` (project
  convention, not enforced by Ninja); the names become the generated TypeScript types.
- Operation IDs are set explicitly (`listLists`, `createTodo`, ...) because they
  become the generated hook names. Do not rely on Ninja's default IDs.
- Responses expose read-only `created_at` and `updated_at` (ISO 8601 strings).
- Collections are plain arrays until pagination is needed (then use Ninja's
  `@paginate`, which wraps results in `{items, count}`).
- Partial updates are `PATCH` with optional fields; apply them with `save()` (not
  `.update()`) so `updated_at` is bumped.
- Text input is stripped and validated at the API boundary (`min_length=1`, and a
  `max_length` equal to the column size); the database has a not-blank check as a
  backstop.

## Frontend layout (API related)

| Path                                     | Purpose                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `api/openapi.json`                       | The contract, exported from Django Ninja (`make api-export`)       |
| `frontend/orval.config.ts`               | Orval config (react-query, fetch client, no faker mocks)           |
| `frontend/src/api/fetcher.ts`            | `customFetch` used by generated code; throws `ApiError` on non-2xx |
| `frontend/src/api/generated/`            | Generated client, hooks and models. Do not edit                    |
| `frontend/src/mocks/db.ts`               | Typed seed data and in-memory store                                |
| `frontend/src/mocks/handlers.ts`         | One MSW handler per operation, returning Ninja-shaped responses    |
| `frontend/src/mocks/{browser,server}.ts` | MSW worker (browser) and server (Node/vitest)                      |
| `frontend/src/mocks/enable.ts`           | Starts the worker; on in dev by default                            |
| `frontend/src/client.tsx`                | Client entry; awaits the worker before hydrating                   |
| `frontend/src/test/{setup,render}.ts(x)` | MSW lifecycle and `renderWithClient`                               |
| `frontend/src/test/factories.ts`         | `todo()` / `todoList()` typed fixtures for tests                   |

Env vars (`frontend/src/env.ts`): `VITE_API_URL` (default: same origin) and
`VITE_API_MOCKING` (`true`/`false`; default on in dev, off in production builds).

## Mock conventions

- Seed data is typed with the generated models, so contract drift fails
  `make fe-typecheck`. Keep it realistic (real-looking names and text, not
  `foo`/`bar`).
- Handlers are stateful over the in-memory store and mirror the backend: strip
  and validate input, return Ninja's 404 and 422 bodies, and bump `updated_at`.
  Mocks reset on page reload. When the backend rules change, update the mocks too.
- Cover error and loading states in tests with per-test overrides
  (`server.use(http.get(...))`), not by editing the default handlers.
- The Node MSW server fails on unhandled requests, so a missing handler fails a
  test instead of silently hitting the network.
- `enableMocking()` never throws. If the worker starts but doesn't control the
  page (hard refresh, first visit), it reloads once; if that doesn't help it
  warns in the console. If the worker fails to start, the app still hydrates.
  The fetcher turns a non-JSON response (usually the dev server's HTML 404, i.e.
  a bypassed worker) into an `ApiError` that says so.
- The browser can kill an idle mock worker (e.g. a backgrounded tab). The
  restarted worker forgets the page and lets every request through, even though
  `navigator.serviceWorker.controller` still looks fine. With mocking on, the
  fetcher re-sends MSW's `MOCK_ACTIVATE` (`reactivateMocking()`) and retries once.
  This relies on MSW's worker protocol, so re-check it when upgrading `msw`.
- `public/mockServiceWorker.js` is generated by `msw init public --save`; never
  hand-edit or format it (it's excluded from oxfmt and oxlint).
- The app is client-rendered for data: fetch with the generated hooks in
  components, not in route loaders. Server-side fetching would bypass the
  browser worker and needs separate MSW-in-Node wiring first.

## Local dev stack (real backend over HTTPS)

Caddy (docker compose, `caddy/Caddyfile.dev`) serves `https://dev.tangostack.com`
and proxies `/api`, `/admin`, `/static` to Django (host `:8000`) and everything
else to Vite (host `:3000`). One origin, so no CORS.

One-time setup: add `127.0.0.1 dev.tangostack.com` to `/etc/hosts`; copy
`backend/.env.example` to `backend/.env`; `make proxy-up`, then
`make proxy-trust` (trusts Caddy's local CA; asks for sudo).

Daily: `make db-up proxy-up`, `make run`, `make fe-dev-api` (or `make fe-dev`
for mocks; the domain works for both).

- Vite allows the host and sends HMR over `wss` on 443 (`vite.config.ts`).
- Django reads `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `BEHIND_PROXY`, `SECRET_KEY`,
  `DEBUG` from env (`backend/.env`, git-ignored).
- The production proxy will be Coolify's Traefik or Dokku's nginx (TBD), so this
  setup mirrors routing, not the platform's proxy config.

## Commands (run from the repository root)

- `make api-export`: export Ninja's OpenAPI schema to `api/openapi.json`
- `make fe-api-generate`: regenerate the frontend client from `api/openapi.json`
- `make api-generate`: both of the above
- `make fe-dev`: dev server (mocks on by default)
- `make fe-dev-api`: dev server against the real backend (mocks off)
- `make proxy-up` / `proxy-down` / `proxy-trust`: Caddy dev proxy
- `make fe-check`: lint, format check, typecheck and tests
- `make fe-format`: format after generating or adding shadcn components
- `make help`: everything else

## Testing

- Frontend unit tests live in `__tests__/` inside each feature directory and use
  vitest, Testing Library, user-event and MSW. Use `renderWithClient` for
  anything that uses React Query.
- Tests start from an empty mock database. Seed one with
  `db.reset([todoList({...})])` using the factories in `src/test/factories.ts`.
- Backend tests that touch the API use the Django test client against `/api/...`
  and cover our own behavior (validation, 404s, query counts), not Django's.

## Dependencies

Do not install, remove or upgrade packages without asking the project owner
first. Frontend dependencies are pinned to exact versions.

## Gotchas

- After `shadcn add` or `shadcn init`, check the components: the CLI has
  generated `import { cn } from "cn"` (a wrong npm package) instead of
  `#/lib/utils`, and may overwrite `src/lib/utils.ts`. Fix the imports and
  remove any `cn` dependency it added.
- MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`.
- Formatting is oxfmt (double quotes, semicolons) and linting is oxlint.
  `src/api/generated/` and `routeTree.gen.ts` are excluded from both.
