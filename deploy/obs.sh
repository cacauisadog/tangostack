#!/usr/bin/env bash
# Behind `make obs-deploy` / `make obs-logs`: the observability stack (one for every
# environment, deploy/config/deploy.observability.yml). Server, SSH key, TLS certificate
# and the database passwords come from the staging and production env files; what is
# only the stack's (GRAFANA_HOST, the Grafana admin password) from
# ~/.config/tangostack/observability.env.
#
#   deploy/obs.sh boot [accessory|all]      # first time (default all)
#   deploy/obs.sh reboot [accessory|all]    # apply config changes (data is kept)
#   deploy/obs.sh logs <accessory> [lines]
set -euo pipefail
cd "$(dirname "$0")/.."

action="${1:?usage: obs.sh <boot|reboot|logs> [accessory|all] [lines]}"
target="${2:-all}"
lines="${3:-100}"
dir="$HOME/.config/tangostack"

for f in production staging observability; do
  [ -f "$dir/$f.env" ] || { echo "missing $dir/$f.env" >&2; exit 1; }
done
# staging's password under its own name; production's file is the base
POSTGRES_STAGING_PASSWORD=$(set -a; . "$dir/staging.env"; echo "$POSTGRES_PASSWORD")
set -a
. "$dir/production.env"
POSTGRES_PRODUCTION_PASSWORD="$POSTGRES_PASSWORD"
. "$dir/observability.env"
set +a
. deploy/defaults.sh
: "${DEPLOY_HOST:?}" "${GRAFANA_HOST:?}" "${GF_SECURITY_ADMIN_PASSWORD:?}"
TLS_CERT="${TLS_CERT%$'\n'}"$'\n'
TLS_KEY="${TLS_KEY%$'\n'}"$'\n'
export TLS_CERT TLS_KEY POSTGRES_STAGING_PASSWORD POSTGRES_PRODUCTION_PASSWORD

kamal="${KAMAL:-kamal}"
cfg=(-c deploy/config/deploy.observability.yml)

case "$action" in
  boot | reboot) exec "$kamal" accessory "$action" "$target" "${cfg[@]}" ;;
  logs) exec "$kamal" accessory logs "$target" "${cfg[@]}" --lines "$lines" ;;
  *) echo "unknown action: $action" >&2; exit 1 ;;
esac
