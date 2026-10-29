# Backend Agent Instructions

These instructions apply to everything under `backend/`. Follow them
alongside the repository-root `AGENTS.md`, if present. If instructions
conflict, follow the more specific instruction for the backend unless
the root instruction explicitly establishes a repository-wide
requirement.

## Project Context

Tangostack is a full-stack application composed of:

- **Frontend:** TanStack Start / TypeScript, maintained under
  `frontend/`.
- **Backend:** Django with Django Ninja, maintained under `backend/`.
- **Database:** PostgreSQL.
- **API contract:** Django Ninja generates the OpenAPI schema; the
  frontend's Orval workflow generates the TypeScript API client from
  that schema.

The backend is the source of truth for API behavior, request/response
schemas, validation, and the OpenAPI contract. Do not use Django REST
Framework unless the project owner explicitly changes this decision.

**Current state:** `apps/accounts` holds the custom user model and
`apps/core` holds the to-do domain (`TodoList`, `Todo`) and its API. Django
Ninja is wired up: `tangostack/api.py` creates the `NinjaAPI` instance (with
`auth=django_auth`), mounts the `core` router, and `tangostack/urls.py` serves
it at `/api/`. Authentication is django-allauth's headless **browser** client
(session cookie + CSRF) at `/_allauth/browser/v1/`: email + password, no
username, mandatory email verification (`settings.py`, "AUTHENTICATION";
emails are sent through `MAILERS`, "EMAIL"). Lists are
owned (`TodoList.owner`) and every query is scoped to `request.user`; another
user's rows are 404. The exported OpenAPI schema is committed as
`openapi/openapi.json` at the repository root, next to a copy of allauth's shipped
spec in `openapi/allauth/` (`make api-export` writes both; tests fail when stale).
Google login (allauth's redirect flow) is configured and only active when
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set.

## Stack and Dependencies

Respect the current backend `pyproject.toml` as the authoritative
dependency manifest. The established baseline includes:

- Python `>=3.14` (`.python-version` pins `3.14`), managed with `uv`
- Django `>=6.1.2`
- Django Ninja `>=1.7.1`
- PostgreSQL through `psycopg[binary] >=3.3.6`
- `dj-database-url` for database URL configuration
- `python-decouple` for environment-based settings
- `Gunicorn[gevent]` for serving the application
- `django-allauth` with its headless and social-account functionality

Development, testing, and diagnostics dependencies include pytest,
pytest-django, pytest-cov, pytest-xdist, coverage, Ruff, django-stubs,
django-extensions, django-silk, ipdb, and IPython.

Do not add, remove, or upgrade dependencies casually. Check the existing
`pyproject.toml` and lockfile first, and keep dependency changes
intentional and reproducible. Use the project's existing environment and
lockfile workflow; do not introduce a second Python package manager.

## Repository Organization

The repository root holds `backend/`, `frontend/`, and
`docker-compose.yaml` (PostgreSQL 18.6, data in the git-ignored
`dkdata/`). The backend layout is:

```text
backend/
├── AGENTS.md
├── manage.py
├── pyproject.toml            # deps, Ruff and pytest config
├── uv.lock
├── .python-version
├── scripts/
│   └── startapp.py           # used by `make startapp`
├── Dockerfile                # prod and dev targets (see the root AGENTS.md)
└── tangostack/               # Django project package (no config/ dir)
    ├── settings.py           # single settings module
    ├── api.py                # NinjaAPI instance; add each app's router here
    ├── urls.py
    ├── conftest.py           # shared fixtures: user, other_user, api_client
    ├── asgi.py
    ├── wsgi.py
    └── apps/
        ├── core/             # shared infrastructure + the to-do domain
        │   ├── models.py     # TodoList, Todo
        │   ├── schemas.py    # Ninja request/response schemas
        │   ├── api.py        # Ninja router (list/create/update endpoints)
        │   ├── migrations/   # 0001 collation, 0002 to-do models
        │   └── tests/        # test_models/api/admin/ownership/openapi.py
        └── accounts/         # custom user model
            ├── models.py     # CustomUser
            ├── managers.py   # CustomUserManager
            ├── openapi.py    # locates allauth's shipped OpenAPI spec
            ├── forms.py
            ├── admin.py
            ├── views.py
            ├── migrations/0001_initial.py
            └── tests/        # test_customuser, test_auth_flow, test_social_login
```

Apps are registered as `tangostack.apps.<name>`. Follow this layout when
adding apps; there is no top-level `tests/` directory yet.

### Creating Apps

All new Django apps must live in `tangostack/apps/`. Never run a bare
`manage.py startapp` (it creates the app in the wrong place with the
wrong `name`). Create apps from the repository root with:

```bash
make startapp name=<app_name>   # snake_case, e.g. billing_items
```

This runs `backend/scripts/startapp.py`, which:

1. runs `manage.py startapp` into `tangostack/apps/<app_name>/`;
2. rewrites the app's `apps.py` so the config uses the full dotted path,
   as in `apps/core/apps.py`:

   ```python
   class BillingItemsConfig(AppConfig):
       name = "tangostack.apps.billing_items"
   ```

3. adds `"tangostack.apps.<app_name>"` to `INSTALLED_APPS` in
   `tangostack/settings.py`, keeping the project apps sorted.

The script rejects missing, invalid (non snake_case), or already
existing names. If you create or rename an app by hand, make the same
two changes (`apps.py` `name` and `INSTALLED_APPS`) yourself. After
creating an app, remove unused scaffold imports (the generated
`admin.py`, `models.py`, `tests.py`, `views.py` stubs fail
`ruff check` with F401 until filled in) and add the app's tests under
its `tests/` package or `tests.py`.

- `tangostack/` contains project configuration and Django entry points.
- Each Django app owns its domain models, API endpoints and schemas,
  migrations, and app-specific tests.
- `apps/core` holds cross-cutting database setup. Its migration creates
  the `case_insensitive` ICU collation used by `CustomUser.email`; apps
  that use it must depend on that migration.
- Each app keeps its Django Ninja request/response schemas in `schemas.py`
  and its routes in a `Router` in `api.py`; register the router in
  `tangostack/api.py`.
- Put reusable domain operations in `services.py` when doing so keeps
  endpoints thin and logic reusable. Do not create service layers or
  abstractions that add no value.
- Keep cross-app orchestration explicit and avoid circular imports.
- Keep tests close to their app when useful; use `backend/tests/` for
  genuinely cross-app behavior.

## Django and API Design

- Use Django and Django Ninja idiomatically. Prefer the ORM over
  handwritten SQL unless SQL is justified by correctness or
  performance needs.
- Keep API handlers focused on HTTP concerns: parse and validate
  input, enforce authorization, call domain logic, and return a
  deliberate response.
- Define explicit request and response schemas. Avoid exposing Django
  model instances or internal fields without deliberate schema design.
- Use clear, stable API operation IDs so OpenAPI generation and Orval
  client generation remain predictable.
- Make status codes, error responses, pagination, filtering, and
  ordering intentional and consistent with existing API conventions.
- Validate untrusted input at the API boundary. Do not rely on
  frontend validation for security or data integrity.
- Enforce authorization on the backend for every protected operation.
  Authentication alone does not establish permission to access a
  particular object's data.
- Avoid duplicating business rules across endpoints. Put shared rules
  in a suitable domain/service function or model method.
- Use transactions for operations that must succeed or fail
  atomically.
- Prefer explicit, maintainable ORM queries. Avoid N+1 queries; use
  `select_related`, `prefetch_related`, and query inspection where
  appropriate.
- Do not introduce Django REST Framework serializers, viewsets,
  routers, or permissions into this Django Ninja codebase.

## Settings, Secrets, and Configuration

- Read environment-specific values from configuration/environment
  variables using the existing `python-decouple` and `dj-database-url`
  setup. The database comes from `DATABASE_URL`, defaulting to
  `postgres://postgres:postgres@localhost:5432/tangostack` (matches
  `docker-compose.yaml`).
- Never hardcode secrets, credentials, production URLs, or
  environment-specific database details. Note that `SECRET_KEY`,
  `DEBUG`, and `ALLOWED_HOSTS` come from env vars; the `SECRET_KEY` default
  is an insecure dev value, and settings refuse to start with it when
  `DEBUG` is off.
- Never commit `.env` files or credentials (`.env` is git-ignored).
  `.env.example` lists the variables with safe placeholder values; keep
  it in sync when adding one. `python-decouple` reads only `.env`, not
  `.env.local`.
- There is a single `settings.py`; there are no separate dev, test, or
  production settings modules. Introduce environment separation
  deliberately rather than ad hoc.
- PostgreSQL is required, including for tests: the schema uses an ICU
  non-deterministic collation and `django.contrib.postgres` operations
  that SQLite cannot run. A stray `db.sqlite3` in `backend/` is unused
  and git-ignored.
- Do not disable security protections merely to make local development
  or tests pass.

## Database Models and Migrations

- Treat Django migrations as version-controlled application code.
- When changing models, create and review the corresponding
  migrations; do not edit an already-applied migration to change its
  historical meaning.
- Keep migrations deterministic and suitable for deployment to a
  database containing existing data.
- Consider data migrations, locking, nullability, defaults, and
  backward compatibility when changing existing fields or constraints.
- Add database constraints and indexes where they are needed to
  preserve invariants or support demonstrated query patterns.
- Do not perform destructive database operations or reset databases
  unless explicitly requested and the target environment is confirmed
  to be disposable.
- Test model and migration changes against PostgreSQL where behavior
  depends on PostgreSQL.
- Every migration must declare dependencies on all apps whose models
  it references (e.g. `accounts.0001_initial` depends on
  `auth.0012_alter_user_first_name_max_length` for its `groups` and
  `user_permissions` relations, and on `core.0001` for the collation).
  A missing dependency causes errors like
  `Related model 'auth.group' cannot be resolved`.
- Test runs execute migrations (`--no-migrations` is intentionally not
  used) because the collation is created by a migration. Keep
  migrations runnable from an empty database.

## Authentication and Accounts

- `AUTH_USER_MODEL = "accounts.CustomUser"`. The user has no
  `username`; `email` is `USERNAME_FIELD`, unique, and case-insensitive
  via the `case_insensitive` collation. Create users through
  `CustomUserManager` (`create_user` / `create_superuser`), which
  normalizes email and requires a password argument. Always reference
  the model via `get_user_model()` / `settings.AUTH_USER_MODEL`.
- The admin (`CustomUserAdmin`) searches via an annotated deterministic
  collation (`und-x-icu`) because non-deterministic collations do not
  support `LIKE`/`icontains`; keep that when editing the admin.
- Authentication is django-allauth (headless, browser client) with the
  Google provider, configured in `settings.py` ("AUTHENTICATION") and
  mounted in `urls.py`. Do not implement a parallel authentication
  system. Social linking by email stays off; now that signup verifies emails,
  turning it on is a deliberate, separate decision.
- Email goes through Django 6.1's `MAILERS` setting (the `EMAIL_*` settings are
  deprecated and cannot be mixed with it), driven by `EMAIL_*` env vars; plain
  SMTP, so any provider works. The allauth email templates are overridden in
  `apps/accounts/templates/account/email/` (this app must stay before `allauth`
  in `INSTALLED_APPS`). Mailpit catches email locally; tests use the in-memory
  outbox (`mail.outbox`). `create_superuser` also creates a verified
  `EmailAddress`, otherwise the user could not log in through the app.
- Before changing authentication, session, cookie, CSRF, social-login,
  or account behavior, inspect the current settings and existing
  integration tests.
- Keep secrets and tokens out of logs and error responses.
- Do not weaken password, session, CSRF, redirect, or account-security
  protections to simplify integration with the frontend.
- Make authorization and ownership checks explicit in API endpoints
  and test both allowed and denied access.

## Frontend Contract and OpenAPI

The backend owns the API contract consumed by TanStack Start. The frontend
sketches screens against mocks first, but the final shape of the API is whatever
the Ninja schemas here say; the frontend then conforms to it (see the root
`AGENTS.md` for the full workflow and the API conventions).

When changing an endpoint or schema:

1. Update the Django Ninja endpoint and its request/response schemas. Set
   `operation_id` explicitly, declare every status code the endpoint returns
   (including `404` and `422`), and keep operation IDs stable unless a
   deliberate rename is required.
2. Run `make api-export` from the repository root. It writes the schema to
   `openapi/openapi.json`, which is committed. `test_openapi.py` fails when that
   file is stale.
3. Run `make fe-api-generate` (or `make api-generate` for steps 2 and 3) to
   regenerate the Orval client in `frontend/src/api/generated/` (committed).
4. Fix whatever the frontend typecheck reports (mocks, seed data, UI, tests) and
   run `make fe-check`.
5. Run the backend tests.

Do not hand-edit `openapi/openapi.json` or the generated TypeScript client. Do not
maintain a separate handwritten copy of API types in the backend and frontend.
If a schema change is intentionally breaking, identify the compatibility impact
and coordinate the change with the frontend.

- Use `Status(code, body)` for non-default status codes; returning a
  `(code, body)` tuple is deprecated in Ninja.
- Strip and validate text input in the schema (`StringConstraints`), with
  `max_length` equal to the model's column size.
- Use `save()` when updating a model instance so `auto_now` fields are bumped;
  `QuerySet.update()` skips them.
- Prefetch related rows in list endpoints and cover the query count with
  `django_assert_num_queries`.

## Testing

Use pytest as the backend test runner, with pytest-django for Django
integration. Configuration lives in `pyproject.toml`:
`DJANGO_SETTINGS_MODULE = tangostack.settings`, `testpaths = ["tangostack"]`,
files named `tests.py` or `test_*.py`, and
`--reuse-db`, durations and coverage `addopts`.

- Tests need the PostgreSQL container running
  (`docker compose up -d postgres` from the repo root).
- `--reuse-db` keeps the test database between runs. After changing
  migrations or models, run once with `--create-db` so a stale test
  database does not hide or cause errors.
- Existing style: plain pytest classes/functions, module-level
  `pytestmark = pytest.mark.django_db`, and the `django_user_model`
  fixture. Prefer this over `django.test.TestCase`. (`core/tests.py`
  is an empty startproject stub.)

- Write tests for behavior, not implementation details.
- Cover successful responses, invalid input, authentication,
  authorization, and relevant edge cases for API endpoints.
- Test business rules independently when they have meaningful logic.
- Test database behavior and constraints, not just mocked service
  calls.
- Use mocks for external boundaries where appropriate, but do not
  substitute mocks for the database in tests intended to verify ORM
  behavior.
- Use parametrization for related input cases and fixtures for
  reusable setup.
- Keep tests isolated, deterministic, and safe to run in parallel when
  using pytest-xdist.
- Avoid tests that depend on execution order, real external services,
  or production credentials.
- Use coverage to identify important untested paths; do not optimize
  solely for a coverage percentage.

For full-stack end-to-end verification, the intended architecture is the
real TanStack Start frontend calling the real Django Ninja backend and a
real PostgreSQL database, with Playwright driving the user flow. Backend
tests remain useful and faster, but do not describe mocked frontend
tests as full-stack E2E tests.

## Code Quality and Type Checking

- Use Ruff for the linting and formatting conventions configured in
  `pyproject.toml`: lint rules `DJ`, `E`, `F`, `W`, `I`, `UP`, `B`
  (plus Ruff defaults); `E501` is ignored in migrations and
  `settings.py`. Formatting uses Ruff defaults (double quotes).
  `ruff check .` currently reports pre-existing errors in generated
  startproject files; do not mass-fix them as part of unrelated work.
- `django-stubs` is a dev dependency, but no mypy or django-stubs
  configuration and no type-check command exist yet. Do not assume one.
- Add type annotations where they clarify interfaces and improve
  static analysis; avoid noisy annotations that merely restate obvious
  types.
- Prefer readable, straightforward Python over clever abstractions.
- Keep functions focused and names explicit.
- Handle errors deliberately; do not swallow exceptions or use broad
  exception handling without a clear reason.
- Remove unused imports, dead code, temporary debugging statements,
  and accidental diagnostic output before finishing.

## Performance and Observability

- Use django-silk and Django's query inspection tools when diagnosing
  performance issues, following the project's environment
  restrictions.
- Measure before introducing caching or complicated optimizations.
- Avoid N+1 queries and unnecessary database round trips.
- Do not expose profiling tools or debug endpoints publicly in
  production.
- Keep logs useful and structured enough to diagnose failures, but
  never log passwords, session identifiers, access tokens, or other
  secrets.

## Commands and Workflow

Before running commands, inspect `pyproject.toml`, the lockfile, and
existing scripts. Prefer the project's documented commands over
inventing new ones.

A `Makefile` in the repository root wraps the common commands below
(`make help` lists all targets). It runs everything from `backend/`, so
prefer it from the repo root:

| Target                                    | Runs                                         |
| ----------------------------------------- | -------------------------------------------- |
| `make db-up` / `make db-down`             | start PostgreSQL / stop the containers       |
| `make mailpit`                            | start Mailpit (catches outgoing email)       |
| `make run`                                | `manage.py runserver`                        |
| `make migrate`                            | `manage.py migrate`                          |
| `make startapp name=<app_name>`           | `scripts/startapp.py` (see "Creating Apps")  |
| `make makemigrations [app=<name>]`        | `manage.py makemigrations`                   |
| `make check-migrations`                   | `manage.py makemigrations --check --dry-run` |
| `make shell` / `make dbshell`             | `manage.py shell` / `dbshell`                |
| `make superuser`                          | `manage.py createsuperuser`                  |
| `make silk-clear`                         | delete django-silk's recorded requests       |
| `make check`                              | `manage.py check`                            |
| `make api-export`                         | export the OpenAPI schema to `openapi/openapi.json` |
| `make api-generate`                       | `api-export`, then regenerate the frontend client |
| `make test [args="-k name"]`              | `uv run pytest`                              |
| `make test-fresh [args=...]`              | `uv run pytest --create-db`                  |
| `make lint [args="--fix --unsafe-fixes"]` | `uv run ruff check .`                        |
| `make format`                             | `uv run ruff format .`                       |

Keep the Makefile in sync when adding commands. The equivalent raw
commands, run from `backend/` unless noted:

```bash
# Start PostgreSQL (from the repo root)
docker compose up -d postgres

# Dev server
uv run python manage.py runserver

# Django system checks
uv run python manage.py check

# Tests (add --create-db after migration/model changes)
uv run pytest

# Lint
uv run ruff check .

# Format check / formatting
uv run ruff format --check .
uv run ruff format .

# Migration consistency
uv run python manage.py makemigrations --check
```

Do not run formatters in check-only workflows that are meant to be
read-only.

For model changes, create migrations intentionally and review the
generated files. Before considering a change complete, run the most
relevant tests and checks that are available in the current environment,
and report any checks that could not be run.

## Agent Operating Rules

- Inspect relevant existing code and tests before editing. Preserve
  established conventions unless the task requires changing them.
- Make the smallest coherent change that solves the task.
- Do not rewrite unrelated files, reorganize the project, or add
  abstractions as part of an unrelated feature.
- Do not change dependencies, authentication behavior, environment
  configuration, database schema, or API contracts without accounting
  for the impact.
- Never silently discard user data, reset a database, or perform
  destructive operations.
- Do not claim tests, migrations, schema generation, or lint checks
  passed unless they were actually run.
- When finishing a task, summarize the important changes and list the
  checks run, including any that were blocked or skipped.
