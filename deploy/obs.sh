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

# Kamal uploads a custom certificate only for app deploys, not for an accessory's
# proxy: put it where kamal-proxy expects it (.kamal/proxy/apps-config/<service>/tls).
upload_certificate() {
  local tls=.kamal/proxy/apps-config/tangostack-observability/tls
  printf '%s' "$TLS_CERT" | ssh -i "$SSH_KEY_FILE" -o IdentitiesOnly=yes "deploy@$DEPLOY_HOST" \
    "mkdir -p $tls && cat > $tls/cert.pem && chmod 644 $tls/cert.pem"
  printf '%s' "$TLS_KEY" | ssh -i "$SSH_KEY_FILE" -o IdentitiesOnly=yes "deploy@$DEPLOY_HOST" \
    "cat > $tls/key.pem && chmod 644 $tls/key.pem"
}

case "$action" in
  boot | reboot)
    case "$target" in all | grafana) upload_certificate ;; esac
    exec "$kamal" accessory "$action" "$target" "${cfg[@]}" ;;
  logs) exec "$kamal" accessory logs "$target" "${cfg[@]}" --lines "$lines" ;;
  *) echo "unknown action: $action" >&2; exit 1 ;;
esac
