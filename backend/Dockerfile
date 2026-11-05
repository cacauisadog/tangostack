# syntax=docker/dockerfile:1

# Targets:  prod (default) - gunicorn, code baked in, non-root, nothing but runtime deps
#           dev            - runserver + dev tools; the source is bind-mounted over /app
# Both keep the virtualenv in /opt/venv (outside /app) so a bind mount never hides it.

ARG PYTHON_VERSION=3.14

FROM python:${PYTHON_VERSION}-slim AS base
ENV PYTHONUNBUFFERED=1 \
  PYTHONDONTWRITEBYTECODE=1 \
  UV_PROJECT_ENVIRONMENT=/opt/venv \
  UV_LINK_MODE=copy \
  PATH="/opt/venv/bin:$PATH"
WORKDIR /app
RUN useradd --uid 1000 --create-home app && chown app /app

# uv only exists in the build stages, never in the final images.
FROM base AS deps
COPY --from=ghcr.io/astral-sh/uv:0.13 /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./

FROM deps AS deps-prod
RUN --mount=type=cache,target=/root/.cache/uv \
  uv sync --frozen --no-dev --no-install-project

FROM deps AS deps-dev
RUN --mount=type=cache,target=/root/.cache/uv \
  uv sync --frozen --no-install-project


FROM base AS dev
COPY --from=deps-dev /opt/venv /opt/venv
COPY --chown=app . .
USER 1000
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]


FROM base AS prod
# Kamal refuses an image whose `service` label differs from its config (deploy/config/deploy.backend.yml).
LABEL service="tangostack-backend"
# Safe by default: settings refuse to start without a real SECRET_KEY.
ENV DEBUG=false
COPY --from=deps-prod /opt/venv /opt/venv
COPY --chown=app . .
RUN SECRET_KEY=build-only python manage.py collectstatic --noinput
USER 1000
EXPOSE 8000
CMD ["gunicorn", "tangostack.wsgi:application", "--bind", "0.0.0.0:8000", "--worker-class", "gevent", "--access-logfile", "-"]
