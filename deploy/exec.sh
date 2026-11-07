#!/usr/bin/env bash
# Behind `make exec`: an interactive command against one environment, in a throwaway
# container of the deployed image (same settings and secrets, its own process, removed on
# exit; nothing it does touches the running containers). For the database and Valkey there
# is no image to start from, so it runs inside the accessory's container.
#
#   deploy/exec.sh <staging|production> <backend|frontend|db|valkey> [command]
#
# Default commands: backend `python manage.py shell_plus`, frontend `sh`, db `psql`,
# valkey `valkey-cli`. It runs on the real data of that environment.
set -euo pipefail
cd "$(dirname "$0")/.."

dest="${1:?usage: exec.sh <staging|production> <backend|frontend|db|valkey> [command]}"
svc="${2:?usage: exec.sh <staging|production> <backend|frontend|db|valkey> [command]}"
cmd="${3:-}"
kamal="${KAMAL:-kamal}"

case "$svc" in
  backend)  kind=app;       cfg=backend;  : "${cmd:=python manage.py shell_plus}"; extra=(--roles web) ;;
  frontend) kind=app;       cfg=frontend; : "${cmd:=sh}";                          extra=() ;;
  db)       kind=accessory; cfg=backend;  : "${cmd:=psql -U tangostack tangostack}"; extra=(db --reuse) ;;
  valkey)   kind=accessory; cfg=backend;  : "${cmd:=sh -c 'valkey-cli -a \"\$VALKEY_PASSWORD\" --no-auth-warning'}"; extra=(valkey --reuse) ;;
  *) echo "unknown service: $svc (backend, frontend, db or valkey)" >&2; exit 1 ;;
esac

if [ "$dest" = production ]; then
  read -r -p "Run \`$cmd\` against PRODUCTION ($svc)? [y/N] " answer
  [ "$answer" = y ] || { echo aborted; exit 1; }
fi

exec deploy/with-env.sh "$dest" "$kamal" "$kind" exec -i ${extra[@]+"${extra[@]}"} \
  -c "deploy/config/deploy.$cfg.yml" -d "$dest" "$cmd"
