#!/usr/bin/env bash
# Starts a built production image and checks that it serves requests. CI runs it on
# the image it just built, before pushing, so an image that cannot start (a missing
# shared library, a bad setting) never reaches the registry.
#
# Usage: .github/scripts/smoke-test.sh backend|frontend IMAGE
# Needs docker and curl. The backend gets a throwaway Postgres on a private network.
set -euo pipefail

name=${1:?usage: smoke-test.sh backend|frontend IMAGE}
image=${2:?usage: smoke-test.sh backend|frontend IMAGE}

id=$$
network=smoke-$id
app=smoke-$name-$id
db=smoke-db-$id
passed=false

cleanup() {
  if [ "$passed" != true ]; then
    echo "--- $name container logs" >&2
    docker logs "$app" 2>&1 | tail -40 >&2 || true
  fi
  docker rm -f "$app" "$db" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_for() {
  local url=$1
  for _ in $(seq 1 40); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then return 0; fi
    sleep 1
  done
  echo "timed out waiting for $url" >&2
  curl -sS -o /dev/null "$url" >&2 || true
  return 1
}

docker network create "$network" >/dev/null

case "$name" in
  backend)
    docker run -d --name "$db" --network "$network" -e POSTGRES_PASSWORD=smoke postgres:18.6 >/dev/null
    env=(-e SECRET_KEY=smoke-test-only -e "DATABASE_URL=postgres://postgres:smoke@$db:5432/postgres")

    # Postgres restarts once while it initialises, so retry until the migration gets through.
    migrated=false
    for _ in $(seq 1 20); do
      if output=$(docker run --rm --network "$network" "${env[@]}" "$image" python manage.py migrate --noinput 2>&1); then
        migrated=true
        break
      fi
      sleep 2
    done
    if [ "$migrated" != true ]; then
      echo "migrate failed:" >&2
      echo "$output" >&2
      exit 1
    fi

    docker run -d --name "$app" --network "$network" -p 127.0.0.1:18000:8000 "${env[@]}" "$image" >/dev/null
    # 200 only when the database answers; works for any Host header
    wait_for http://127.0.0.1:18000/api/health
    # WhiteNoise serves the collected static files
    curl -fsS -o /dev/null http://127.0.0.1:18000/static/admin/css/base.css
    ;;
  frontend)
    docker run -d --name "$app" -p 127.0.0.1:13000:3000 "$image" >/dev/null
    wait_for http://127.0.0.1:13000/healthz
    # the server-rendered landing page, with its security headers and a CSP whose nonce is
    # the one on the page's inline scripts (a router upgrade that stops passing it would
    # leave the policy blocking the page's own scripts once enforced)
    page=$(mktemp)
    headers=$(mktemp)
    curl -fsS -D "$headers" -o "$page" http://127.0.0.1:13000/
    grep -qi '^x-content-type-options: nosniff' "$headers" || { echo "frontend: no nosniff header" >&2; exit 1; }
    grep -qi '^strict-transport-security:' "$headers" || { echo "frontend: no HSTS header" >&2; exit 1; }
    nonce=$(sed -n "s/^[Cc]ontent-[Ss]ecurity-[Pp]olicy[^:]*:.*script-src 'nonce-\([^']*\)'.*/\1/p" "$headers" | head -1)
    [ -n "$nonce" ] || { echo "frontend: no nonce in the CSP header" >&2; exit 1; }
    grep -qF "<script nonce=\"$nonce\"" "$page" || { echo "frontend: the page's scripts don't carry the CSP nonce" >&2; exit 1; }
    rm -f "$page" "$headers"
    ;;
  *)
    echo "unknown image name: $name" >&2
    exit 2
    ;;
esac

passed=true
echo "smoke test passed: $name ($image)"
