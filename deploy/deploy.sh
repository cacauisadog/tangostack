#!/usr/bin/env bash
# Deploys one environment with Kamal: the backend (it migrates on start, before the
# proxy switches traffic; its worker role restarts too), then the frontend. CI runs this too (the GitHub
# environment's secrets are the environment); locally it loads
# ~/.config/tangostack/<destination>.env.
#
#   deploy/deploy.sh <staging|production> <image tag, normally the commit sha> [--first]
#
# --first: a brand-new server (starts kamal-proxy, the database and Valkey before deploying).
set -euo pipefail

dest="${1:?usage: deploy.sh <staging|production> <image tag> [--first]}"
version="${2:?usage: deploy.sh <staging|production> <image tag> [--first]}"
first="${3:-}"
cd "$(dirname "$0")/.."

env_file="$HOME/.config/tangostack/$dest.env"
if [ -f "$env_file" ]; then set -a; . "$env_file"; set +a; fi
. deploy/defaults.sh
: "${DEPLOY_HOST:?}" "${APP_HOST:?}"
# Reading a PEM from a file or a CI secret drops the newline after its END line,
# and kamal-proxy then can't load it.
TLS_CERT="${TLS_CERT%$'\n'}"$'\n'
TLS_KEY="${TLS_KEY%$'\n'}"$'\n'
export TLS_CERT TLS_KEY

kamal="${KAMAL:-kamal}"
backend=(-c config/deploy.backend.yml -d "$dest")
frontend=(-c config/deploy.frontend.yml -d "$dest")

if [ "$first" = "--first" ]; then
  "$kamal" proxy boot "${backend[@]}"
  "$kamal" accessory boot db "${backend[@]}"
  "$kamal" accessory boot valkey "${backend[@]}"
fi

"$kamal" deploy "${backend[@]}" --skip-push --version "$version"
"$kamal" deploy "${frontend[@]}" --skip-push --version "$version"
