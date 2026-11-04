#!/usr/bin/env bash
# Delete all but the newest $KEEP tagged versions of each image on GHCR (never `latest`).
# Needs GH_TOKEN with packages: write. DRY_RUN=1 only prints what would go.
set -euo pipefail

owner="${GITHUB_REPOSITORY_OWNER:-$(gh api user --jq .login)}"
owner=$(printf %s "$owner" | tr "[:upper:]" "[:lower:]")
keep="${KEEP:-10}"

# the packages API has separate paths for organizations and users
if [ "$(gh api "users/$owner" --jq .type)" = Organization ]; then scope=orgs; else scope=users; fi

for name in tangostack-backend tangostack-frontend; do
  base="$scope/$owner/packages/container/$name/versions"
  gh api --paginate "$base?per_page=100" --jq '
      .[] | select((.metadata.container.tags | length) > 0 and (.metadata.container.tags | index("latest") | not))
          | [.created_at, .id, (.metadata.container.tags | join(","))] | @tsv' |
    sort -r | tail -n +$((keep + 1)) |
    while IFS=$'\t' read -r _ id tags; do
      echo "$name: deleting version $id ($tags)"
      [ -n "${DRY_RUN:-}" ] || gh api -X DELETE "$base/$id" >/dev/null
    done
done
