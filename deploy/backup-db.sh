#!/usr/bin/env bash
# Dumps one environment's database (custom format) and uploads it to Cloudflare R2.
# Runs on the server, from cron, as the deploy user:
#
#   17 3 * * * /home/deploy/backup-db.sh staging    >> /home/deploy/backup.log 2>&1
#   47 3 * * * /home/deploy/backup-db.sh production >> /home/deploy/backup.log 2>&1
#
# Needs ~/.backup.env (mode 600) with R2_ENDPOINT (https://<account>.r2.cloudflarestorage.com),
# R2_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (an R2 API token limited to the
# bucket). Restore: pg_restore --no-owner -d <database> <file>. Test that now and then.
set -euo pipefail

env="${1:?usage: backup-db.sh <staging|production>}"
KEEP_DAYS="${KEEP_DAYS:-30}"
# shellcheck disable=SC1091
. "$HOME/.backup.env"
export AWS_DEFAULT_REGION=auto

db="tangostack-backend-$env-db"
key="postgres/$env/tangostack-$env-$(date -u +%Y%m%dT%H%M%SZ).dump"
aws() { docker run --rm -i -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION amazon/aws-cli:2.17.0 --endpoint-url "$R2_ENDPOINT" "$@"; }

# pg_dump fails loudly (pipefail) and the upload only completes on a whole stream
docker exec "$db" pg_dump -U tangostack -d tangostack --format=custom | aws s3 cp - "s3://$R2_BUCKET/$key"
echo "$(date -u +%FT%TZ) uploaded $key"

# retention: drop this environment's dumps older than KEEP_DAYS
cutoff="$(date -u -d "-$KEEP_DAYS days" +%Y%m%d 2>/dev/null || true)"
if [ -n "$cutoff" ]; then
  aws s3 ls "s3://$R2_BUCKET/postgres/$env/" | awk '{print $4}' | while read -r name; do
    stamp="${name#tangostack-$env-}"; stamp="${stamp%%T*}"
    [[ "$stamp" =~ ^[0-9]{8}$ && "$stamp" < "$cutoff" ]] && aws s3 rm "s3://$R2_BUCKET/postgres/$env/$name" >/dev/null && echo "removed $name"
  done
fi
