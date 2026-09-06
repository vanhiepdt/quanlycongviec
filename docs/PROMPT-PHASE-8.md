# Prompt Phase 8 — hạ tầng VPS thật + Zalo + ONLYOFFICE

Viết ngày **2026-09-06**, sau khi đã có VPS thật và chứng chỉ TLS.

Mục 1 ghi **những gì đã làm xong trên VPS** (đừng làm lại). Mục 2 là **prompt dán nguyên khối**
cho session Phase 8. Mục 3 là những điều tôi cần bạn tự tay làm (không ai làm hộ được).

---

## 1. Đã làm xong trên VPS ngày 2026-09-06 — ĐỪNG LÀM LẠI

| Thứ | Trạng thái |
|---|---|
| VPS | `157.10.199.148` · Ubuntu 24.04.3 LTS · kernel 6.8 · **4 CPU · 5.9 GB RAM · đĩa 50 GB** (đã dùng 3.1 GB) · amd64 · **swap 0 MB** |
| Tên miền | `ttdt.site` và `www.ttdt.site` — DNS đã trỏ đúng `157.10.199.148` |
| SSH | khoá `~/.ssh/id_rsa` (RSA 4096, không passphrase) đã nằm trong `authorized_keys` của **root**; `ssh root@157.10.199.148` vào được không cần mật khẩu |
| UFW | đang bật · mở **22, 80, 443** (trước chỉ có 22) |
| Nginx | **1.24.0 (Ubuntu)** cài bằng `apt`, đang chạy, nghe cổng 80 — kiểm từ ngoài `http://ttdt.site` trả **200** |
| Certbot | **2.9.0** + `python3-certbot-nginx` |
| Chứng chỉ TLS | ✅ đã cấp cho `ttdt.site` + `www.ttdt.site` · `/etc/letsencrypt/live/ttdt.site/{fullchain,privkey,cert,chain}.pem` · **hết hạn 2026-12-05** · `certbot.timer` đã bật (lần kế 2026-09-06 14:36) |
| Git | **2.43.0** đã có sẵn |
| Docker | ❌ **chưa cài** |
| Node | ❌ **chưa cài** (không cần nếu chạy trong container) |
| Mã nguồn dự án | ❌ **chưa có trên VPS** |
| PostgreSQL | ❌ **chưa có trên VPS** |

**Ba điều quan trọng về trạng thái này:**

1. **Nginx đang là bản cài bằng `apt` trên HOST, không phải container.** Chứng chỉ nằm ở
   `/etc/letsencrypt/` của host. Kế hoạch §7 việc 8.2 lại khai `nginx` là **một service trong
   docker-compose**. Hai hướng này xung đột — mục 2 của prompt yêu cầu chốt hướng trước khi viết.
2. **`certonly` — chưa sửa file cấu hình nginx nào.** Cổng 443 mở ở firewall nhưng nginx **chưa
   nghe** cổng đó, nên `https://ttdt.site` chưa lên. Cố ý dừng ở đây.
3. **Tài khoản Let's Encrypt đăng ký KHÔNG kèm email** (`--register-unsafely-without-email`) —
   không tự ý dùng email của người dùng. Hệ quả: **không có cảnh báo** nếu tự gia hạn thất bại.
   Thêm email sau bằng `certbot update_account --email <địa-chỉ>`.

## 2. Prompt dán nguyên khối cho session Phase 8

```text
Dự án e:\quanlycongviec — chuyển hệ quản lý công việc từ Google Apps Script + Google Sheets
sang VPS (Node 24 + Express 5 + PostgreSQL 16 + Docker). Tên miền ttdt.site, chứng chỉ TLS
Let's Encrypt ĐÃ cấp. Kế hoạch đầy đủ ở KE-HOACH-VPS.md; kế hoạch thông báo + Zalo ở
docs/KE-HOACH-THONG-BAO.md; thiết kế kết quả file + ONLYOFFICE ở docs/KE-HOACH-KET-QUA-FILE.md.

TRƯỚC KHI LÀM BẤT CỨ VIỆC GÌ:
1. Đọc §13 của KE-HOACH-VPS.md — nguồn sự thật về tiến độ. Đọc thêm §0.1 (TỪ VỰNG: cấp 1 =
   công việc, cấp 2 = công việc con, cấp 3 = nhiệm vụ; KHÔNG gọi cấp 1 là "dự án").
2. Làm theo §13.1. Đọc §13.5 — khối bẫy Phase 0–7, đừng phát hiện lại. Bẫy hay tái diễn:
   PowerShell Get-Content|Set-Content hỏng UTF-8 không BOM; script khôi phải chạy từ GỐC repo;
   sửa §13.3 mà lấy tiền tố dòng cũ làm old_string là PHÁ dòng nhật ký cũ.
3. Đọc §7 Phase 8 — việc 8.1–8.11. Đọc §8.7 (test bảo mật). KHÔNG đọc tràn cả §7/§8.
4. Đọc docs/PROMPT-PHASE-8.md mục 1 — danh sách thứ ĐÃ XONG trên VPS ngày 2026-09-06,
   đừng làm lại. Đọc luôn mục 3 của file đó — việc chỉ NGƯỜI DÙNG làm được.
5. Đọc docs/KE-HOACH-THONG-BAO.md §4 (việc B: nguyên tắc B1, liên kết B2, hàng đợi B4,
   webhook B5) — Zalo viết theo thiết kế đó, đừng thiết kế lại.
6. Đọc docs/BAT-DAU-SESSION.md mục 4 và 5 (lệnh chạy + bẫy máy + quy ước code).

KHÔNG đọc tràn Code.gs.moi (3645 dòng) và web/assets/js/app.js (~4300 dòng) — nguyên nhân
cháy ngữ cảnh số một của dự án. Quét rộng thì giao subagent, chỉ nhận danh sách kết luận.

TRẠNG THÁI: Phase 0–7 + Vòng 14 (kết quả là file, thiết kế lại 2 đợt theo docs/moi.xlsx) +
THÔNG BÁO VIỆC A (chuông + 3 route đọc/đếm/đánh-dấu) đã xong. 1625 test xanh trong 88 file,
lint + format:check sạch. Nhánh hiện tại vps/ket-qua-thiet-ke-lai — Phase 8 tách nhánh mới
vps/phase-8-hatang TỪ nhánh này, nhưng TRƯỚC ĐÓ hỏi người dùng có commit mớ việc B đang dang
dở (mục dưới liệt kê) vào nhánh hiện tại không.

ZALO — ĐÃ CÓ SẴN, ĐỪNG VIẾT LẠI:
- Migration 017 (users.zalo_chat_id + bảng zalo_link_codes + 3 cột hàng đợi trên notifications
  + index idx_notifications_zalo_pending) — đã chạy migrate trên dev và UAT.
- server/src/services/zalo.js — client Bot API bằng fetch thuần: guiTin, kiemToken, layTinMoi,
  datWebhook, xemWebhook, thuWebhook, boWebhook; đọc `ok` trong body chứ KHÔNG tin HTTP status;
  token nằm trong URL path nên KHÔNG BAO GIỜ log.
- server/src/modules/zalo/repo.js + service.js — mã liên kết 6 số (crypto.randomInt, 15 phút,
  một lần), layMa/boLienKet/trangThai/bocMa/xuLyTinDen/bocSuKien/huongDan.
- config/env.js: ZALO_BOT_TOKEN (trống = TẮT cả tính năng), ZALO_BOT_SECRET_TOKEN,
  ZALO_BOT_API_BASE, CRON_ZALO_PUSH, ZALO_PUSH_MAX_AGE_H — nhóm optional, đủ default.

VIỆC CỦA SESSION NÀY:

VIỆC 1 — Hoàn tất phần CODE của thông báo việc B trên MÁY DEV (không cần VPS):
  1a. modules/zalo/routes.js + mount vào app.js: GET /api/v1/zalo/trang-thai,
      POST /api/v1/zalo/ma-lien-ket, DELETE /api/v1/zalo/lien-ket — requireAuth, theo khuôn
      module notifications. REST thuần, KHÔNG mở tên RPC thứ 38.
  1b. Webhook POST /api/zalo-bot/webhook — mount GIỮA attachSession và issueCsrfCookie
      (khuôn /v1/task-files-ds): so header X-Bot-Api-Secret-Token với ZALO_BOT_SECRET_TOKEN
      bằng safeEqual của auth/cookies.js (KHÔNG tự timingSafeEqual trên độ dài chuỗi); sai ⇒
      403 bằng AppError/forbidden(); chỉ xử event_name message.text.received; luôn trả 2xx NHANH.
  1c. services/cron.js thêm dayThongBaoZalo({ now }) theo đúng khuôn quetQuaHan: lấy tối đa
      50 dòng theo idx_notifications_zalo_pending, JOIN users lấy zalo_chat_id; CHỈ đẩy 3 loại
      approval_pending/approval_rejected/overdue; bỏ tin cũ hơn ZALO_PUSH_MAX_AGE_H; người chưa
      liên kết ⇒ đánh dấu bỏ qua (đừng quét lại mãi); thất bại ⇒ zalo_attempts+1, quá 3 thì thôi.
  1d. CLI trong server/package.json: zalo:kiem (getMe), zalo:link -- <email> <chat_id> (gán
      tay khi chưa có webhook), zalo:webhook (đặt/xem/thử webhook).
  1e. UI liên kết: khối «Thông báo Zalo» ở trang cá nhân / Quản lý tài khoản — trạng thái đã
      liên kết, nút lấy mã 6 số + câu hướng dẫn nhắn LIENKET <mã> cho bot, nút bỏ liên kết.
      Nội dung do máy chủ trả, vẽ qua builder đặt tên build* (bẫy XSS §13.5); nhãn tĩnh KHÔNG
      bọc escapeHtml.
  1f. Test TC-ZL-01..14 theo bảng §4.B7 của KE-HOACH-THONG-BAO.md (fetch bị giả; ok:false dù
      HTTP 200 vẫn tính hỏng; text >2000 bị cắt; token trống không gọi mạng; webhook 403/200;
      mã hết hạn/đã dùng; unique chat_id trả câu tiếng Việt chứ không 500; cron đẩy đúng 3 loại;
      TC-ZL-14 Zalo chết KHÔNG đổ luồng duyệt). File jsdom mới PHẢI khai vào danh sách files
      của server/eslint.config.js. Đếm lại pin XSS bằng tools/dem-xss.mjs, ghi delta vào
      docs/XSS-4.6.md. Xong việc 1: đẩy Zalo chạy được TRÊN DEV bằng polling/gán tay.

VIỆC 2 — Dockerfile + docker-compose.yml BẢN CHẠY THẬT (8.1 + 8.2, đã điều chỉnh):
  - Dockerfile multi-stage node:24-alpine, user không phải root, HEALTHCHECK /healthz.
  - docker-compose.yml 3 service: app + db + onlyoffice. NGINX NẰM TRÊN HOST (không vào
    compose) vì chứng chỉ + certbot.timer đã ổn định ở đó; nếu muốn đổi hướng phải hỏi trước.
  - db KHÔNG publish port; volume pgdata. app publish 127.0.0.1:3000 (chỉ host nginx tới được).
  - ONLYOFFICE Document Server: image onlyoffice/documentserver, JWT BẮT BUỘC bật,
    JWT_SECRET chung giá trị với ONLYOFFICE_JWT_SECRET của app; chỉ publish về 127.0.0.1.
  - Log xoay vòng max-size=10m max-file=5 (8.9). NODE_ENV=production: env đọc từ môi trường
    container, KHÔNG load deploy/.env bằng process.loadEnvFile — giữ quy ước env.js.
  - Trước khi chạy trên VPS: thêm 2–4 GB SWAP (VPS đang 0 swap, ONLYOFFICE ngốn ~2 GB RAM).

VIỆC 3 — VPS: cài Docker + deploy bằng git:
  - Cài Docker Engine + compose plugin (get.docker.com), bật khởi động cùng máy.
  - Git 2.43 ĐÃ CÓ — không cài lại. Remote: https://github.com/vanhiepdt/quanlycongviec.
    Clone về /opt/qlcv; repo private thì tạo deploy key/PAT CHỈ-ĐỌC và hỏi người dùng dán.
  - Quy trình deploy: git pull → docker compose build → migrate:up (chạy trong container app)
    → up -d; ghi lệnh LÙI BẢN vào runbook. Không scp cây nguồn bằng tay.

VIỆC 4 — Nginx HOST phục vụ HTTPS thật (8.3/8.4/8.5):
  - Chứng chỉ ĐÃ cấp ở /etc/letsencrypt/live/ttdt.site (certonly, chưa sửa cấu hình) — thêm
    server block 443 dùng nó, đừng xin chứng chỉ mới. Chuyển hướng 80→443, www → apex.
  - Reverse proxy /api và /healthz về 127.0.0.1:3000; web/ tĩnh theo deploy/nginx/app.conf
    + security-headers.conf (đã đủ CSP/COOP; việc 8.5 chỉ THÊM HSTS bây giờ đã có HTTPS).
  - client_max_body_size 60m — giới hạn tải file của app là 50 MB (số 10m trong kế hoạch cũ
    là LỖI THỜI, đừng chép lại).
  - Subdomain office.ttdt.site (chờ người dùng trỏ DNS — mục 3 file này): certbot certonly
    + một server block proxy vào container onlyoffice.

VIỆC 5 — ONLYOFFICE chạy thật (để «kết quả gửi file» sửa trực tuyến được):
  - deploy/.env trên VPS đủ 3 biến: ONLYOFFICE_URL=https://office.ttdt.site,
    ONLYOFFICE_JWT_SECRET, ONLYOFFICE_CALLBACK_BASE. Đọc § đáp ONLYOFFICE trong
    docs/KE-HOACH-KET-QUA-FILE.md trước; callback phải với TỚI được từ container onlyoffice
    (cùng mạng compose thì dùng URL nội bộ — kiểm thật chứ đừng đoán).
  - Test tay end-to-end và ghi vào runbook: tải .docx lên làm kết quả → bấm ✎ sửa trực tuyến
    → lưu → sinh bản mới; thử cả ✎ của .xlsx/.pptx (cell/slide).

VIỆC 6 — Zalo trên VPS (webhook — điều kiện đủ nay mới có):
  - node script zalo:kiem với token thật trong deploy/.env.
  - zalo:webhook đặt url=https://ttdt.site/api/zalo-bot/webhook + ZALO_BOT_SECRET_TOKEN;
    xemWebhook/thuWebhook xác nhận.
  - Nhắn LIENKET <mã> từ tài khoản Zalo thật → users.zalo_chat_id được ghi; gửi duyệt một
    việc thật → người liên kết nhận tin Zalo. Nếu webhook không lên được, để fallback polling
    (nhanBangPolling + layTinMoi) và ghi lý do vào runbook.
  - Token cũ đã lọt vào chat transcript — mục 3 file này nói người dùng XOAY token; dùng
    token MỚI cho mọi cấu hình.

VIỆC 7 — Sao lưu, bảo mật, runbook (8.6–8.8, 8.10, 8.11):
  - deploy/.env chmod 600, không vào git; mật khẩu Postgres sinh ngẫu nhiên ≥32 ký tự
    (kệnh lệnh sinh ghi trong runbook); SESSION_SECRET ngẫu nhiên.
  - backup.sh pg_dump -Fc mỗi ngày 02:00, giữ 14 bản, nén, ghi log; restore.sh + THỬ PHỤC HỒI
    THẬT vào CSDL rỗng, ghi thời gian.
  - UFW đã mở 22/80/443 (đừng đổi); thêm fail2ban cho SSH; SSH chỉ khoá.
  - deploy/runbook.md: dựng mới, lên bản, lùi bản, phục hồi CSDL, 5 sự cố thường gặp — trong
    đó có sự cố ONLYOFFICE (JWT lệch, callback không tới) và sự cố Zalo (webhook hỏng →
    polling fallback).

KHÔNG LÀM:
- Đừng làm lại bất cứ thứ gì ở mục 1 file này (chứng chỉ, nginx, certbot, git, UFW, SSH).
- Đừng commit deploy/.env, server/storage/, data/*. KHÔNG git add . — nêu đường dẫn rõ.
- Token Zalo và JWT secret KHÔNG được xuất hiện trong code, log, tài liệu hay commit.
- Không thêm thư viện mới (client Zalo đã viết bằng fetch thuần — §2.3 kế hoạch).
- Không đổi hình dạng phản hồi cầu RPC; không mở tên RPC mới khi REST đủ; không nới quyền §6.
- Không phá chuông thông báo (việc A) đã chạy; không làm nút Duyệt/Từ chối trên cây (D3–D8).
- Không chạy ONLYOFFICE không JWT; không để container db publish port ra Internet.

XONG KHI:
- 1625 test cũ vẫn xanh (có thêm test mới), lint + format:check sạch.
- docker compose config sạch; build + up trên máy dev được; down && up -d không mất dữ liệu.
- https://ttdt.site lên thật (chứng chỉ hợp lệ, www→apex, HSTS); http tự nhảy https.
- https://office.ttdt.site sống; sửa trực tuyến một kết quả .docx THẬT end-to-end.
- Zalo: setWebhook OK, ít nhất một tài khoản thật liên kết thành công, một lượt gửi duyệt
  thật đẩy được tin Zalo; TC-ZL-14 chứng minh Zalo chết không đổ luồng duyệt.
- restore.sh thử thật thành công có ghi thời gian; runbook đủ 5 sự cố.
- Cập nhật §13.2/§13.3/§13.4/§13.5; cập nhật mục 1 + mục 3 của docs/BAT-DAU-SESSION.md —
  mục 3 lần sau là prompt Phase 9 (nghiệm thu, chạy song song, cắt chuyển). Commit theo từng
  việc nhỏ, thông điệp có mã phase-8, KHÔNG git add .

Viết test song song với code, chạy NGAY sau mỗi việc (cd server && npm test), không dồn cuối.

Trả lời tiếng Việt.
```

---

## 3. Việc chỉ NGƯỜI DÙNG làm được (session AI không làm thay)

1. **XOAY Bot Token Zalo.** Token cũ đã dán vào khung chat — coi như lộ. Vào Zalo Bot Creator
   sinh token mới, chỉ dán vào `deploy/.env` (cả máy dev lẫn VPS), không dán vào chat nữa.
2. **Trỏ DNS cho ONLYOFFICE**: thêm bản ghi A `office.ttdt.site` → `157.10.199.148`
   (trước VIỆC 4/5 của prompt). Nếu muốn tránh DNS mới, chọn hướng proxy theo đường dẫn
   `/office/` — nhưng Document Server chạy tên miền con sạch hơn, khuyến nghị hướng này.
3. **Quyền git trên VPS**: nếu repo `vanhiepdt/quanlycongviec` là private, tạo deploy key
   hoặc PAT chỉ-đọc cho VPS khi session hỏi.
4. **Bí mật trong `deploy/.env` trên VPS**: session sẽ đưa lệnh sinh chuỗi ngẫu nhiên, nhưng
   chính bạn dán/lưu: mật khẩu Postgres ≥32 ký tự, `SESSION_SECRET`, `ONLYOFFICE_JWT_SECRET`,
   `ZALO_BOT_TOKEN` (mới), `ZALO_BOT_SECRET_TOKEN` (8–256 ký tự). Không dán bí mật vào chat.
5. **Tùy chọn — email cảnh báo chứng chỉ**: tài khoản Let's Encrypt đang KHÔNG có email,
   tự gia hạn hỏng sẽ không ai biết. Thêm bằng
   `certbot update_account --email <địa-chỉ-của-bạn>` trên VPS.
6. **Sau khi go-live — mỗi cán bộ tự liên kết Zalo một lần**: vào trang cá nhân lấy mã 6 số,
   mở bot, nhắn `LIENKET <mã>`. Khoảng 20 người; không ai liên kết hộ được ai (đây là thiết
   kế an toàn, không phải phiền).

