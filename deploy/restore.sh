#!/usr/bin/env bash
# =============================================================================
# Khôi phục CSDL từ một bản pg_dump -Fc (Phase 8 việc 7).
#
#   bash deploy/restore.sh /var/backups/qlcv/qlcv-2026-09-06.dump
#
# Cách chạy: dừng app để không ai ghi trong lúc khôi phục, pg_restore --clean
# thay nội dung hiện tại bằng nội dung bản sao lưu, bật app lại. Bản sao lưu
# KHÔNG bị xoá. Muốn khôi phục cả tệp upload:
#   tar -xzf /var/backups/qlcv/storage-2026-09-06.tar.gz -C /opt/qlcv/
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

FILE="${1:?Cach dung: bash restore.sh <duong-dan-toi.dump>}"
[ -f "$FILE" ] || { echo "Khong thay tep: $FILE"; exit 1; }

eval "$(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' .env)"

echo "Dang dung app de khong ai ghi trong luc khoi phuc..."
docker compose -f docker-compose.yml stop app

echo "Dang khoi phuc $POSTGRES_DB tu $(basename "$FILE")..."
docker compose -f docker-compose.yml exec -T db \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --clean --if-exists --no-owner --single-transaction < "$FILE"

echo "Dang bat app lai..."
docker compose -f docker-compose.yml start app

echo "Xong. Kiem tra: curl -s http://127.0.0.1:3000/readyz"
