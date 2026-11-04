#!/usr/bin/env bash
# Behind `make deploy`: pick the commit, make sure CI built its images, then deploy it.
#
#   deploy/release.sh <env>                 # HEAD
#   deploy/release.sh <env> --rollback      # pick one of the last 10 commits by number
#   deploy/release.sh <env> <full sha>      # any commit
#
# Needs GHCR (image prefix, set by the Makefile) and gh logged in (to trigger a build).
set -euo pipefail
cd "$(dirname "$0")/.."

env="${1:?usage: release.sh <staging|production> [--rollback|<full sha>]}"
pick="${2:-}"
ghcr="${GHCR:?run this through make}"
count=10

has_images() {
  local image
  for image in backend frontend; do
    docker manifest inspect "$ghcr-$image:$1" >/dev/null 2>&1 || return 1
  done
}

choose() {
  local tmp i n sha mark label
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' RETURN
  shas=()
  while IFS= read -r sha; do shas+=("$sha"); done < <(git log -"$count" --format=%H)

  local pids=() pid frame=0 busy
  local frames=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)
  for i in "${!shas[@]}"; do
    (has_images "${shas[$i]}" && touch "$tmp/$i") &
    pids+=($!)
  done
  # a spinner while the registry answers (a second or two)
  while :; do
    busy=0
    for pid in "${pids[@]}"; do kill -0 "$pid" 2>/dev/null && busy=1; done
    [ "$busy" -eq 1 ] || break
    [ -t 1 ] && printf '\r%s Checking which of the last %d commits have images built…' "${frames[frame++ % 10]}" "$count"
    sleep 0.1
  done
  wait
  [ -t 1 ] && printf '\r\033[K'

  echo "✓ images built, ✗ not built yet"
  for i in "${!shas[@]}"; do
    mark="✗"; [ -e "$tmp/$i" ] && mark="✓"
    label=""; [ "$i" -eq 0 ] && label="(latest) "
    printf '%d - %s %s%s\n' "$i" "$mark" "$label" \
      "$(git show -s --date='format:%Y-%m-%d %H:%M' --format='%h  %cd  %s' "${shas[$i]}")"
  done

  read -r -p "Number to deploy to $env: " n
  case "$n" in '' | *[!0-9]*) echo "not a valid number" >&2; exit 1 ;; esac
  [ "$n" -lt "${#shas[@]}" ] || { echo "not a valid number" >&2; exit 1; }
  sha="${shas[$n]}"
}

build() {
  local id
  git branch -r --contains "$sha" | grep -q . ||
    { echo "$sha isn't on the remote: push it first." >&2; exit 1; }
  gh workflow run ci.yaml --ref main -f sha="$sha"
  sleep 5 # the run takes a moment to show up
  id=$(gh run list --workflow ci.yaml --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')
  gh run watch "$id" --exit-status
}

case "$pick" in
  --rollback) choose ;;
  '') sha=$(git rev-parse HEAD) ;;
  *) sha=$(git rev-parse --verify --quiet "$pick^{commit}") || { echo "unknown commit: $pick" >&2; exit 1; } ;;
esac

if ! has_images "$sha"; then
  read -r -p "No images for ${sha:0:7}. Build them with CI now (checks included)? [y/N] " answer
  [ "$answer" = y ] || { echo aborted; exit 1; }
  build
  has_images "$sha" || { echo "the build finished but the images aren't there" >&2; exit 1; }
fi

if [ "$env" = production ]; then
  read -r -p "Deploy ${sha:0:7} to PRODUCTION? [y/N] " answer
  [ "$answer" = y ] || { echo aborted; exit 1; }
fi

exec deploy/deploy.sh "$env" "$sha"
