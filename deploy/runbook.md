# Runbook vận hành VPS — ttdt.site (Phase 8 việc 7)

Máy: VPS 157.10.199.148 (6 GB RAM, Ubuntu, đã cài swap 4 GB — lệnh ở §4), Docker, nginx chạy TRÊN HOST.
Mã nguồn: `/opt/qlcv` · Cấu hình: `/opt/qlcv/deploy/.env` (chmod 600, KHÔNG dán bí mật vào chat) ·
Container: `qlcv-db` (PostgreSQL 16, KHÔNG publish port), `qlcv-app` (127.0.0.1:3000), `qlcv-onlyoffice` (127.0.0.1:8081).

Mọi lệnh docker compose trong bài chạy từ `/opt/qlcv/deploy`.

---

## 1. Cập nhật phiên bản mới (build + deploy)

```bash
cd /opt/qlcv
bash deploy/backup.sh                # sao lưu TRƯỚC khi deploy — chỉ ~1 giây, không có lý do bỏ
git fetch
git log --oneline HEAD..origin/<nhanh>   # xem trước sẽ kéo gì về
git pull --ff-only
cd deploy
docker compose build app
docker compose up -d                 # chỉ tạo lại container nào đổi ảnh/cấu hình
docker compose run --rm app npm run migrate:up   # nếu có migration mới
curl -s http://127.0.0.1:3000/readyz             # mong đợi: {"ok":true,"db":"up"}
docker compose ps                                # cả ba (trạng thái healthy)
```

Nếu đổi biến trong `deploy/.env`: `docker compose up -d app` là đủ để app nhận giá trị mới (container được tạo lại).

## 2. ROLLBACK (deploy hỏng)

**a) Hỏng mã, chưa đụng CSDL** — quay về commit cũ và dựng lại:

```bash
cd /opt/qlcv
git log --oneline -10            # tìm commit chạy tốt cuối cùng
git checkout <commit-tot>
cd deploy && docker compose build app && docker compose up -d
curl -s http://127.0.0.1:3000/readyz
```

**b) Migration mới làm hỏng dữ liệu** — migration đã chạy KHÔNG tự rút lại an toàn;
khôi phục CSDL từ bản sao lưu chụp TRƯỚC lần deploy đó (§3), rồi quay mã về commit cũ như mục a.
Chỉ dùng `npm run migrate:down` khi chắc chắn migration đó có tệp down và không mất dữ liệu cần giữ.

**c) Đổi .env sai** — sửa lại `deploy/.env` rồi `docker compose up -d app`.

## 3. Khôi phục dữ liệu (restore)

CSDL (đã drill thật ngày 2026-09-06: khôi phục toàn bộ mất ~2 giây với CSDL hiện tại):

```bash
ls -1t /var/backups/qlcv/qlcv-*.dump          # chọn bản cần khôi phục (giữ 14 bản gần nhất)
cd /opt/qlcv && bash deploy/restore.sh /var/backups/qlcv/qlcv-2026-09-06.dump
```

`restore.sh` tự dừng app → `pg_restore --clean --if-exists` → bật app lại. Kiểm tra sau đó:
`curl -s http://127.0.0.1:3000/readyz` và `docker compose ps`.

Tệp người dùng upload (chỉ khi bản sao lưu có `storage-*.tar.gz`):

```bash
tar -xzf /var/backups/qlcv/storage-2026-09-06.tar.gz -C /opt/qlcv/
ls -ln /opt/qlcv/server/storage    # phải thuộc uid:gid 1000:1000; nếu không: chown -R 1000:1000
docker compose restart app
```

## 4. Lệnh chỉ dùng khi THIẾT LẬP VPS MỚI (hoặc mất cấu hình)

Tạo swap 4 GB (máy 6 GB RAM, OnlyOffice ngốn RAM lúc dịch tài liệu):

```bash
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Cron sao lưu 02:00 hằng ngày (đã cài trên VPS này — kiểm tra bằng `crontab -l`):

```bash
(crontab -l 2>/dev/null; echo '0 2 * * * /opt/qlcv/deploy/backup.sh') | crontab -
```

Thư mục storage cho app (uid 1000 trong ảnh node):

```bash
mkdir -p /opt/qlcv/server/storage && chown 1000:1000 /opt/qlcv/server/storage
```

## 5. Năm sự cố thường gặp

### 5.1. Trang không vào được / lỗi 502

```bash
docker compose ps                          # container nào không healthy?
curl -s http://127.0.0.1:3000/readyz       # app có trả lời không?
docker logs qlcv-app --tail 100
docker logs qlcv-db --tail 50
```

- App chết: `docker compose up -d app`; vẫn chết → đọc log, thường là thiếu biến `.env`.
- App sống mà 502: nginx — `nginx -t && systemctl reload nginx`; kiểm tra `/var/log/nginx/error.log`.
- Cả máy: `systemctl status docker` — Docker chết thì `systemctl start docker`, compose tự kéo container lên (`restart: unless-stopped`).

### 5.2. Deploy xong app crash vòng lặp

```bash
docker logs qlcv-app --tail 100            # đọc lỗi TRƯỚC khi rollback
```

Thiếu/biến sai trong `deploy/.env` (app production tự thoát khi thiếu biến bắt buộc): sửa `.env`,
`docker compose up -d app`. Nếu lỗi do mã: ROLLBACK theo §2a. Xem thêm log trước khi xóa container:
`docker logs qlcv-app > /tmp/app-crash.log`.

### 5.3. Đầy đĩa

```bash
df -h
docker system df
docker system prune -f                     # ảnh/mạng thừa — KHÔNG đụng volume (pgdata an toàn)
du -sh /var/backups/qlcv /opt/qlcv/server/storage /var/lib/docker
```

Log container đã xoay vòng 10 MB × 5 (compose), backup giữ 14 bản (backup.sh). Nếu vẫn đầy,
xét tăng đĩa hoặc chuyển `/var/backups/qlcv` sang nơi khác và sửa dòng `THU_MUC` trong `deploy/backup.sh`.

### 5.4. Chứng chỉ TLS sắp hết hạn

Tài khoản Let's Encrypt KHÔNG có email — không có thư nhắc, PHẢI tự kiểm tra định kỳ.

```bash
certbot certificates                       # xem hạn từng chứng chỉ
certbot renew --nginx                      # chạy tay nếu cần; bình thường systemd timer tự lo
systemctl list-timers | grep certbot       # timer còn chạy không
sudo nginx -s reload
```

### 5.5. Không nhận được thông báo Zalo

```bash
cd /opt/qlcv/deploy
docker compose exec app npm run zalo:kiem      # trạng thái bot + liên kết
```

- Token rỗng/sai: NGƯỜI DÙNG tự dán token mới vào `deploy/.env` (không qua chat), rồi
  `docker compose up -d app`.
- Webhook trục trặc (Zalo không gọi về được): chuyển tạm sang polling — đặt
  `ZALO_BOT_NHAN=polling` trong `deploy/.env`, `docker compose up -d app`; sửa xong đặt lại `webhook`.
- Chưa đăng ký webhook: `docker compose exec app npm run zalo:webhook`
  (đăng ký url https://ttdt.site/api/zalo-bot/webhook).

---

## Phụ lục: lệnh hay dùng

| Việc | Lệnh |
|---|---|
| Xem trạng thái | `docker compose ps` |
| Log app | `docker logs qlcv-app --tail 100 -f` |
| Khởi động lại app | `docker compose restart app` |
| Sao lưu ngay | `bash deploy/backup.sh` (log: `/var/backups/qlcv/backup.log`) |
| Vào psql | `docker compose exec db psql -U qlcv -d quanlycongviec` |
| Kiểm tra nhanh | `curl -s http://127.0.0.1:3000/healthz` và `/readyz` |
| nginx | `nginx -t`, `systemctl reload nginx`, `/var/log/nginx/error.log` |

NGUYÊN TẮC: mọi bí mật chỉ nằm trong `/opt/qlcv/deploy/.env` (chmod 600) — không dán vào chat,
log, commit hay tài liệu. `deploy/.env` KHÔNG nằm trong git.
