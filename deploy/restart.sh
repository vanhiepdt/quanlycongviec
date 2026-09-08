#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
COMPOSE="$ROOT/deploy/docker-compose.yml"
MODE="${1:-restart}"
PHASE=preflight

usage() {
  printf '%s\n' 'Dung: bash deploy/restart.sh [--check|--help]' \
    'Mac dinh: backup -> build app -> dung app/OnlyOffice -> tao lai db/OnlyOffice -> migrate -> tao lai app -> health.' \
    'Giu nguyen database, volume, storage, .env va Zalo. KHONG pull Git, seed hay reset.' \
    '--check: chi kiem tra trang thai; khong backup/build/migrate/restart.'
}

if (( $# > 1 )); then usage >&2; exit 2; fi
case "$MODE" in
  -h|--help) usage; exit 0 ;;
  restart|--check) ;;
  *) usage >&2; exit 2 ;;
esac

fail() { printf '%s\n' "$1" >&2; exit 1; }
dc() { docker compose -f "$COMPOSE" "$@"; }
trap 'printf "LOI tai buoc %s. Dung lai; khong xoa du lieu hay tu rollback.\n" "$PHASE" >&2' ERR

wait_db() {
  local deadline=$((SECONDS + 120))
  until [[ "$(docker inspect -f '{{.State.Health.Status}}' qlcv-db 2>/dev/null || true)" == healthy ]]; do
    (( SECONDS < deadline )) || fail 'Database chua healthy sau 120 giay.'
    sleep 2
  done
}

check_health() {
  local deadline=$((SECONDS + 300))
  wait_db
  until [[ "$(docker inspect -f '{{.State.Health.Status}}' qlcv-app 2>/dev/null || true)" == healthy ]] \
    && curl -fsS --max-time 5 http://127.0.0.1:3000/readyz 2>/dev/null | grep -Eq '"db"[[:space:]]*:[[:space:]]*"up"' \
    && [[ "$(curl -fsS --max-time 5 http://127.0.0.1:8081/healthcheck 2>/dev/null || true)" == true ]]; do
    (( SECONDS < deadline )) || fail 'App hoac OnlyOffice chua san sang sau 300 giay; khong bao thanh cong.'
    sleep 2
  done
  dc ps
  printf '%s\n' 'OK: app/db healthy, readyz DB up, OnlyOffice healthcheck=true.'
}

main() {
  [[ "$(uname -s)" == Linux ]] || fail 'Chi chay tren VPS Linux; khong chay tren PC Windows.'
  for tool in docker git curl grep tar gzip sha256sum flock mktemp; do
    command -v "$tool" >/dev/null || fail "Thieu cong cu: $tool"
  done
  test -f "$COMPOSE"
  test -r "$ROOT/deploy/.env"
  cd "$ROOT"
  dc config -q
  if [[ "$MODE" == --check ]]; then PHASE=health; check_health; return; fi
  git diff --quiet
  git diff --cached --quiet
  exec 9>"$(git rev-parse --git-path qlcv-restart.lock)"
  flock -n 9 || fail 'Da co mot luot restart dang chay.'
  umask 022
  printf 'Restart ma hien tai: %s\n' "$(git rev-parse --short HEAD)"
  printf '%s\n' 'Khong tu git pull. Nguoi dung can luu tai lieu OnlyOffice truoc khi tiep tuc.'
  PHASE=backup
  wait_db
  local backup_root="${QLCV_BACKUP_ROOT:-/var/backups/qlcv}"
  local snapshot
  mkdir -p -m 700 "$backup_root"
  snapshot="$(mktemp -d "$backup_root/restart-$(date +%Y%m%d-%H%M%S)-XXXXXX")"
  (
    umask 077
    dc exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$snapshot/database.dump"
    test -s "$snapshot/database.dump"
    dc exec -T db pg_restore --list < "$snapshot/database.dump" > /dev/null
    if [[ -d "$ROOT/server/storage" ]]; then
      tar -czf "$snapshot/storage.tar.gz" -C "$ROOT" server/storage
      gzip -t "$snapshot/storage.tar.gz"
    fi
    sha256sum "$ROOT/deploy/.env" > "$snapshot/config.sha256"
  )
  printf 'Backup: %s\n' "$snapshot"
  PHASE=build
  dc build app
  PHASE=stop
  dc stop app onlyoffice
  PHASE=recreate_database_and_onlyoffice
  dc up -d --force-recreate db onlyoffice
  wait_db
  PHASE=migrate
  dc run --rm --no-deps -T app npm run migrate:up
  PHASE=recreate_app
  dc up -d --force-recreate app
  PHASE=verify
  sha256sum -c "$snapshot/config.sha256"
  check_health
  printf '%s\n' 'Da restart. Khong xoa database/volume/storage/.env; khong gui tin Zalo thu.'
}

main < /dev/null
