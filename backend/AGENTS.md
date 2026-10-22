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

**Current state:** the backend is early-stage. Django Ninja and
django-allauth are installed in `pyproject.toml` but not yet wired up:
they are not in `INSTALLED_APPS`, there is no `NinjaAPI` instance, and
`tangostack/urls.py` only routes `admin/`. The only implemented domain
code is the custom user model in `apps/accounts`. The frontend has an
`api:generate` (`orval`) script, but no Orval config exists yet.

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
└── tangostack/               # Django project package (no config/ dir)
    ├── settings.py           # single settings module
    ├── urls.py
    ├── asgi.py
    ├── wsgi.py
    └── apps/
        ├── core/             # shared infrastructure
        │   ├── migrations/0001_case_insensitive_collation.py
        │   └── tests.py
        └── accounts/         # custom user model
            ├── models.py     # CustomUser
            ├── managers.py   # CustomUserManager
            ├── forms.py
            ├── admin.py
            ├── views.py
            ├── migrations/0001_initial.py
            └── tests/test_customuser.py
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
- When Django Ninja is introduced, use `schemas.py` for request/response
  schemas and `api.py` for routes in each app (these files do not
  exist yet).
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
  `DEBUG`, and `ALLOWED_HOSTS` are currently hardcoded dev defaults in
  `settings.py`; move them to environment variables before any
  non-local deployment.
- Never commit `.env` files or credentials (`.env` is git-ignored).
  There is no `.env.example` yet; create one when adding the first
  required variable, using safe placeholder values only.
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
- The project plans to use Django Allauth with headless and
  social-account functionality. It is installed but not yet configured
  (not in `INSTALLED_APPS`, no auth backends or URLs). Follow the
  Allauth configuration once it exists, and do not implement a
  parallel authentication system.
- Before changing authentication, session, cookie, CSRF, social-login,
  or account behavior, inspect the current settings and existing
  integration tests.
- Keep secrets and tokens out of logs and error responses.
- Do not weaken password, session, CSRF, redirect, or account-security
  protections to simplify integration with the frontend.
- Make authorization and ownership checks explicit in API endpoints
  and test both allowed and denied access.

## Frontend Contract and OpenAPI

The backend owns the API contract consumed by TanStack Start.

When changing an endpoint or schema:

1. Update the Django Ninja endpoint and its request/response schemas.
2. Keep operation IDs stable unless a deliberate rename is required.
3. Generate or inspect the OpenAPI schema using the repository's
   documented command.
4. Run the Orval client-generation workflow from the frontend or
   root-level script as documented.
5. Check generated-client changes into version control only if that is
   the repository's established policy.
6. Run backend tests and the relevant frontend type-check or contract
   check.

Do not hand-edit generated TypeScript client files. Do not maintain a
separate handwritten copy of API types in the backend and frontend. If a
schema change is intentionally breaking, identify the compatibility
impact and coordinate the change with the frontend.

If the exact generation command is not documented, inspect the existing
scripts and configuration before inventing a new workflow.

## Testing

Use pytest as the backend test runner, with pytest-django for Django
integration. Configuration lives in `pyproject.toml`:
`DJANGO_SETTINGS_MODULE = tangostack.settings`, `testpaths = ["tangostack"]`,
files named `tests.py` or `test_*.py`, and
`addopts = "--reuse-db --durations=1"`.

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
| `make db-up` / `make db-down`             | start/stop PostgreSQL via docker compose     |
| `make run`                                | `manage.py runserver`                        |
| `make migrate`                            | `manage.py migrate`                          |
| `make startapp name=<app_name>`           | `scripts/startapp.py` (see "Creating Apps")  |
| `make makemigrations [app=<name>]`        | `manage.py makemigrations`                   |
| `make check-migrations`                   | `manage.py makemigrations --check --dry-run` |
| `make shell` / `make dbshell`             | `manage.py shell` / `dbshell`                |
| `make superuser`                          | `manage.py createsuperuser`                  |
| `make check`                              | `manage.py check`                            |
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
