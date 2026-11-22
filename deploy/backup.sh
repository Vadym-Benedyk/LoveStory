#!/usr/bin/env bash
# Backup of the SQLite database and of the photos (STORAGE_DRIVER=local keeps them next to it).
#
# Database: a consistent copy with SQLite's online backup (safe while the API is running), checked,
# gzipped into BACKUP_DIR; the newest KEEP files are kept there, and the new one is uploaded to S3 when
# BACKUP_S3_URI is set. Photos: when UPLOADS_S3_URI is set, the photos folder is synced there (only new
# files are uploaded; a photo deleted on the site stays in the backup). A local copy of the photos would
# sit on the same disk, so there is none: the Lightsail snapshots cover that.
# Needs the sqlite3 CLI on the host (apt install sqlite3); for the uploads also the AWS CLI, with
# credentials that may write there (the backup user of infra/server.yml).
#
# Nightly at 03:15 (crontab -e):
#   15 3 * * * /opt/lovestory/deploy/backup.sh >> /var/log/lovestory-backup.log 2>&1
#
# Settings, all optional environment variables:
#   DB_FILE         default: <this folder>/data/lovestory.db
#   BACKUP_DIR      default: <this folder>/backups
#   KEEP            default: 7 (newest local backups to keep)
#   BACKUP_S3_URI   e.g. s3://my-backups/lovestory (no trailing slash); dumps there expire (infra/server.yml)
#   UPLOADS_DIR     default: <this folder>/data/uploads
#   UPLOADS_S3_URI  e.g. s3://my-backups/uploads (no trailing slash); must NOT be under BACKUP_S3_URI, or
#                   the expiry rule for old dumps deletes the photos too
set -euo pipefail
umask 077 # the database holds guests' names and phone numbers

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DB_FILE=${DB_FILE:-$HERE/data/lovestory.db}
BACKUP_DIR=${BACKUP_DIR:-$HERE/backups}
KEEP=${KEEP:-7}
UPLOADS_DIR=${UPLOADS_DIR:-$HERE/data/uploads}

[ -f "$DB_FILE" ] || { echo "backup: database not found: $DB_FILE" >&2; exit 1; }
command -v sqlite3 >/dev/null || { echo "backup: sqlite3 is not installed" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"
tmp=$(mktemp "$BACKUP_DIR/.tmp.XXXXXX")
trap 'rm -f "$tmp"' EXIT

sqlite3 "$DB_FILE" ".backup '$tmp'"
check=$(sqlite3 "$tmp" 'PRAGMA integrity_check;')
[ "$check" = "ok" ] || { echo "backup: integrity check failed: $check" >&2; exit 1; }

out="$BACKUP_DIR/lovestory-$(date -u +%Y%m%dT%H%M%SZ).db.gz"
gzip -c "$tmp" > "$out"
echo "backup: wrote $out ($(wc -c < "$out") bytes)"

# Keep the newest KEEP backups.
ls -1t "$BACKUP_DIR"/lovestory-*.db.gz | tail -n +$((KEEP + 1)) | while read -r old; do rm -f -- "$old"; done

if [ -n "${BACKUP_S3_URI:-}" ]; then
  aws s3 cp --only-show-errors "$out" "$BACKUP_S3_URI/$(basename "$out")"
  echo "backup: uploaded to $BACKUP_S3_URI/"
fi

if [ -n "${UPLOADS_S3_URI:-}" ] && [ -d "$UPLOADS_DIR" ]; then
  aws s3 sync --only-show-errors "$UPLOADS_DIR" "$UPLOADS_S3_URI"
  echo "backup: photos synced to $UPLOADS_S3_URI/ ($(find "$UPLOADS_DIR" -type f | wc -l | tr -d ' ') files)"
fi
