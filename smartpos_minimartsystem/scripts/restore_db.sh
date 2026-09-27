#!/usr/bin/env bash
# Restore a backup made by backup_db.sh
# Usage: bash scripts/restore_db.sh backups/smartpos_minimart_20260101_120000.sql [mysql-user] [database]
set -euo pipefail
FILE="${1:?Give the backup file to restore}"
USER_NAME="${2:-root}"
DB_NAME="${3:-smartpos_minimart}"
mysql -u "$USER_NAME" -p "$DB_NAME" < "$FILE"
echo "Restored $FILE into $DB_NAME"
