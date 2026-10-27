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
   `api/openapi.json` and copies allauth's shipped spec to `api/allauth/`
   (both committed; backend tests fail if they are stale).
4. **Regenerate the client.** `make fe-api-generate` (or `make api-generate`
   for steps 3 and 4 together) runs Orval over both specs into
   `frontend/src/api/generated/` (Ninja) and `frontend/src/api/generated-auth/`
   (allauth). Committed, never hand-edited.
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
- There are two contracts. Everything under `/api/` is ours (Ninja). Auth lives
  under `/_allauth/browser/v1/auth/` and is django-allauth's headless API: its
  spec is shipped with allauth, we only copy it (`api/allauth/`, a test compares
  it with the installed file, so an allauth upgrade shows up as a diff). Orval's
  `auth` entry keeps `login`, `signup`, `getSession` (GET) and `logout` (DELETE
  session), fixes `{client}` to `browser` and drops the rest (see
  `orval.config.ts`). Its envelope (`{status, data, meta}` / `{status, errors}`)
  differs from Ninja's and can't be changed, so the frontend has a second error
  class instead of bending one.

## Authentication

- Session cookie (Django session) through allauth's headless **browser** client;
  the Ninja API uses the same session (`auth=django_auth` on the `NinjaAPI`).
  Unsafe methods need the CSRF token: the fetchers send the `csrftoken` cookie
  as `X-CSRFToken` (`api/http.ts`).
- Email + password only, no username, no email verification (signup logs in).
  Password rules are Django's validators; the frontend shows their messages.
- Every `/api/*` endpoint answers `401 {"detail": "Unauthorized"}` when logged
  out. Lists belong to `TodoList.owner`; every query is scoped to
  `request.user`, and someone else's list or todo is a `404` (never a 403).
- allauth's login errors are `400` with `param` (wrong password is
  `param: password`); `401` means "not authenticated" and carries
  `data.flows`. A successful **logout** (`DELETE session`) also answers `401`.
- The frontend keeps the session in React Query (`src/auth/api.ts`). A `401`
  from the Ninja API marks the session logged out (`src/api/queryClient.ts`),
  and `AuthGate` redirects to `/login`. Routes: `/login`, `/signup` (guests
  only), `/` (signed-in only), `/auth/callback` (return from a provider).
- Social login: Google, redirect flow. A provider exists only when its
  credentials are set (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in
  `backend/.env`; redirect URI `https://dev.tangostack.com/accounts/google/login/callback/`),
  and the logged-out session lists it in the `provider_redirect` flow, which is
  what shows the button (`SocialLogin`). The start is a real form POST (allauth
  answers 302, not XHR); the backend returns to `/auth/callback`, with `?error=`
  on failure. `callback_url` must be same-origin or in `ALLOWED_HOSTS`. No
  email-based account linking: emails aren't verified on password signup, so it
  would allow pre-registering someone's address. The spec's `Flow` type lacks
  `providers` (`ProviderFlow` in `auth/api.ts`). Mocks sign in a fake Google
  user; e2e runs the backend with fake credentials and only checks the redirect.

## API conventions

- Errors use Ninja's bodies: `401` is `{"detail": "Unauthorized"}`, `404` is
  `{"detail": "Not Found"}` and `422` is `{"detail": [{"type", "loc", "msg",
  "ctx?"}]}`. All are declared in the spec (`ErrorResponse`,
  `ValidationErrorResponse`). The frontend's `ApiError` reads `detail`.
- Schemas are named `<Thing>Create` / `<Thing>Update` / `<Thing>Response` (project
  convention, not enforced by Ninja); the names become the generated TypeScript types.
- Operation IDs are set explicitly (`listLists`, `createTodo`, ...) because they
  become the generated hook names. Do not rely on Ninja's default IDs.
- Responses expose read-only `created_at` and `updated_at` (ISO 8601 strings).
- Collections are plain arrays until pagination is needed (then use Ninja's
  `@paginate`, which wraps results in `{items, count}`).
- Partial updates are `PATCH` with optional fields. Declare them as
  `field: Type = Field(default=None)`, not `Type | None`: omitted fields are left
  alone, an explicit `null` is a 422 (not a 500 from a NOT NULL column), and the
  spec/generated types are plain optional (`done?: boolean`). Apply them with
  `save()` (not `.update()`) so `updated_at` is bumped (`apply_patch` in `api.py`).
- Deletes are `DELETE` returning `204` with no body (`response={204: None, ...}`,
  `Status(204, None)`) and the usual 404. Deleting a list cascades to its todos.
- Text input is stripped and validated at the API boundary (`min_length=1`, and a
  `max_length` equal to the column size); the database has a not-blank check as a
  backstop.

## Frontend layout (API related)

| Path                                     | Purpose                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `api/openapi.json`                       | The contract, exported from Django Ninja (`make api-export`)       |
| `api/allauth/`                           | Copy of allauth's shipped spec (`openapi.yaml`, `description.md`)  |
| `frontend/orval.config.ts`               | Orval config: `tangostack` (Ninja) and `auth` (allauth) entries    |
| `frontend/src/api/http.ts`               | Shared fetch core: CSRF header, mock-worker retry, `HttpError`     |
| `frontend/src/api/fetcher.ts`            | `customFetch` for generated code; throws `ApiError` (`detail`)     |
| `frontend/src/api/authFetcher.ts`        | `authFetch`; throws `AuthApiError` (`errors[]`, `fieldErrors`)     |
| `frontend/src/api/queryClient.ts`        | QueryClient: no retry on 4xx, Ninja 401 logs the session out       |
| `frontend/src/api/generated/`            | Generated Ninja client, hooks and models. Do not edit              |
| `frontend/src/api/generated-auth/`       | Generated allauth client, hooks and models. Do not edit            |
| `frontend/src/auth/api.ts`               | `useSession`, `useLogin`, `useSignup`, `useLogout` over generated  |
| `frontend/src/mocks/db.ts`               | Typed seed data and in-memory store                                |
| `frontend/src/mocks/handlers.ts`         | One MSW handler per operation, returning Ninja-shaped responses    |
| `frontend/src/mocks/authHandlers.ts`     | allauth-shaped handlers (session, login, signup, logout)           |
| `frontend/src/mocks/{browser,server}.ts` | MSW worker (browser) and server (Node/vitest)                      |
| `frontend/src/mocks/enable.ts`           | Starts the worker; on in dev by default                            |
| `frontend/src/client.tsx`                | Client entry; awaits the worker before hydrating                   |
| `frontend/src/test/{setup,render}.ts(x)` | MSW lifecycle and `renderWithClient`                               |
| `frontend/src/test/renderApp.tsx`        | Real pages on a memory router (redirects, login flows)             |
| `frontend/src/test/factories.ts`         | `todo()` / `todoList()` typed fixtures for tests                   |

Env vars (`frontend/src/env.ts`): `VITE_API_URL` (default: same origin) and
`VITE_API_MOCKING` (`true`/`false`; default on in dev, off in production builds),
`VITE_API_MOCKING_KEEP_SESSION` (`true`: the mock login survives reloads, via localStorage).

Mock logins: `amanda@email.com` and `bruno@email.com`, password `password`, each
with their own lists. Nobody is signed in after a reload unless
`VITE_API_MOCKING_KEEP_SESSION=true` (put it in `frontend/.env.local`). Unit
tests ignore `.env.local` (pinned in `vitest.config.ts`).

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
and proxies `/api`, `/_allauth`, `/admin`, `/static` to Django (host `:8000`) and everything
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

- `make api-export`: export Ninja's OpenAPI schema to `api/openapi.json` and copy allauth's spec to `api/allauth/`
- `make fe-api-generate`: regenerate both frontend clients from the specs in `api/`
- `make api-generate`: both of the above
- `make fe-dev`: dev server (mocks on by default)
- `make fe-dev-api`: dev server against the real backend (mocks off)
- `make fe-e2e`: Playwright e2e against the real stack (needs `make db-up`)
- `make fe-e2e-report`: open the last Playwright HTML report
- `make coverage-report`: open the backend HTML coverage report (every `pytest` run writes it to `backend/htmlcov/`)
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
- E2E tests live in `frontend/e2e/` (Playwright, Chromium only). `make fe-e2e`
  starts its own stack: Django on `:8001` with a dedicated `tangostack_e2e`
  database (created and migrated on demand by `make e2e-backend`) and Vite on
  `:3100` with mocks off. It never touches dev data or your `:3000`/`:8000`
  servers. The only prerequisite is Postgres (`make db-up`).
  - Tests run serially; `e2e/fixtures.ts` flushes the e2e database (users
    included) before every test (`make e2e-flush`, e2e DB only). Import
    `test`/`expect` from there.
  - The `api` fixture signs up `amanda@email.com` in the page's browser context
    and sends the CSRF token for you; use it (not `request`) to seed data, so the
    page and the API calls share one session. `signUp` and `csrfApi` build other
    users (see `e2e/auth.spec.ts`).
  - Seed data through the API, not the database, so the
    generated types and the real contract are exercised. Cover whole flows;
    keep rule-level checks in backend and vitest tests.
  - Vite proxies `/api` and `/_allauth` itself during e2e (`API_PROXY_TARGET`, a plugin in
    `vite.config.ts`) because Caddy isn't in this stack. Vite's `server.proxy`
    and Nitro's `devProxy` don't work: TanStack Start answers `/api/*` first.
  - Use `click()` + `expect(...).toBeChecked()` on checkboxes: `.check()` reads
    the state synchronously and fails on Base UI's async-updating checkbox.
- Backend tests that touch the API use the Django test client against `/api/...`
  and cover our own behavior (validation, 404s, ownership, query counts), not
  Django's or allauth's. The `api_client` fixture (`tangostack/conftest.py`) is
  signed in as `user`; pytest-django's plain `client` is anonymous.

## Dependencies

Do not install, remove or upgrade packages without asking the project owner
first. Frontend dependencies are pinned to exact versions.

## Gotchas

- Add components with `pnpm dlx shadcn@latest add <name>` (from `frontend/`). After
  `shadcn add` or `shadcn init`, check the components: the CLI has
  generated `import { cn } from "cn"` (a wrong npm package) instead of
  `#/lib/utils`, and may overwrite `src/lib/utils.ts`. Fix the imports and
  remove any `cn` dependency it added.
- MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`.
- Formatting is oxfmt (double quotes, semicolons) and linting is oxlint.
  `src/api/generated/` and `routeTree.gen.ts` are excluded from both.
