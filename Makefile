MANAGE = cd backend && uv run python manage.py

.DEFAULT_GOAL := help

.PHONY: help db-up db-down run migrate makemigrations check-migrations \
	startapp shell dbshell superuser check test test-fresh lint format

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  %-18s %s\n", $$1, $$2}'

db-up: ## Start PostgreSQL
	docker compose up -d postgres

db-down: ## Stop PostgreSQL
	docker compose down

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
