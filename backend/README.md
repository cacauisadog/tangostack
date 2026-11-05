# Tangostack backend

Django 6.1 + [Django Ninja](https://django-ninja.dev) on PostgreSQL, with
[django-allauth](https://docs.allauth.org) (headless) for authentication.
Managed with [uv](https://docs.astral.sh/uv/), served by Gunicorn (gevent).

The backend **owns the API contract**: the Ninja schemas defined here decide
what the frontend's generated client looks like. This file explains how the
backend is organised and the rules it follows. For the repository-wide picture
see the [root README](../README.md); for the exhaustive rule list (also what AI
assistants follow) see [`AGENTS.md`](AGENTS.md).

> Django REST Framework is deliberately **not** used. Do not add serializers,
> viewsets or DRF permissions; use Ninja schemas and routers.

## Layout

```text
backend/
├── manage.py
├── pyproject.toml            deps, Ruff and pytest config
├── uv.lock
├── scripts/startapp.py       creates apps in the right place (make startapp)
├── Dockerfile                multi-stage: `prod` (gunicorn) and `dev` (runserver)
└── tangostack/               the Django project package (no config/ dir)
    ├── settings.py           the only settings module; env-driven
    ├── urls.py               admin, allauth, the Ninja API
    ├── api.py                the NinjaAPI instance; every app's router is added here
    ├── conftest.py           shared fixtures: user, other_user, api_client
    └── apps/                 every Django app lives here (tangostack.apps.<name>)
        ├── core/             to-do domain + shared database setup
        │   ├── models.py       TodoList, Todo
        │   ├── schemas.py      Ninja request/response schemas
        │   ├── api.py          Ninja router: the endpoints
        │   ├── admin.py
        │   ├── migrations/     0001 collation, 0002 to-do models
        │   └── tests/
        └── accounts/         users and the auth integration
            ├── models.py       CustomUser (email login, no username)
            ├── managers.py     CustomUserManager
            ├── admin.py, forms.py
            ├── openapi.py      locates allauth's shipped OpenAPI spec (for make api-export)
            ├── migrations/
            └── tests/
```

## How a request is handled

| URL prefix            | Handled by                          | Notes                                                  |
| --------------------- | ----------------------------------- | ------------------------------------------------------ |
| `/api/`               | Django Ninja (`tangostack/api.py`)  | The product API. Session auth, CSRF on unsafe methods  |
| `/_allauth/browser/v1/` | allauth headless                  | Login, signup, session, logout (JSON, cookie session)  |
| `/accounts/`          | allauth                             | Provider callbacks (Google) only; no server-rendered pages |
| `/admin/`             | Django admin                        |                                                        |

- **Authentication** is a Django session cookie set by allauth. The Ninja API
  is created with `auth=django_auth`, so the same cookie authenticates `/api/`
  and Ninja enforces CSRF on `POST`/`PATCH`/`DELETE`. Anonymous calls get
  `401 {"detail": "Unauthorized"}`.
- **Accounts** are email + password only (no username), and the address must
  be **verified**: signing up or logging in with an unconfirmed address emails a
  link and signs nobody in until it is opened. Password reset works the same
  way. The links open frontend pages (`HEADLESS_FRONTEND_URLS`). Google login
  works through allauth's redirect flow and only exists when
  `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set.
- **Email** is sent through Django 6.1's `MAILERS` over plain SMTP, so any
  provider works. See [Email](#email).
- **Ownership:** a `TodoList` belongs to `owner`; every query is scoped to
  `request.user`. Someone else's list or todo is a **404, never a 403**, so ids
  don't leak.

## Getting started

Requires PostgreSQL (the schema uses an ICU case-insensitive collation, so
SQLite cannot work). From the **repository root**:

```bash
cp backend/.env.example backend/.env
make db-up         # PostgreSQL via docker compose
make mailpit       # optional: catches outgoing email (http://localhost:8025/mailpit/)
make migrate
make superuser
make run           # http://localhost:8000
```

Or run it in a container (`make up`, `make bash`, `make shell_plus`); the source
is bind-mounted so reloads still work. Both use the same port: run one or the other.

### Configuration

Settings come from environment variables, read through `python-decouple` from
`backend/.env` (git-ignored) or the real environment. Never hardcode secrets.

| Variable                           | Default                                         | Purpose                                              |
| ---------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| `SECRET_KEY`                       | insecure dev key                                | **Required when `DEBUG` is off** (startup fails otherwise) |
| `DEBUG`                            | `true`                                          | Off in production images                             |
| `DATABASE_URL`                     | `postgres://postgres:postgres@localhost:5432/tangostack` | Matches `docker-compose.yaml`               |
| `ALLOWED_HOSTS`                    | empty                                           | Comma-separated                                      |
| `CSRF_TRUSTED_ORIGINS`             | empty                                           | Comma-separated, with scheme                         |
| `BEHIND_PROXY`                     | `false`                                         | Trust `X-Forwarded-Proto` from the TLS proxy         |
| `SESSION_COOKIE_SECURE`            | `false`                                         | Must be `true` in production (also sets the CSRF cookie) |
| `GOOGLE_CLIENT_ID` / `_SECRET`     | empty                                           | Enables "Continue with Google"                       |
| `EMAIL_BACKEND`                    | console if `DEBUG`, else SMTP                   | Django email backend (SMTP for a real provider)      |
| `EMAIL_HOST` / `EMAIL_PORT`        | `localhost` / unset (587, or 465 with SSL)      | The provider's SMTP server                           |
| `EMAIL_USERNAME` / `EMAIL_PASSWORD`| empty                                           | The provider's SMTP credentials                      |
| `EMAIL_USE_TLS` / `EMAIL_USE_SSL`  | `true` / `false`                                | STARTTLS or implicit TLS; never both                 |
| `DEFAULT_FROM_EMAIL`               | `Tangostack <noreply@localhost>`                | **Set in production** to a verified sender address   |
| `SILK_ENABLED`                     | same as `DEBUG`                                 | django-silk profiler at `/silk/`; refuses to start with `DEBUG` off |

## Conventions and rules

### API design

- Every app keeps its request/response schemas in `schemas.py` and its routes
  in a `Router` in `api.py`, registered in `tangostack/api.py`.
- Schemas are named `<Thing>Create`, `<Thing>Update`, `<Thing>Response`. The
  names become the frontend's TypeScript types.
- Set `operation_id` explicitly (`listLists`, `createTodo`, ...). They become
  the generated hook names, so keep them stable.
- Declare **every** status code an endpoint returns (`401`, `404`, `422`
  included); the frontend types are generated from them. Use
  `Status(code, body)` for non-default codes.
- Validate at the boundary: strip and constrain text in the schema
  (`StringConstraints`), with `max_length` equal to the column size. Partial
  updates are `PATCH` with `field: Type = Field(default=None)`, so an omitted
  field is left alone and an explicit `null` is a 422.
- Enforce authorization in the backend on every endpoint, scoped to the owner.
  Authentication alone is not permission.
- Keep handlers thin (HTTP concerns); put reusable domain logic in
  `services.py` or model methods only when it earns its place.
- Avoid N+1 queries (`select_related`/`prefetch_related`) and lock the query
  count of list endpoints in a test with `django_assert_num_queries`.
- Use `save()` when updating an instance so `auto_now` fields are bumped
  (`QuerySet.update()` skips them). Use transactions for multi-step writes.

### Models and migrations

- Migrations are application code: review the generated file, keep it
  deterministic and runnable from an empty database, and **never edit an
  already-applied migration** (add a new one).
- A migration must depend on every app whose models it references.
- Put invariants in the database too (check constraints, unique, indexes),
  not only in Python. Example: lists and todos reject blank names.
- Consider locking, nullability and defaults when changing a table that has
  data. Separate a data migration from the schema change that follows it
  (Postgres can't `ALTER` a table with pending trigger events).
- Always reference the user model through `get_user_model()` /
  `settings.AUTH_USER_MODEL`. Create users with `CustomUserManager`.
- `CustomUser.email` uses the `case_insensitive` collation created by
  `core.0001`. Apps that use it must depend on that migration. The admin
  searches through an annotated deterministic collation because
  non-deterministic ones don't support `LIKE`.
- Never reset a database unless it is known to be disposable (the e2e DB is).

### Settings and security

- One `settings.py`, driven by env vars. No separate dev/prod modules.
- Don't weaken CSRF, session, cookie or password protections to make local
  development or tests pass.
- Keep secrets, tokens and session ids out of logs and error responses.
- Social account linking by email is deliberately **off**: emails aren't
  verified at signup, so linking would let someone pre-register a victim's
  address. Revisit together with email verification.

### Code style

- Ruff for lint (`DJ`, `E`, `F`, `W`, `I`, `UP`, `B`) and format (double quotes):
  `make lint`, `make format`.
- Plain, readable Python; explicit names; type hints where they clarify an
  interface. No broad `except`; no leftover debug output.
- Add dependencies only deliberately, through `pyproject.toml`/`uv.lock`
  (`uv add`); there is no second package manager.

## The OpenAPI contract

The frontend's client is generated from what the backend exports.

```bash
make api-export     # writes openapi/openapi.json and copies allauth's spec to openapi/allauth/
make api-generate   # export, then regenerate the frontend client
```

Both outputs are committed. `core/tests/test_openapi.py` fails when they are
stale (including after an allauth upgrade), so change a schema, export, commit.
Never hand-edit them or the generated TypeScript.

## Email

Allauth sends the confirmation and password-reset emails. They use Django
templates with an HTML and a text part, in
`tangostack/apps/accounts/templates/account/email/` (`base_message.html` is the
shared layout, inline CSS; `base_message.txt` brands every text email). Because
`accounts` is listed before `allauth` in `INSTALLED_APPS`, these files override
allauth's own; to restyle another email, add a file with the same name. Their
links come from `HEADLESS_FRONTEND_URLS` and use the host of the request.

Settings use Django 6.1's `MAILERS` (the old `EMAIL_*` settings are deprecated
and cannot be mixed with it), filled from the `EMAIL_*` environment variables.
Choosing a provider later only means setting those variables to its SMTP
credentials and `DEFAULT_FROM_EMAIL` to an address on a domain verified with it
(SPF, DKIM, DMARC). Nothing in the code changes.

- **Locally:** `make mailpit` starts Mailpit, which catches everything at
  <http://localhost:8025/mailpit/>. Point Django at it with the `EMAIL_*` lines in
  `.env.example`; without them emails print to the console.
- **Tests:** Django's in-memory backend (`mail.outbox`). allauth rate-limits in
  the cache, so `conftest.py` clears it between tests.
- **Superusers** made with `createsuperuser` get a verified address, otherwise
  they could not log in through the app.

## Observability (OpenTelemetry, opt-in)

Off by default, and not needed day to day: it exists to check that metrics and logs
work. `OTEL_ENABLED` (default `false`) makes the app send request metrics and logs
over OTLP/HTTP to a local collector (`tangostack/telemetry.py`); when off, nothing
from OpenTelemetry is even imported.

```bash
make obs                          # collector, Prometheus, Loki, Grafana
echo OTEL_ENABLED=true >> backend/.env   # then restart `make run` (or `make up`)
open http://localhost:3001        # Grafana, no login: dashboard "Tangostack backend"
make obs-down                     # stop it (data is kept in Docker volumes)
```

- **Dashboard** (`observability/grafana/dashboards/backend.json`): requests per second,
  most requested and slowest endpoints (p99), latency percentiles, status codes,
  container CPU/memory, Postgres stats, and the logs. Endpoints are route templates
  (`api/lists/<list_id>`), not raw URLs; unmatched URLs (404s) show up with no name.
- **Pipeline:** app -> `otel-collector` -> Prometheus (metrics) and Loki (logs). The
  collector also scrapes Postgres and the containers (it needs the Docker socket).
  Configs live in `observability/`; all ports are bound to localhost.
- **Env:** `OTEL_EXPORTER_OTLP_ENDPOINT` (default `http://localhost:4318`; the dev
  container uses `http://otel-collector:4318`) and `OTEL_SERVICE_NAME`.
- **Gunicorn:** each worker exports its own series (`service_instance_id`); queries
  sum over them. Verified with gevent workers.
- **Tests** never enable it (settings ignore `OTEL_ENABLED` under pytest).
- Only metrics and logs, no traces yet (so no per-query timing: that is what silk is
  for in development).

## Profiling (django-silk)

In development, [django-silk](https://github.com/jazzband/django-silk) records
every request and its SQL queries. Open `/silk/` (e.g.
<https://dev.tangostack.com/silk/>); no login is needed. It is a dev-only dependency, so it is not in the production
image, and `SILK_ENABLED` cannot be on while `DEBUG` is off. The e2e backend turns it off.

- Keeps the last 1000 requests; `make silk-clear` empties them.
- `SILKY_PYTHON_PROFILER` (cProfile per request) is off because it slows every
  request: flip it in `settings.py` when you need a profile.
- Tests strip the middleware (`conftest.py`) so its writes don't skew query counts;
  a test that wants it asks for the `silk_on` fixture.

## Testing

pytest + pytest-django against a real PostgreSQL (`make db-up` first).

```bash
make test                  # all tests, with coverage (HTML in htmlcov/)
make test args="-k owner"  # a subset
make test-fresh            # recreate the test DB (after model/migration changes)
```

- `--reuse-db` keeps the test database between runs; use `make test-fresh`
  after changing models or migrations.
- Migrations run in tests on purpose (the collation is created by one), so they
  must work on an empty database.
- Fixtures in `tangostack/conftest.py`: `user` and `other_user`, and
  `api_client` (a client signed in as `user`). pytest-django's own `client`
  stays **anonymous**; use it for the 401 cases.
- Style: plain pytest functions, `pytestmark = pytest.mark.django_db`.
- Test behaviour and database constraints, not mocks of the ORM. For endpoints
  cover success, invalid input, unauthenticated access, and another user's data.
- Don't write tests that only re-check Django's or allauth's own behaviour.
- Use mocks only at external boundaries. Keep tests independent so they stay
  safe under pytest-xdist.
- Full-stack coverage (real frontend + backend + DB) is Playwright's job:
  `make fe-e2e`.

## Common tasks

**Add an app:** `make startapp name=<snake_case>` from the repository root (never
a bare `manage.py startapp`). It creates `tangostack/apps/<name>/`, sets the
dotted `name` in `apps.py` and registers it in `INSTALLED_APPS`. Then remove the
unused scaffold imports and add tests under the app's `tests/`.

**Add an endpoint:**

1. Add (or extend) the schemas in the app's `schemas.py`.
2. Add the route in its `api.py` with an explicit `operation_id` and every
   response code, scoped to `request.user`.
3. Write the tests (success, 422, 401, another user's data → 404).
4. `make api-generate`, then fix the frontend (`make fe-check`).

**Change a model:** edit the model, `make makemigrations`, review the file,
`make migrate`, then `make test-fresh`.

## Containers

`Dockerfile` has two targets, both with the virtualenv in `/opt/venv`:

- `prod` (default): slim Python, only runtime dependencies, non-root, collected
  static files, `DEBUG=false`, runs Gunicorn. It does **not** run migrations on
  start: run `python manage.py migrate` as a separate release step. WhiteNoise
  serves the collected static files (with `DEBUG` off only; `runserver` does it in
  development).
- `dev`: dev dependencies and `runserver`, used by `docker-compose.yaml`.

Debugging a running container: `make bash`, or `make shell_plus` for the Django
shell with all models loaded.
