#!/usr/bin/env bash
# Deploys one environment with Kamal: migrate with the new image, then the backend,
# then the frontend. CI runs this too (the GitHub environment's secrets are the
# environment); locally it loads ~/.config/tangostack/<destination>.env.
#
#   deploy/deploy.sh <staging|production> <image tag, normally the commit sha> [--first]
#
# --first: a brand-new server (starts kamal-proxy and the database before deploying).
set -euo pipefail

dest="${1:?usage: deploy.sh <staging|production> <image tag> [--first]}"
version="${2:?usage: deploy.sh <staging|production> <image tag> [--first]}"
first="${3:-}"
cd "$(dirname "$0")/.."

env_file="$HOME/.config/tangostack/$dest.env"
if [ -f "$env_file" ]; then set -a; . "$env_file"; set +a; fi
export KAMAL_REGISTRY_PASSWORD="${KAMAL_REGISTRY_PASSWORD:-$(gh auth token)}"
export SSH_KEY_FILE="${SSH_KEY_FILE:-$HOME/.ssh/hostinger_deploy_user}"
: "${DEPLOY_HOST:?}" "${APP_HOST:?}"

kamal="${KAMAL:-kamal}"
backend=(-c config/deploy.backend.yml -d "$dest")
frontend=(-c config/deploy.frontend.yml -d "$dest")

if [ "$first" = "--first" ]; then
  "$kamal" proxy boot "${backend[@]}"
  "$kamal" accessory boot db "${backend[@]}"
fi

"$kamal" registry login "${backend[@]}"

# The database may still be starting on a first deploy.
for attempt in 1 2 3 4 5 6; do
  "$kamal" app exec "${backend[@]}" --version "$version" "python manage.py migrate --noinput" && break
  [ "$attempt" -lt 6 ] || { echo "migrate failed" >&2; exit 1; }
  sleep 5
done

"$kamal" deploy "${backend[@]}" --skip-push --version "$version"
"$kamal" deploy "${frontend[@]}" --skip-push --version "$version"
