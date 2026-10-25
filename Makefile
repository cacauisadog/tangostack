MANAGE = cd backend && uv run python manage.py
FE = cd frontend && pnpm

.DEFAULT_GOAL := help

.PHONY: help db-up db-down proxy-up proxy-down proxy-trust run migrate makemigrations check-migrations \
	startapp shell dbshell superuser check test test-fresh lint format \
	fe-install fe-dev fe-dev-api fe-build fe-test fe-e2e fe-lint fe-format fe-format-check \
	fe-typecheck fe-check fe-api-generate api-export api-generate

help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  %-18s %s\n", $$1, $$2}'

db-up: ## Start PostgreSQL
	docker compose up -d postgres

db-down: ## Stop PostgreSQL
	docker compose down

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

fe-e2e: ## Run frontend Playwright tests
	$(FE) e2e

fe-lint: ## Lint the frontend with Oxlint (optional: args="--fix")
	$(FE) lint $(args)

fe-format: ## Format the frontend with Oxfmt
	$(FE) format

fe-format-check: ## Fail if the frontend is not formatted
	$(FE) format:check

fe-typecheck: ## Type-check the frontend
	$(FE) typecheck

fe-api-generate: ## Regenerate the frontend API client from api/openapi.json
	$(FE) api:generate

api-export: ## Export the OpenAPI schema from Django Ninja to api/openapi.json
	mkdir -p api && $(MANAGE) export_openapi_schema --api tangostack.api.api --output ../api/openapi.json --indent 2 --sorted

api-generate: api-export fe-api-generate ## Export the OpenAPI schema, then regenerate the frontend client

fe-check: fe-lint fe-format-check fe-typecheck fe-test ## Run all frontend checks
