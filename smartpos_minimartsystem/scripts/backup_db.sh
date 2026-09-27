#!/usr/bin/env bash
# Back up the SmartPOS database to backups/smartpos_minimart_YYYYmmdd_HHMMSS.sql
# Usage: bash scripts/backup_db.sh [mysql-user] [database]
set -euo pipefail
USER_NAME="${1:-root}"
DB_NAME="${2:-smartpos_minimart}"
mkdir -p backups
OUT="backups/${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql"
mysqldump -u "$USER_NAME" -p --single-transaction --routines --triggers "$DB_NAME" > "$OUT"
echo "Backup written to $OUT"
