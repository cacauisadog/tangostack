#!/usr/bin/env bash
# Dumps one environment's database (custom format) and uploads it to Cloudflare R2.
# Runs on the server, from cron, as the deploy user:
#
#   17 3 * * * /home/deploy/backup-db.sh staging    >> /home/deploy/backup.log 2>&1
#   47 3 * * * /home/deploy/backup-db.sh production >> /home/deploy/backup.log 2>&1
#
# Needs ~/.backup.env (mode 600) with R2_ENDPOINT (https://<account>.r2.cloudflarestorage.com),
# R2_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (an R2 API token limited to the
# bucket). Dumps land in <bucket>/backups/<env>/; the bucket's lifecycle rule expires
# them, so this script never deletes. Restore: pg_restore --no-owner -d <database> <file>. Test that now and then.
set -euo pipefail

env="${1:?usage: backup-db.sh <staging|production>}"
# export them: the aws container only gets the credentials from our environment
set -a
# shellcheck disable=SC1091
. "$HOME/.backup.env"
set +a
export AWS_DEFAULT_REGION=auto

db="tangostack-backend-$env-db"
key="backups/$env/tangostack-$env-$(date -u +%Y%m%dT%H%M%SZ).dump"
aws() { docker run --rm -i -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_DEFAULT_REGION amazon/aws-cli:2.17.0 --endpoint-url "$R2_ENDPOINT" "$@"; }

# pg_dump fails loudly (pipefail) and the upload only completes on a whole stream
docker exec "$db" pg_dump -U tangostack -d tangostack --format=custom | aws s3 cp - "s3://$R2_BUCKET/$key"
echo "$(date -u +%FT%TZ) uploaded $key"
