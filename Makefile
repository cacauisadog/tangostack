MANAGE = cd backend && uv run python manage.py
FE = cd frontend && pnpm

.DEFAULT_GOAL := help

.PHONY: help db-up db-down up down build build-prod logs bash shell_plus proxy-up proxy-down proxy-trust run migrate makemigrations check-migrations \
	startapp shell dbshell superuser check test test-fresh coverage-report lint format \
	fe-install fe-dev fe-dev-api fe-build fe-test fe-e2e fe-e2e-report e2e-backend e2e-flush fe-lint fe-format fe-format-check \
	fe-typecheck fe-check fe-api-generate api-export api-generate

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  %-18s %s\n", $$1, $$2}'

db-up: ## Start PostgreSQL
	docker compose up -d postgres

db-down: ## Stop PostgreSQL
	docker compose down

up: ## Start everything in containers: postgres, backend, frontend (not the proxy)
	docker compose up -d postgres backend frontend

down: ## Stop and remove the containers (data in dkdata/ is kept)
	docker compose down

build: ## Build the dev images of the backend and frontend
	docker compose build backend frontend

build-prod: ## Build the production images (tangostack-backend, tangostack-frontend)
	docker build --target prod -t tangostack-backend backend
	docker build --target prod -t tangostack-frontend frontend

logs: ## Follow the backend and frontend container logs
	docker compose logs -f backend frontend

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
E2E_ENV = DATABASE_URL=postgres://postgres:postgres@localhost:5432/$(E2E_DB) ALLOWED_HOSTS=localhost,127.0.0.1 GOOGLE_CLIENT_ID=e2e.apps.googleusercontent.com GOOGLE_CLIENT_SECRET=e2e-secret

e2e-backend: ## Django for e2e: create/migrate the e2e DB, serve on :8001
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
