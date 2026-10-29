# Tangostack

A to-do app, built as a full-stack template: a **TanStack Start** (React 19)
frontend talking to a **Django + Django Ninja** API over a single HTTPS origin,
with **PostgreSQL**, cookie-session auth through **django-allauth** (email +
password, Google), and a typed API client generated from the backend's OpenAPI
contract.

| Part     | Stack                                                                                    |
| -------- | ---------------------------------------------------------------------------------------- |
| Frontend | TanStack Start/Router/Query, React 19, shadcn/ui on Base UI, Tailwind 4, Vite, Orval, MSW |
| Backend  | Python 3.14, Django 6.1, Django Ninja, django-allauth (headless), Gunicorn               |
| Data     | PostgreSQL 18                                                                            |
| Tooling  | uv, pnpm, Docker Compose + Caddy, pytest, Vitest, Playwright, Ruff, Oxlint/Oxfmt         |

## How it works

```text
                     https://dev.tangostack.com  (Caddy, one origin: no CORS)
                                      │
            ┌─────────────────────────┴──────────────────────────┐
   /api/*  /_allauth/*  /accounts/*  /admin/*  /static/*          everything else
            │                                                      │
   Django (Ninja + allauth) :8000                       TanStack Start (Vite/Nitro) :3000
            │                                                      │
        PostgreSQL :5432                          browser app ── generated API client
```

- **One origin.** A reverse proxy serves the app and the API from the same
  host, so the session cookie is a plain first-party cookie and there is no CORS.
  Locally that is Caddy; in production it will be the platform's proxy.
- **The backend owns the API contract.** Django Ninja generates an OpenAPI
  schema (`openapi/openapi.json`); Orval turns it into typed React Query hooks
  in the frontend. Auth is allauth's headless API, whose spec ships with allauth
  and is copied to `openapi/allauth/`. Neither generated client is hand-edited.
- **Auth is a session cookie.** Log in with email + password or Google; the
  same Django session authenticates the Ninja API (CSRF enforced). Every list
  belongs to its owner and every query is scoped to the signed-in user.
- **Frontend-first workflow.** New screens are sketched against mock data
  (MSW), then the backend builds the real models and endpoints, the contract is
  exported and the frontend conforms to it. See
  [`AGENTS.md`](AGENTS.md#feature-workflow-sketch-on-the-frontend-build-on-the-backend).

## Repository layout

```text
.
├── backend/               Django project (see backend/README.md)
├── frontend/              TanStack Start app (see frontend/README.md)
├── openapi/               The API contract, committed
│   ├── openapi.json         Ninja's schema (generated: make api-export)
│   └── allauth/             Copy of allauth's shipped spec
├── caddy/Caddyfile.dev    Local HTTPS proxy routing
├── docker-compose.yaml    postgres, caddy, and the dev backend/frontend containers
├── Makefile               Every common command (make help)
├── dkdata/                Git-ignored: Postgres data, Caddy certificates
├── AGENTS.md              Repository-wide conventions and workflow
└── backend/AGENTS.md      Backend-specific rules
```

## Getting started

**Prerequisites:** Docker (OrbStack works well), [uv](https://docs.astral.sh/uv/),
Node 26+ and pnpm (the version pinned in `frontend/package.json`).

```bash
make fe-install                       # frontend dependencies
cp backend/.env.example backend/.env  # local settings (git-ignored)
make db-up mailpit                    # PostgreSQL + Mailpit (catches outgoing email)
make migrate && make superuser        # schema + an admin user
```

Then pick one way to run the apps. Both serve the same ports, so run one or the
other, not both:

```bash
# On the host (fastest feedback)
make run                # Django on :8000
make fe-dev-api         # frontend on :3000 against the real backend
make fe-dev             # frontend alone with a mocked API (no backend needed)

# Or in containers (source is bind-mounted, so live reload still works)
make up                 # postgres + backend + frontend
make bash               # a shell inside the backend container
make shell_plus         # Django shell_plus inside the backend container
```

### HTTPS on `dev.tangostack.com` (optional, needed for Google login)

1. Add `127.0.0.1 dev.tangostack.com` to `/etc/hosts`.
2. `make proxy-up`, then `make proxy-trust` once (trusts Caddy's local CA; asks
   for sudo).
3. Open <https://dev.tangostack.com>.

For Google login, create an OAuth client and put `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` in `backend/.env` (redirect URI:
`https://dev.tangostack.com/accounts/google/login/callback/`). Without them the
Google button is simply hidden.

## Everyday commands

Run everything from the repository root; `make help` lists all targets.

| Task                          | Command                                      |
| ----------------------------- | -------------------------------------------- |
| Backend tests                 | `make test` (`args="-k name"`)               |
| Backend lint / format         | `make lint` / `make format`                  |
| New / apply migrations        | `make makemigrations` / `make migrate`       |
| Frontend checks               | `make fe-check` (lint, format, types, tests) |
| End-to-end tests (real stack) | `make fe-e2e` (needs `make db-up`)           |
| Export contract + regenerate  | `make api-generate`                          |
| Production images             | `make build-prod`                            |
| Read the emails the app sends | <http://localhost:8025> (Mailpit, `make mailpit`) |

### Changing the API

1. Change the Ninja endpoint/schemas in `backend/` (and add tests).
2. `make api-generate` exports `openapi/openapi.json` and regenerates the
   frontend client.
3. Fix whatever `make fe-check` reports, then run the backend tests.

Backend tests fail if `openapi/` is stale, so a forgotten export can't be committed.

## Testing

- **Backend:** pytest against a real PostgreSQL, ~99% coverage (`make test`).
- **Frontend:** Vitest + Testing Library with MSW (`make fe-test`).
- **End to end:** Playwright drives the real frontend against the real Django
  and PostgreSQL, using its own database and ports (`make fe-e2e`). It never
  touches your dev data.

## Containers and deployment

Both `backend/Dockerfile` and `frontend/Dockerfile` are multi-stage with two
targets: `prod` (the default, minimal, non-root) and `dev` (what
`docker-compose.yaml` runs). `make build-prod` builds the production images
(about 290 MB backend, 160 MB frontend). The backend does not migrate on start:
run `manage.py migrate` as a separate release step. The hosting platform is not
decided yet; see "Containers" in [`AGENTS.md`](AGENTS.md) for what is and isn't
settled.

## Documentation map

| Read                                         | For                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| [`backend/README.md`](backend/README.md)     | How the Django backend is structured and the rules it follows          |
| [`frontend/README.md`](frontend/README.md)   | Frontend layout and shadcn workflow                                    |
| [`AGENTS.md`](AGENTS.md)                     | Feature workflow, auth, API conventions, mocks, dev stack, containers |
| [`backend/AGENTS.md`](backend/AGENTS.md)     | Detailed backend rules (also the rules AI assistants follow)           |
