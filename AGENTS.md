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
   `openapi/openapi.json` and copies allauth's shipped spec to `openapi/allauth/`
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

- The backend owns the contract. `openapi/openapi.json` is generated from Django
  Ninja; never hand-edit it, and never keep a hand-written copy of it.
- If the frontend needs a different shape, change the Ninja schema and
  re-export. Do not bend the frontend away from what the spec says.
- There are two contracts. Everything under `/api/` is ours (Ninja). Auth lives
  under `/_allauth/browser/v1/auth/` and is django-allauth's headless API: its
  spec is shipped with allauth, we only copy it (`openapi/allauth/`, a test compares
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
- Email + password only, no username. Email verification is **mandatory**
  (`ACCOUNT_EMAIL_VERIFICATION`): signing up, or logging in with an unconfirmed
  address, answers `401` with a pending `verify_email` flow and emails a link;
  nobody is signed in until it is opened (`isVerificationPending` in
  `auth/api.ts`, the pages show "check your email"). A signup with an existing
  address gets the same answer (enumeration prevention; its owner is emailed
  instead). "Resend email" on that screen logs in again with the typed credentials
  (`useResendVerification`; allauth's resend endpoint is for the code flow only);
  allauth sends one link per address every 3 minutes, so the button counts that down.
  Superusers from `createsuperuser` get a verified address automatically.
  Password rules are Django's validators; the frontend shows their messages.
- Emails (confirmation, password reset) are Django templates with an HTML and a
  text part in `backend/tangostack/apps/accounts/templates/account/email/`
  (`accounts` is listed before `allauth` in `INSTALLED_APPS` so they override
  allauth's). The links point at frontend pages configured in
  `HEADLESS_FRONTEND_URLS`: `/auth/verify-email/$key`, `/auth/forgot-password`,
  `/auth/reset-password/$key`. allauth takes those keys in request headers, which
  Orval drops, so `auth/api.ts` passes them by hand. A `401` from the verify and
  reset POSTs means "worked, nobody signed in".
- Every `/api/*` endpoint answers `401 {"detail": "Unauthorized"}` when logged
  out. Lists belong to `TodoList.owner`; every query is scoped to
  `request.user`, and someone else's list or todo is a `404` (never a 403).
- allauth's login errors are `400` with `param` (wrong password is
  `param: password`); `401` means "not authenticated" and carries
  `data.flows`. A successful **logout** (`DELETE session`) also answers `401`.
  Rate limits (e.g. one confirmation email per address every 3 minutes) live in
  the cache; tests clear it (`tangostack/conftest.py`) and e2e uses a new address
  per test (`uniqueEmail`).
- The frontend keeps the session in React Query (`src/auth/api.ts`). A `401`
  from the Ninja API marks the session logged out (`src/api/queryClient.ts`),
  and `AuthGate` redirects to `/login`. Routes: `/login`, `/signup` (guests
  only), `/` (signed-in only), `/auth/callback` (return from a provider),
  `/auth/verify-email/$key`, `/auth/forgot-password`, `/auth/reset-password/$key`.
- Social login: Google, redirect flow. A provider exists only when its
  credentials are set (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in
  `backend/.env`; redirect URI `https://dev.tangostack.com/accounts/google/login/callback/`),
  and the logged-out session lists it in the `provider_redirect` flow, which is
  what shows the button (`SocialLogin`). The start is a real form POST (allauth
  answers 302, not XHR); the backend returns to `/auth/callback`, with `?error=`
  on failure. `callback_url` must be same-origin or in `ALLOWED_HOSTS`. No
  email-based account linking yet (it was unsafe before emails were verified;
  revisit it deliberately, don't assume). The spec's `Flow` type lacks
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

| Path                                     | Purpose                                                           |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `openapi/openapi.json`                   | The contract, exported from Django Ninja (`make api-export`)      |
| `openapi/allauth/`                       | Copy of allauth's shipped spec (`openapi.yaml`, `description.md`) |
| `frontend/orval.config.ts`               | Orval config: `tangostack` (Ninja) and `auth` (allauth) entries   |
| `frontend/src/api/http.ts`               | Shared fetch core: CSRF header, mock-worker retry, `HttpError`    |
| `frontend/src/api/fetcher.ts`            | `customFetch` for generated code; throws `ApiError` (`detail`)    |
| `frontend/src/api/authFetcher.ts`        | `authFetch`; throws `AuthApiError` (`errors[]`, `fieldErrors`)    |
| `frontend/src/api/queryClient.ts`        | QueryClient: no retry on 4xx, Ninja 401 logs the session out      |
| `frontend/src/api/generated/`            | Generated Ninja client, hooks and models. Do not edit             |
| `frontend/src/api/generated-auth/`       | Generated allauth client, hooks and models. Do not edit           |
| `frontend/src/auth/api.ts`               | `useSession`, `useLogin`, `useSignup`, `useLogout` over generated |
| `frontend/src/mocks/db.ts`               | Typed seed data and in-memory store                               |
| `frontend/src/mocks/handlers.ts`         | One MSW handler per operation, returning Ninja-shaped responses   |
| `frontend/src/mocks/authHandlers.ts`     | allauth-shaped handlers (session, login, signup, logout)          |
| `frontend/src/mocks/{browser,server}.ts` | MSW worker (browser) and server (Node/vitest)                     |
| `frontend/src/mocks/enable.ts`           | Starts the worker; on in dev by default                           |
| `frontend/src/client.tsx`                | Client entry; awaits the worker before hydrating                  |
| `frontend/src/test/{setup,render}.ts(x)` | MSW lifecycle and `renderWithClient`                              |
| `frontend/src/test/renderApp.tsx`        | Real pages on a memory router (redirects, login flows)            |
| `frontend/src/test/factories.ts`         | `todo()` / `todoList()` typed fixtures for tests                  |

Env vars (`frontend/src/env.ts`): `VITE_API_URL` (default: same origin) and
`VITE_API_MOCKING` (`true`/`false`; default on in dev, off in production builds),
`VITE_API_MOCKING_KEEP_SESSION` (`true`: the mock login survives reloads, via localStorage).

Mock logins: `amanda@email.com` and `bruno@email.com`, password `password`, each
with their own lists. Mock signups stay unconfirmed until you open the emailed
link by hand: `/auth/verify-email/verify-<email>`; likewise
`/auth/reset-password/reset-<email>` for a password reset. Nobody is signed in after a reload unless
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
- Rendering is chosen per route with `ssr`. Public pages (`/`, the landing page)
  are server-rendered. The signed-in app (`/todo`) sets `ssr: false`: the server
  sends only the document shell and the browser does the rest. Fetch data with
  the generated hooks in components, not in route loaders: server-side fetching
  would bypass the browser worker and needs MSW-in-Node wiring, the backend's
  internal URL and cookie forwarding first. A product without public pages can
  drop the SSR server and ship a plain Vite SPA.
- `GET /healthz` (`routes/healthz.ts`) is the frontend's liveness probe.

## Frontend performance: what to measure as the product grows

Frontend only. The backend's metrics and logs are covered by its own
observability stack (`make obs`). Nothing here is set up yet: the app is a
small, mostly client-rendered to-do app, where the browser is what matters. For
a content-heavy, SEO-driven product (a store with many server-rendered pages),
measure in four layers.

1. **Real users (RUM), the source of truth.** `web-vitals` in the browser:
   LCP, INP, CLS, plus TTFB and FCP as diagnostics. Google ranks on field data
   (CrUX), not lab scores. Keep dimensions: page template, device class,
   connection, country, release, signed in or not. Read p75 per template and
   device, never averages. Search Console's Core Web Vitals report shows how
   Google sees the site.
2. **The SSR server (what produces TTFB).** This layer is the Node server plus
   the API calls it makes, so it overlaps with the backend. OpenTelemetry traces
   with a span per upstream fetch (the usual finding: a render waiting on one
   slow or serial call), render time per template, cache hit rate (CDN, page,
   data), correct `Cache-Control`/`s-maxage`, event loop lag and memory.
3. **What ships to the browser.** Bundle-size budgets per route, a bundle
   analyser, and third-party scripts (tag managers, chat, reviews), which are
   often the worst offenders for INP and LCP. Images are usually the LCP element:
   format (AVIF/WebP), `srcset`, explicit dimensions, `fetchpriority` on the
   hero. Hydration cost (JS run after the HTML arrives) drives INP: lazy-load
   below-the-fold components.
4. **Lab and synthetic (regression guard, debugging).** Lighthouse CI or
   WebPageTest on a fixed set of representative URLs per PR and on a schedule
   against production; DevTools traces to debug one page; synthetic checks from
   several regions. Lab says why, RUM says where.

**Loop:** group RUM by template and rank by p75 times traffic or revenue, use
the `web-vitals` attribution data (which LCP element, which interaction) to
tell server, image and render problems apart, reproduce in lab on a throttled
mid-range device, fix, then compare p75 before and after by release. Add a
budget or CI check so it doesn't regress, and tie the metrics to conversion so
fixes can be prioritised by money.

**Where to start:** `web-vitals` RUM with template and device dimensions,
Lighthouse CI on a few key URLs, bundle budgets, and OTel traces on the SSR
server. Errors and traces for the browser can go to Sentry (opt-in by DSN);
adding either needs approval for the new dependencies.

## Local dev stack (real backend over HTTPS)

Caddy (docker compose, `dev/caddy/Caddyfile`) serves `https://dev.tangostack.com`
and proxies `/api`, `/_allauth`, `/admin`, `/static` to Django (host `:8000`) and everything
else to Vite (host `:3000`). One origin, so no CORS.

One-time setup: add `127.0.0.1 dev.tangostack.com` to `/etc/hosts`; copy
`backend/.env.example` to `backend/.env`; `make proxy-up`, then
`make proxy-trust` (trusts Caddy's local CA; asks for sudo).

Every published port in `docker-compose.yaml` is bound to `127.0.0.1`, so nothing
(Postgres, Django, silk, Mailpit, Vite) is reachable from the LAN. Keep the
`127.0.0.1:` prefix on new services.

Daily: `make db-up mailpit celery proxy-up`, `make run`, `make fe-dev-api` (or `make fe-dev`
for mocks; the domain works for both).

`make mailpit` starts **Mailpit**, which catches all outgoing email and shows
it at <https://dev.tangostack.com/mailpit> (through Caddy; directly <http://localhost:8025/mailpit/>; SMTP on `:1025`). To use it from `make run`, put
the `EMAIL_*` lines from `backend/.env.example` in `backend/.env`; without them
development prints emails to the console. The backend container (`make up`) is
already wired to it. Nothing is ever delivered.

- **Observability** (OpenTelemetry metrics + logs -> collector -> Prometheus/Loki ->
  Grafana at <http://localhost:3001>) is opt-in and off by default: `make obs` starts
  the stack, `OTEL_ENABLED=true` in `backend/.env` turns the app side on. Details in
  `backend/README.md`; configs in `observability/` (the same files feed the server
  stack, see "Deployment").
- **django-silk** (request/SQL profiler) is on in dev at `/silk/` (no login; routed
  to Django by the Caddyfile). Dev dependency, so never in the prod image;
  `SILK_ENABLED=false` turns it off (the e2e backend does), and it refuses to
  start with `DEBUG` off. `make silk-clear` resets it.
- Vite allows the host and sends HMR over `wss` on 443 (`vite.config.ts`).
- Django reads `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `BEHIND_PROXY`, `SECRET_KEY`,
  `DEBUG` from env (`backend/.env`, git-ignored).
- The production proxy will be Coolify's Traefik or Dokku's nginx (TBD), so this
  setup mirrors routing, not the platform's proxy config.

## Containers

`backend/Dockerfile` and `frontend/Dockerfile` are multi-stage with two targets:
`prod` (the default; what gets deployed) and `dev` (what compose runs).

- **backend `prod`**: `python:3.14-slim` + venv (`/opt/venv`, outside `/app` so
  bind mounts can't hide it) + code + `collectstatic`, gunicorn (gevent), non-root,
  `DEBUG=false` (settings refuse to start without a real `SECRET_KEY`). It does
  **not** migrate on start: run `manage.py migrate` as a separate step/release
  command. Static files: WhiteNoise serves `STATIC_ROOT` (baked in by `collectstatic`)
  when `DEBUG` is off, with hashed names and gzip; `runserver` serves them in development.
- **frontend `prod`**: only Nitro's `.output` on plain alpine + the node binary.
  `VITE_*` values are build args (compiled into the client bundle).
- **`dev`** (docker-compose.yaml): source bind-mounted (live reload), dev deps,
  `runserver` / `vite dev`. Same ports (8000/3000) as running on the host, so Caddy
  works either way; run one or the other. `DATABASE_URL` points at the `postgres`
  service. The frontend keeps its own `node_modules` (and pnpm's `.claude/skills`)
  in named volumes, re-synced at start with `pnpm install`.
- Python deps stay in `pyproject.toml`/`uv.lock` only (`uv sync --frozen`); pnpm in
  the image is pinned to `packageManager` (`PNPM_VERSION` build arg).
- `make up` / `down` / `build` / `build-prod` / `logs` / `bash` / `shell_plus`.
  The other `make` targets (`run`, `migrate`, `test`, ...) still run on the host.
- `backend/.env` is bind-mounted into the dev container and excluded from images
  (`.dockerignore`): production config comes from env vars.

### Deployment (Kamal, one VPS)

Staging and production run on one VPS (Ubuntu, Docker) deployed with
[Kamal](https://kamal-deploy.org) 2.12. Everything is in the repository: no dashboard
is involved besides Cloudflare DNS/SSL, Resend and GitHub.

- **Services.** `deploy/config/deploy.backend.yml` and `deploy/config/deploy.frontend.yml`, one
  Kamal service each, behind a single `kamal-proxy` per host. The backend serves
  `/api`, `/_allauth`, `/accounts`, `/admin` and `/static` (path prefixes, not
  stripped); the frontend is the root service and owns the TLS settings. Routing is
  longest-prefix-first (kamal-proxy's `service_map.go`).
- **Environments** are Kamal *destinations*: `-d staging|production` merges
  `deploy/config/deploy.<service>.<destination>.yml` and reads `.kamal/secrets-common` then
  `.kamal/secrets.<destination>`. Those files only hold variable names; the values
  come from the environment (`deploy/deploy.sh` sources
  `~/.config/tangostack/<destination>.env`, which must also set `SSH_KEY_FILE`, the
  deploy user's private key). `deploy/defaults.sh` works out the rest: the registry
  owner from the `origin` remote, the registry login from `gh`; both can be overridden
  there (`REGISTRY_OWNER`, `REGISTRY_USER`).
  Staging is `staging.treinor.com.br`, production `treinor.com.br`; the host's IP
  is the `DEPLOY_HOST` variable, kept out of the repository.
- **Images** are built, smoke-tested (`.github/scripts/smoke-test.sh`) and pushed by
  CI as `ghcr.io/<owner of the origin remote>/tangostack-{backend,frontend}:<full commit sha>` (also
  `:latest`, `:sha-<short>`). Kamal deploys them with `--skip-push --version <sha>`
  and refuses an image whose `service` label differs from its config, so the
  Dockerfiles' prod stages carry `LABEL service=...`.
- **Migrations** run when the backend container starts (`cmd` in the backend config),
  before kamal-proxy switches traffic: the old version keeps serving during them, so
  they must stay backward compatible (add, then remove later).
- **PostgreSQL** is a Kamal accessory per environment (`tangostack-backend-<env>-db`,
  data in the host's `.kamal` directories), reachable only by name on Kamal's docker
  network. Kamal never updates it. Backups: `deploy/backup-db.sh` (see "Backups" below).
- **Valkey and the worker** (see "Email delivery"). Valkey is a second accessory
  (`tangostack-backend-<env>-valkey`, password `VALKEY_PASSWORD` because both
  environments share the docker network, AOF persistence in the host's `.kamal`
  directories). The worker is a second *role* of the backend service: same image as
  `web`, `cmd` is `celery -A tangostack worker`, no proxy, a Docker health command
  (`celery inspect ping`) visible in `kamal app details`. `CELERY_BROKER_URL` is a
  secret built in `.kamal/secrets.<env>` from `VALKEY_PASSWORD`.
- **Zero downtime.** The new container must pass its health check (`/api/health`,
  `/healthz`) before the proxy switches; the old one drains (`drain_timeout`) and is
  stopped (`stop_timeout`, 100 s: longer than a task's 90 s hard limit, so a deploy
  doesn't kill a running task; containers that exit at once don't wait for it). The
  worker restarts on every deploy (warm shutdown: it finishes running tasks, queued
  ones wait in Valkey for the new worker). Web and worker briefly run different versions,
  so a task's arguments may only grow (new ones optional with defaults, never renamed
  or removed), and a task using new columns must tolerate a migration that hasn't
  run yet (retry).
- **TLS** is a Cloudflare Origin CA certificate (`TLS_CERT`/`TLS_KEY`, wildcard for
  the domain) with Cloudflare on Full (strict). Reading a PEM drops the newline after
  its END line, which kamal-proxy rejects: `deploy/deploy.sh` restores it.
- **Real client IPs:** `TRUSTED_CLIENT_IP_HEADER=CF-Connecting-IP` (allauth's
  `ALLAUTH_TRUSTED_CLIENT_IP_HEADER`); only valid while every request comes through
  Cloudflare, otherwise allauth rejects it.

CI (`.github/workflows/ci.yaml`): pull requests and pushes to `main` run the backend
and frontend checks (Playwright e2e is not in CI). A push to `main` that passes builds
both images, smoke-tests them and pushes them; `prune` then deletes all but the
newest 10 tagged versions (`.github/scripts/prune-images.sh`; the free plan has
500 MB for private packages). CI does not deploy: private repos on the free plan
have no environment approval gates, so deploying is `make deploy` from the laptop,
with the secrets in `~/.config/tangostack/<env>.env`. Actions are pinned to commit
SHAs; bump them by hand.

By hand: `make deploy env=staging|production` deploys HEAD. `make deploy env=... rollback`
lists the last 10 commits (number, ✓/✗ for built images, sha, date, message) and
deploys the one you type. `sha=<full sha>` is for anything older. If the commit has
no images, it offers to build them through CI's manual trigger (`workflow_dispatch`:
checks, smoke test, push without `latest`, no deploy), waits, then deploys. Production
asks `[y/N]`. Logs: `make deploy-logs env=... [svc=backend|worker|frontend] [lines=N]`. Both need
`~/.config/tangostack/<environment>.env` and `gh` logged in. The logic is `deploy/release.sh`.

Backups: `deploy/backup-db.sh <env>` runs from the `deploy` user's cron at 03:17
(staging) and 03:47 (production) UTC, `pg_dump`s into
`s3://tangostack/backups/<env>/` on Cloudflare R2 and logs to `~/backup.log`.
Credentials: `~/.backup.env` on the server (mode 600, bucket-scoped token). The bucket's
lifecycle and lock rules do the retention; the script never deletes. Restore:
download the dump, `pg_restore --no-owner -d <db> <file>` (tested into a throwaway
Postgres). To change the script, copy it to `/home/deploy/backup-db.sh`.

First deploy of a new server: `deploy/bootstrap-server.sh` (Docker, `deploy` user,
swap, fail2ban, unattended upgrades, SSH lockdown), then
`deploy/deploy.sh <environment> <sha> --first` (boots the proxy, the database and
Valkey). An environment created before Valkey existed needs it once:
`deploy/with-env.sh <env> "$(command -v kamal || echo ~/.gem/ruby/*/bin/kamal)" accessory boot valkey -c deploy/config/deploy.backend.yml -d <env>`
(with `VALKEY_PASSWORD` in `~/.config/tangostack/<env>.env`).
Logs: `make deploy-logs env=staging svc=worker`. Django hides 500
tracebacks with DEBUG off unless the console logging in `settings.py` is kept.

Observability on the server: ONE stack for both environments
(`deploy/config/deploy.observability.yml`, accessories only: `otel-collector`,
`prometheus`, `loki`, `grafana`; service `tangostack-observability`). The backends
(web and worker) send OTLP to `tangostack-observability-otel-collector:4318` over
Kamal's docker network, tagged with `OTEL_ENVIRONMENT` (set per destination) so the
dashboard's Environment filter separates staging from production. The collector also
scrapes both Postgres databases, the containers and the host (overlay
`observability/otel-collector.prod.yaml`). Only Grafana is exposed, at `GRAFANA_HOST`
(`grafana.<domain>`, behind kamal-proxy with the Origin CA cert, login required,
anonymous off; a Cloudflare DNS record for it must exist). Retention: metrics 30 d,
logs 14 d. Data lives in Docker named volumes `tangostack-observability-*`.
`make obs-deploy [svc=...]` re-applies config/dashboards (reboots the accessories; data
is kept), `first=1` for the first boot; `make obs-logs svc=...`. Logic in
`deploy/obs.sh`; it reads the server, key, cert and DB passwords from the staging and
production env files plus `~/.config/tangostack/observability.env` with `GRAFANA_HOST`
and `GF_SECURITY_ADMIN_PASSWORD`. Boot the stack before deploying a backend with
`OTEL_ENABLED` on (without it the exporters just log and drop).

Several apps on one host must not share a name: container names carry the
destination, and the two databases are named per environment on purpose.

## Security headers

Django sends nosniff, `Referrer-Policy: same-origin`, the opener policy and
`X-Frame-Options: DENY` by default (`SecurityMiddleware`, `XFrameOptionsMiddleware`).
On top (`settings.py`, "SECURITY HEADERS"):

- **HSTS:** `SECURE_HSTS_SECONDS` (0 in dev; Kamal sets six months). Only on HTTPS
  requests, no `includeSubDomains`/`preload` (hard to undo).
- **CSP** for what Django serves (admin, allauth pages): `CSP_MODE=off|report|enforce`.
  `report` (the default) sends `Content-Security-Policy-Report-Only`: violations show in
  the browser console and nothing is blocked. Move the Kamal config to `enforce` once
  staging's admin and login pages are clean. The API docs page has its own looser policy
  (`tangostack/api.py`, Swagger loads from jsDelivr). The health check skips all of
  this (it answers before the middleware).
- **Frontend** (every page that isn't Django's): static headers on every response, static
  files included, from Nitro's `routeRules` in `vite.config.ts` (HSTS six months,
  nosniff, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`,
  opener policy). The CSP is `src/csp-middleware.ts` (registered in `src/start.ts`): a
  fresh nonce per request, `script-src 'nonce-…' 'strict-dynamic'`, passed to the router
  with `ssr: { nonce }` in `router.tsx` so the streamed inline scripts carry it. Same
  `CSP_MODE=off|report|enforce` (runtime env, Kamal), report by default; not sent in
  dev (Vite's inline scripts have no nonce). A new origin the page talks to (separate API
  host, analytics, fonts) has to be added to the policy there, or it is blocked once
  enforced. To check a change: build, run `node .output/server/index.mjs` with
  `CSP_MODE=report` and look for "violates the following Content Security Policy" in a
  browser console.

## Email delivery (Celery)

Email is sent in the background: Celery with Valkey as the broker. allauth's adapter
(`accounts/adapter.py`) renders every email it sends and calls `queue_email`
(`core/tasks.py`), which enqueues the `core.send_email` task once the transaction
commits. The code is the same in every environment; what differs is the setup:

- **Local:** `make celery` starts Valkey and the worker as containers (`make up` starts
  them too; `make celery-logs` follows the worker). The worker restarts when Python
  files change and also serves a backend run on the host with `make run`, which
  reaches the same Valkey on `localhost:6379`. Without a running worker, emails wait
  in the queue and never reach Mailpit. A worker on the host itself, if you ever need
  one, needs `uv run celery -A tangostack worker --pool=threads` on macOS: the default
  prefork pool fails to start tasks there (it works in the Linux container).
  In tests tasks run inline (`CELERY_TASK_ALWAYS_EAGER`, see `conftest.py`): no broker
  needed. The `broker` fixture (kombu's `memory://`, still no server) queues for real and
  `broker.run_queued()` runs what a worker would; see `core/tests/test_queue.py`.
- **Staging and production:** a Valkey accessory and a `worker` role per environment
  (see "Deployment"). Broker down means the first fallback below. The worker's logs:
  `make deploy-logs env=... svc=worker`; its state: `kamal app details` (health).

How it fails:

- *Broker unreachable when enqueueing* (5 s connect/read timeouts): the request sends
  the email itself, synchronously, with no retries. If the provider refuses that too it
  is only logged, and the request still answers normally.
- *The worker can't deliver* (provider down or refusing, e.g. an unverified sender
  domain): the task retries 5 times with a jittered exponential backoff (about 30 s, 1,
  2, 4, 8 min), then fails for good and is logged. There is no synchronous fallback and
  the user isn't told; the check-your-email screen's resend button is their way out.
- *The worker isn't running* (broker fine): enqueueing works, so nothing falls back;
  tasks wait in the queue and are sent when a worker starts. Nothing reports it, so
  watch that the worker is alive.

Tasks use `acks_late`, so a task whose worker dies is run again: they must be safe to
run twice. With Valkey as the broker that happens when the worker shuts down cleanly,
but after a SIGKILL only once the visibility timeout (1 hour) passes: the email is late,
not lost.

## Commands (run from the repository root)

- `make api-export`: export Ninja's OpenAPI schema to `openapi/openapi.json` and copy allauth's spec to `openapi/allauth/`
- `make fe-api-generate`: regenerate both frontend clients from the specs in `openapi/`
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
  servers. The only prerequisite is Postgres (`make db-up`); `make e2e-backend`
  starts the `mailpit-e2e` container itself (SMTP `:1026`, UI/API `:8026`, apart
  from the dev Mailpit).
  - Tests run serially; `e2e/fixtures.ts` flushes the e2e database (users
    included) before every test (`make e2e-flush`, e2e DB only). Import
    `test`/`expect` from there.
  - The `api` fixture signs up a new `amanda.<random>@email.com` in the page's
    browser context and sends the CSRF token for you; use it (not `request`) to
    seed data, so the page and the API calls share one session. `signUp` and
    `csrfApi` build other users (see `e2e/auth.spec.ts`). `signUp` goes through
    the real email: it reads the confirmation link from Mailpit's API
    (`emailedLink`), which also lets tests drive the verify and reset pages. The
    inbox is emptied before every test.
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
