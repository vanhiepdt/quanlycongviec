#!/usr/bin/env bash
# =============================================================================
# Sao lưu HẰNG NGÀY (Phase 8 việc 7): CSDL bằng pg_dump -Fc + tệp upload bằng tar.
# Cron 02:00 (lệnh cài cron ở cuối deploy/runbook.md), giữ 14 bản mỗi loại.
# Nhật ký: /var/backups/qlcv/backup.log — KHÔNG in bí mật ra log.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

# Chỉ đọc hai biến pg_dump cần — KHÔNG source cả .env: trong đó có dòng lịch cron
# (* * * * *) không phải shell hợp lệ, source là chết giữa chừng.
eval "$(grep -E '^(POSTGRES_USER|POSTGRES_DB)=' .env)"

NGAY="$(date +%F)"
THU_MUC="/var/backups/qlcv"
mkdir -p "$THU_MUC"

{
  echo "=== $(date '+%F %T') bat dau sao luu"

  docker compose -f docker-compose.yml exec -T db \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
    > "$THU_MUC/qlcv-$NGAY.dump"
  echo "CSDL: qlcv-$NGAY.dump ($(du -h "$THU_MUC/qlcv-$NGAY.dump" | cut -f1))"

  # Tệp upload (volume ../server/storage): chỉ nén khi có nội dung.
  if [ -d ../server/storage ] && [ -n "$(ls -A ../server/storage 2>/dev/null)" ]; then
    tar -czf "$THU_MUC/storage-$NGAY.tar.gz" -C .. server/storage
    echo "File: storage-$NGAY.tar.gz ($(du -h "$THU_MUC/storage-$NGAY.tar.gz" | cut -f1))"
  fi

  # Giữ 14 bản gần nhất mỗi loại (tên tệp có ngày nên ls -1t = mới nhất trước).
  # `|| true`: chưa có bản nào khớp glob thì ls thoát 2, pipefail + set -e sẽ giết
  # cả kịch bản dù việc sao lưu đã xong.
  ls -1t "$THU_MUC"/qlcv-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f || true
  ls -1t "$THU_MUC"/storage-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm -f || true

  echo "=== $(date '+%F %T') xong — hien co $(ls -1 "$THU_MUC"/qlcv-*.dump | wc -l) ban CSDL"
} >> "$THU_MUC/backup.log" 2>&1
