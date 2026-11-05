MANAGE = cd backend && uv run python manage.py
FE = cd frontend && pnpm

# Kamal installs as a user gem (gem install kamal --user-install), often not on PATH.
KAMAL ?= $(or $(shell command -v kamal),$(shell ruby -e 'puts Gem.user_dir')/bin/kamal)
GHCR = ghcr.io/cacauisadog/tangostack

.DEFAULT_GOAL := help

.PHONY: help db-up db-down mailpit obs obs-down up down build build-prod logs bash shell_plus proxy-up proxy-down proxy-trust run migrate makemigrations check-migrations \
	startapp shell dbshell superuser silk-clear check test test-fresh coverage-report lint format \
	celery celery-logs fe-install fe-dev fe-dev-api fe-build fe-test fe-e2e fe-e2e-report e2e-backend e2e-flush fe-lint fe-format fe-format-check \
	fe-typecheck fe-check fe-api-generate api-export api-generate deploy deploy-logs rollback

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  %-18s %s\n", $$1, $$2}'

db-up: ## Start PostgreSQL
	docker compose up -d postgres

mailpit: ## Start Mailpit, which catches outgoing email (http://localhost:8025)
	docker compose up -d mailpit

celery: ## Start Valkey and the Celery worker (sends the emails), for `make run` or `make up`
	docker compose up -d valkey worker

celery-logs: ## Follow the Celery worker's logs
	docker compose logs -f worker

db-down: ## Stop the containers (same as `make down`)
	docker compose --profile observability down

obs: ## Start the observability stack (OTel collector, Prometheus, Loki, Grafana: http://localhost:3001)
	docker compose --profile observability up -d otel-collector prometheus loki grafana

obs-down: ## Stop the observability stack (its data is kept)
	docker compose --profile observability stop otel-collector prometheus loki grafana

up: ## Start everything in containers: postgres, mailpit, valkey, backend, worker, frontend (not the proxy)
	docker compose up -d postgres mailpit valkey backend worker frontend

down: ## Stop and remove the containers, observability included (data in dkdata/ is kept)
	docker compose --profile observability down

build: ## Build the dev images of the backend (and its worker) and frontend
	docker compose build backend worker frontend

build-prod: ## Build the production images (tangostack-backend, tangostack-frontend)
	docker build --target prod -t tangostack-backend backend
	docker build --target prod -t tangostack-frontend frontend

logs: ## Follow the backend, worker and frontend container logs
	docker compose logs -f backend worker frontend

bash: ## Bash inside the backend container
	docker compose exec backend bash

shell_plus: ## Django shell_plus inside the backend container
	docker compose exec backend python manage.py shell_plus

proxy-up: ## Start the Caddy dev proxy (https://dev.tangostack.com)
	docker compose up -d caddy

proxy-down: ## Stop the Caddy dev proxy
	docker compose stop caddy

proxy-trust: ## Trust Caddy's local CA in the macOS keychain (asks for sudo)
	sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain dkdata/caddy/data/caddy/pki/authorities/local/root.crt

run: ## Run the dev server
	$(MANAGE) runserver

migrate: ## Apply migrations
	$(MANAGE) migrate

makemigrations: ## Create migrations (optional: app=<name>)
	$(MANAGE) makemigrations $(app)

check-migrations: ## Fail if model changes lack migrations
	$(MANAGE) makemigrations --check --dry-run

startapp: ## Create a Django app in tangostack/apps (required: name=<app>)
	@test -n "$(name)" || { echo "Usage: make startapp name=<app_name>"; exit 1; }
	cd backend && uv run python scripts/startapp.py $(name)

shell: ## Open the Django shell
	$(MANAGE) shell

dbshell: ## Open the database shell
	$(MANAGE) dbshell

superuser: ## Create a superuser
	$(MANAGE) createsuperuser

silk-clear: ## Delete everything django-silk recorded (dev)
	$(MANAGE) silk_clear_request_log

check: ## Run Django system checks
	$(MANAGE) check

test: ## Run backend tests (optional: args="-k name")
	cd backend && uv run pytest $(args)

test-fresh: ## Run backend tests with a recreated test DB
	cd backend && uv run pytest --create-db $(args)

coverage-report: ## Open the backend HTML coverage report (written by every pytest run)
	open backend/htmlcov/index.html

lint: ## Lint the backend with Ruff (optional: args="--fix --unsafe-fixes")
	cd backend && uv run ruff check . $(args)

format: ## Format the backend with Ruff
	cd backend && uv run ruff format .

fe-install: ## Install frontend dependencies
	$(FE) install

fe-dev: ## Run the frontend dev server (mocked API)
	$(FE) dev

fe-dev-api: ## Run the frontend dev server against the real backend (no mocks)
	cd frontend && VITE_API_MOCKING=false pnpm dev

fe-build: ## Build the frontend
	$(FE) build

fe-test: ## Run frontend unit tests
	$(FE) test

fe-e2e: ## Run Playwright e2e tests (needs `make db-up`; starts its own servers)
	$(FE) e2e

fe-e2e-report: ## Open the last Playwright HTML report
	$(FE) e2e:report

# e2e runs against its own database and ports so it never touches dev data.
E2E_DB = tangostack_e2e
E2E_ENV = SILK_ENABLED=false DATABASE_URL=postgres://postgres:postgres@localhost:5432/$(E2E_DB) ALLOWED_HOSTS=localhost,127.0.0.1 GOOGLE_CLIENT_ID=e2e.apps.googleusercontent.com GOOGLE_CLIENT_SECRET=e2e-secret EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend EMAIL_HOST=localhost EMAIL_PORT=1026 EMAIL_USE_TLS=false

e2e-backend: ## Django for e2e: create/migrate the e2e DB, serve on :8001 (email goes to the mailpit-e2e container)
	@docker compose up -d --wait mailpit-e2e
	@docker compose exec -T postgres sh -c "psql -U postgres -tAc \"SELECT 1 FROM pg_database WHERE datname='$(E2E_DB)'\" | grep -q 1 || createdb -U postgres $(E2E_DB)"
	cd backend && $(E2E_ENV) uv run python manage.py migrate --noinput
	cd backend && $(E2E_ENV) uv run python manage.py runserver 8001 --noreload

e2e-flush: ## Empty the e2e database (never the dev one)
	cd backend && $(E2E_ENV) uv run python manage.py flush --noinput

fe-lint: ## Lint the frontend with Oxlint (optional: args="--fix")
	$(FE) lint $(args)

fe-format: ## Format the frontend with Oxfmt
	$(FE) format

fe-format-check: ## Fail if the frontend is not formatted
	$(FE) format:check

fe-typecheck: ## Type-check the frontend
	$(FE) typecheck

fe-api-generate: ## Regenerate the frontend API client from openapi/openapi.json
	$(FE) api:generate

api-export: ## Export the OpenAPI specs: Ninja's (openapi/openapi.json) and a copy of allauth's (openapi/allauth/)
	mkdir -p openapi && $(MANAGE) export_openapi_schema --api tangostack.api.api --output ../openapi/openapi.json --indent 2 --sorted
	mkdir -p openapi/allauth && cd backend && uv run python -c "from tangostack.apps.accounts.openapi import ALLAUTH_SPEC_DIR; print(ALLAUTH_SPEC_DIR)" | xargs -I{} cp {}/openapi.yaml {}/description.md ../openapi/allauth/

api-generate: api-export fe-api-generate ## Export the OpenAPI schema, then regenerate the frontend client

fe-check: fe-lint fe-format-check fe-typecheck fe-test ## Run all frontend checks

deploy: ## Deploy to staging or production (required: env=staging|production; optional: `rollback` to pick from the last 10 commits, or sha=<full commit sha>; default HEAD)
	@case "$(env)" in staging|production) ;; *) echo "Usage: make deploy env=staging|production [rollback | sha=<full commit sha>]"; exit 1;; esac
	@GHCR=$(GHCR) KAMAL=$(KAMAL) deploy/release.sh $(env) $(if $(filter rollback,$(MAKECMDGOALS)),--rollback,$(sha))

# `make deploy env=staging rollback`: the bare word is this no-op goal, deploy/release.sh does the picking
rollback:
	@:

deploy-logs: ## Follow-less log tail of a deployed service (required: env=; optional: svc=backend|worker|frontend, lines=100)
	@test -n "$(env)" || { echo "Usage: make deploy-logs env=staging|production [svc=backend|worker|frontend] [lines=100]"; exit 1; }
	deploy/with-env.sh $(env) $(KAMAL) app logs -c config/deploy.$(if $(filter worker,$(svc)),backend,$(or $(svc),backend)).yml -d $(env) $(if $(filter worker,$(svc)),--roles worker,$(if $(filter frontend,$(svc)),,--roles web)) --lines $(or $(lines),100)
