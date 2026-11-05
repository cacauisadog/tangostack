#!/usr/bin/env bash
# Runs a command with an environment's deploy variables loaded from
# ~/.config/tangostack/<environment>.env (what deploy.sh and the Makefile use).
#
#   deploy/with-env.sh <staging|production> <command> [args...]
set -euo pipefail

dest="${1:?usage: with-env.sh <staging|production> <command> [args...]}"
shift
env_file="$HOME/.config/tangostack/$dest.env"
[ -f "$env_file" ] || { echo "missing $env_file" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
. "$env_file"
set +a
# shellcheck disable=SC1091
. "$(dirname "$0")/defaults.sh"

exec "$@"
