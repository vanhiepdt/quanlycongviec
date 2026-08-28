# Bắt đầu một session mới — dán prompt, chạy, không phải nhớ gì

File này để **mở một session AI mới** mà không mất thời gian dò lại dự án đang ở đâu. Nguồn sự
thật về tiến độ vẫn là **§13 của `KE-HOACH-VPS.md`**; file này chỉ là bàn đạp.

Thứ tự dùng: đọc mục 1 (đang ở đâu) → copy prompt ở mục 2 hoặc 3 → dán vào session mới.

---

## 1. Đang ở đâu (cập nhật mỗi khi xong một phase)

| | |
|---|---|
| Nhánh đang làm | `vps/quan-ly-nhiem-vu-pgd` (tách từ `vps/phase-7-misc`) — HEAD `2c7412c`. Việc ngoài kế hoạch đã xong: tab «Quản lý Nhiệm vụ», Phó Giám đốc thấy tab «Quản lý công việc», **ủy quyền có thời hạn**, bộ lọc một dòng + Tháng/Năm cho «Quản lý công việc», trang «Quản lý tài khoản», **siết ủy quyền theo §13.4 mục 17/18/20** (thứ bậc + cùng phòng + phê duyệt của người được ủy quyền), và **ô «Người nhận» của form ủy quyền là Ô CHỌN NGƯỜI** (danh sách đúng luật máy chủ). Nhánh trước: `vps/phase-7-misc` dừng ở `82e6958`, `vps/tinh-nang-phan-cong` ở `5cb6360`, `vps/phase-6-stats` ở `b2e65f1`, `vps/phase-5-approval` ở `5e89293` |
| Phase đã xong | **0**–**7** (Phase 7: đề nghị CRUD, quản lý App, chat REST + hỏi lại 10 giây, cron dọn chat >90 ngày, xuất Excel 3 mẫu, quyền xuất theo phạm vi — **cầu RPC 37/37 chạy thật, hết `pending()`**) **+ tính năng ngoài kế hoạch**: phân công ba lớp — migration `005_phan_cong.sql` (`works`/`work_items` thêm `supervisor_id`, `leader_ids`, CHECK `task_leader_single`), module `assignments/service.js`, endpoint `GET /departments/assignment-options`, giao diện form/modal; **Sơ đồ Gantt xem theo THÁNG** (2026-08-26, chi tiết `docs/NHAT-KY-GANTT-THEO-THANG.md`); **tab «Quản lý Nhiệm vụ»** (lọc Tháng/Năm/Cán bộ/Phòng + gom khối theo công việc con); **Phó Giám đốc** thấy tab «Quản lý công việc» (client `laQuanTriTrongPhamVi()`, máy chủ không nới quyền — `inScope()` đã bó theo `managedDepartmentIds`); **ỦY QUYỀN CÓ THỜI HẠN** — migration `006_delegations.sql` (`EXCLUDE USING gist` + `btree_gist` chặn trùng khoảng ngày cùng cặp người), **lớp 3 của `can()`** (quyền mượn khi `current_date` ∈ [from,to], `inScopeMuon()`, `viaDelegationId` ghi vào `activity_logs.details`), REST `/api/v1/delegations`, modal «Ủy quyền của tôi» + nhãn «đang được ủy quyền» (kế hoạch `docs/KE-HOACH-UY-QUYEN.md`); **PHÊ DUYỆT ỦY QUYỀN + thứ bậc + cùng phòng** (2026-08-28, §13.4 mục 17/18/20) — migration `007_delegations_approval.sql` (`status` DEFAULT `'pending'`, `accepted_at`/`declined_at`, EXCLUDE nới sang `('pending','active')`), `BAC_VAI` chặn ủy quyền lên cấp trên (`DELEGATION_RANK_UP`), bắt cùng phòng trừ 3 cặp ngoại lệ (`DELEGATION_DIFFERENT_DEPARTMENT`), `POST /:id/accept` · `/:id/decline` chỉ người nhận bấm được (admin **không** thay được), thông báo hai chiều trong bảng `notifications`, và ô chọn phòng hiện **riêng cho Giám đốc** ở form ủy quyền (`buildUyQuyenPhamVi()`); **trang «Quản lý tài khoản»** + bộ lọc một dòng của tab «Quản lý nhiệm vụ» + ô Tháng/Năm cho tab «Quản lý công việc» |
| Test đang xanh | **1255** trong 71 file, lint + `format:check` sạch. Pin XSS **86 chỗ / 606 giá trị** (`docs/XSS-4.6.md`). Banner + buster hiện tại: `app.js 20260828-82`, `app.css 20260828-5`, `project-details.js -4`. Thư viện mới của Phase 7: `exceljs@4.4.0` (đã ghi §3.3). Test jsdom chạy app.js thật đã có: `dept-select`, `project-form-phan-cong`, `task-form-candidate`, `project-details-phan-cong`, `gantt-ui`, `tasks-nhiem-vu-ui`, `pho-giam-doc-ui`, `uy-quyen-ui` (TC-UQ-15/16/18/18b/**19/19b**), `bo-loc-cong-viec`, `tai-khoan-ui` — thêm file jsdom mới thì **phải** khai vào danh sách `files` ở `server/eslint.config.js` |
| Phase kế tiếp | **8 — hạ tầng VPS, bảo mật, sao lưu** (§7 Phase 8 việc 8.1–8.11; §8.7). **Chờ §11 mục 1–4** (thông số VPS, tên miền/DNS, quyền SSH, nội bộ hay Internet) — chưa có VPS thật thì chỉ làm được phần chạy local: `Dockerfile`, `docker-compose.yml` bản chạy thật, `backup.sh`/`restore.sh`, `deploy/runbook.md`. Prompt dán sẵn ở mục 3 |
| Còn treo | **D3–D8 UI**: máy chủ REST `/approvals/.../{submit,approve,reject}` + `pending-count` có từ Phase 5; `app.js` chưa có nút trên cây — **không** tự làm trừ khi người dùng yêu cầu. **Thông báo chưa có đường ĐỌC**: bảng `notifications` đã có dòng thật (ủy quyền ghi hai chiều) nhưng vẫn thiếu `GET /notifications` + chuông trên giao diện (§13.4 **mục 16** — câu đang chờ người dùng), nên người nhận thấy đề nghị ở chính trang «Ủy quyền của tôi». **Ủy quyền còn thiếu**: nhắc "sắp hết hạn" (chưa làm) và §13.4 **mục 19** (số người ủy quyền cùng lúc — vẫn để không giới hạn). **Test tay ủy quyền**: 8 bước của §12 `docs/KE-HOACH-UY-QUYEN.md` đã **kiểm chứng bằng REST 2026-08-28** trên CSDL nháp riêng (đã xoá) — còn phần **mắt người** (§10 + nhãn màu, hai nút Đồng ý/Từ chối, ô chọn phòng của Giám đốc, **ô CHỌN người nhận** — mở form ủy quyền bằng từng vai, xem danh sách hiện đúng ai) chưa chạy trên trình duyệt UAT. **Nợ nhỏ Phase 6**: modal «bấm số mở danh sách» lọc tháng/phòng **ở trình duyệt**; Gantt nhóm `assignee` hiện toàn cây con. **UAT M1** (mở 3 file `.xlsx` bằng Excel thật) chỉ máy kiểm được chữ ký `PK` + content-type, còn cần người ký |
| Đang chờ người dùng | **§13.4 mục 16** — có mở `GET /notifications` + chuông thông báo trên giao diện hay để nguyên? **§13.4 mục 19** — một người được nhận ủy quyền từ mấy người cùng lúc (đang **không giới hạn**; dễ chấp nhận hơn từ khi mục 20 bắt phải có phê duyệt). Mục **17/18/20 đã trả lời 2026-08-28** — xem §13.4. (Ngoài ra §11 mục 1–4 cho Phase 8.) |
| Dữ liệu để làm việc | `npm run seed:dev` → **dữ liệu mẫu §8.3**: 5 phòng (`PH05` rỗng hoàn toàn), 13 người, 9 công việc, 13 công việc con, 17 nhiệm vụ, 7 nhắc việc, 5 đề nghị, 4 app, 12 tin nhắn, 6 thông báo, 20 dòng nhật ký. **Cố ý có dữ liệu bẩn** (email chữ hoa, trùng họ tên, nhiệm vụ mồ côi, link thiếu `http`, ngày 29/02) — đừng "sửa cho sạch" |
| ⚠ CSDL dev đang bị chặn seed | CSDL `quanlycongviec` (dev) còn **5 dòng tay** từ lúc thử tay (`CV001` "Việc gốc"…) trùng `code` nhưng khác `level` ⇒ `npm run seed:dev` nổ `PARENT_NOT_SUBWORK` ở đó. Cách chữa: xoá 5 dòng đó rồi seed lại, hoặc seed sang CSDL khác (`DATABASE_URL=…/quanlycongviec_uat npm run seed:dev` — `loadEnvFile()` không ghi đè biến dòng lệnh) |
| ⚠ CSDL khói UAT dễ thiếu migration | `quanlycongviec_uat` **không** tự `migrate:up` khi dev có migration mới. Mỗi lần thêm migration: `DATABASE_URL=…/quanlycongviec_uat npm run migrate:up`. **Đang nợ: không** — `007_delegations_approval.sql` đã lên `quanlycongviec_uat` ngày 2026-08-28 (đã xác nhận có `status`/`accepted_at`/`declined_at` + dòng `pgmigrations`) |
| Tài khoản thử tay | `TEST001..TEST013` (§13.7), mật khẩu chung `Test@12345`, tất cả bị bắt đổi ở lần đăng nhập đầu. Có đủ **6 vai trò** |
| Tự tay test giao diện | `docs/HUONG-DAN-TEST-GIAO-DIEN.md`. Tổng quan/Gantt giờ uống REST mới (`/stats/*`, `/gantt`) — mở mục Tổng quan là thấy 6 biểu đồ có số thật |
| Chạy lại lượt khói | `"C:\Program Files\Git\bin\bash.exe" tools/smoke-8.5.sh` (`bash` trần trùng WSL!) — **chạy từ gốc repo**, không từ `server/`. Cần một Nginx trỏ về máy chủ (xem mục 4) hoặc đặt `BASE=http://127.0.0.1:3000`. Script tự dọn dòng nó tạo (công việc / nhiệm vụ / đề nghị / app / thông báo `LIKE 'KHÓI 8.5%'`) và in số dòng còn lại để đối chiếu với seed (**sau seed: 14 / 36**). Đã có sẵn T5–T10 `/stats/*`, R1–R7 `/gantt`, R8–R10 đề nghị/chat, R11 CRUD app, R12 ba file `.xlsx`, R12b so phạm vi admin ↔ Nhân viên, R13 đếm cầu RPC |
| Dữ liệu thật (chỉ để đối chiếu) | Số liệu ở §13.8 (snapshot JSON **đã bỏ** — §13.4 mục 11). 28 dòng thật **nhập tay qua giao diện web** ở **Phase 9** (§13.4 mục 12) |

Nếu bảng này khác `KE-HOACH-VPS.md` §13.2 thì **§13.2 đúng** — sửa lại bảng này.

---

## 2. Prompt mẫu — thay `<PHASE>` rồi dán

```text
Dự án e:\quanlycongviec — chuyển hệ quản lý công việc từ Google Apps Script + Google Sheets
sang VPS (Node 24 + Express 5 + PostgreSQL 16 + Docker). Kế hoạch đầy đủ ở KE-HOACH-VPS.md.

TRƯỚC KHI LÀM BẤT CỨ VIỆC GÌ:
1. Đọc §13 của KE-HOACH-VPS.md — đó là nguồn sự thật về việc đang làm đến đâu.
2. Làm theo §13.1 (quy tắc làm việc qua nhiều session).
3. Xem §13.2 để biết phase hiện tại, rồi đọc ĐÚNG phase đó ở §7 và ĐÚNG module test
   tương ứng ở §8.4. Không đọc cả §7, không đọc cả §8.

KHÔNG đọc tràn Code.gs.moi (3645 dòng) và js.clean.html (3653 dòng) — chỉ Grep tên hàm cần
port. Đọc tràn hai file này là nguyên nhân cháy ngữ cảnh phổ biến nhất của dự án này.
Chỉ đọc thêm §2/§4/§5/§6 khi phase hiện tại thực sự cần.

CUỐI SESSION, bắt buộc trước khi tổng kết: cập nhật §13.2, thêm 1 dòng vào §13.3 (không sửa
dòng cũ), bổ sung §13.4 nếu có câu cần tôi trả lời, bổ sung §13.5 nếu phát hiện bẫy mới.
Nếu thiết kế đổi thì sửa luôn mục gốc (§4/§5/§6), không chỉ ghi ở §13. Cập nhật mục 1 của
docs/BAT-DAU-SESSION.md. Commit theo từng việc nhỏ, thông điệp có mã phase.

Trả lời tiếng Việt.

VIỆC CỦA SESSION NÀY: <PHASE>
```

---

## 3. Prompt cho session tiếp theo — Phase 8 (hạ tầng VPS, bảo mật, sao lưu), dán nguyên khối

```text
Dự án e:\quanlycongviec — chuyển hệ quản lý công việc từ Google Apps Script + Google Sheets
sang VPS (Node 24 + Express 5 + PostgreSQL 16 + Docker). Kế hoạch đầy đủ ở KE-HOACH-VPS.md.

TRƯỚC KHI LÀM BẤT CỨ VIỆC GÌ:
1. Đọc §13 của KE-HOACH-VPS.md — nguồn sự thật về việc đang làm đến đâu. Đọc thêm §0.1
   (TỪ VỰNG: cấp 1 = công việc, cấp 2 = công việc con, cấp 3 = nhiệm vụ; KHÔNG gọi cấp 1 là
   "dự án"). Vai trò là "Quản lý công việc", không phải "Quản lý dự án".
2. Làm theo §13.1. Đọc §13.5 — đủ khối bẫy Phase 0–7. Đừng phát hiện lại. Bẫy hay tái diễn:
   PowerShell Get-Content|Set-Content hỏng UTF-8 không BOM (node --check vẫn xanh!); bash trần
   trên máy này là WSL, phải gọi Git Bash đường dẫn rõ; script khói phải chạy từ GỐC repo;
   502 ở cổng 8099 nghĩa là máy chủ Node trên host đã chết chứ không phải Nginx sai;
   seed:dev KHÔNG xoá locked_until/failed_logins nên sau một lượt khói đứt dở phải UPDATE tay;
   sửa §13.3 mà lấy tiền tố dòng cũ làm old_string là PHÁ dòng nhật ký cũ.
3. Đọc §7 Phase 8 — 11 việc 8.1–8.11 (dòng ~1029). Đọc §8.7 (test bảo mật) và §2.11/§2.12
   nếu cần. Không đọc cả §7, không đọc cả §8.
4. Đọc docs/UAT.md phần "Checklist khói §8.5" — lượt Phase 7 (2026-08-27, HEAD e3fe132):
   54 ✅ · 0 ❌ · 6 ⏳ · 0 —. Sáu ô ⏳ còn lại là D3–D8 (nút Duyệt trên cây, UI chưa ai yêu
   cầu) — ĐỪNG tô xanh. Ô M1 (mở .xlsx bằng Excel thật) phải người thật ký.
5. Đọc docs/BAT-DAU-SESSION.md mục 4 và 5 (lệnh chạy + bẫy máy + quy ước code).

KHÔNG đọc tràn Code.gs.moi (3645 dòng) và web/assets/js/app.js (~4300 dòng) — đây là
nguyên nhân cháy ngữ cảnh phổ biến nhất của dự án này. Việc quét rộng thì giao subagent và
chỉ nhận danh sách kết luận.

TRẠNG THÁI: Phase 0–7 đã xong. 1255 test xanh trong 71 file, lint + format:check sạch.
Cầu RPC 37/37 chạy thật (hết pending). Nhánh vps/quan-ly-nhiem-vu-pgd (HEAD 3dc480b, tách
từ vps/phase-7-misc) — Phase 8 tách nhánh mới vps/phase-8-hatang TỪ nhánh này.

CHƯA CÓ VPS THẬT. §11 mục 1–4 vẫn treo: (1) thông số VPS RAM/CPU/đĩa/OS, (2) tên miền hoặc
quyết định dùng IP + quyền trỏ DNS, (3) quyền SSH, (4) hệ thống chỉ chạy mạng nội bộ hay mở
ra Internet. VÌ VẬY: làm trọn phần dựng được và kiểm được TRÊN MÁY DEV, phần nào bắt buộc
phải có VPS/tên miền thì viết sẵn cấu hình + runbook rồi ghi rõ "chờ §11 mục N" trong
§13.2/§13.4 — ĐỪNG bịa số liệu SSL Labs hay thời gian dựng khi chưa chạy thật.

ĐÃ CÓ SẴN, ĐỪNG LÀM LẠI:
- deploy/nginx/app.conf + deploy/nginx/security-headers.conf (việc 4.8): đã có nosniff,
  X-Frame-Options SAMEORIGIN, Referrer-Policy, COOP, Permissions-Policy và CSP đầy đủ
  (script-src có 'unsafe-inline'/'unsafe-eval' vì app.js dùng onclick nội tuyến và Alpine;
  frame-src https: vì modal app nhúng iframe). Việc 8.5 chỉ còn THÊM HSTS khi đã có HTTPS —
  đừng siết CSP làm trắng trang. Có test server/tests/unit/nginx-static.test.js.
- deploy/docker-compose.dev.yml (Postgres dev) và deploy/.env.example. Việc 8.2 là
  docker-compose.yml BẢN CHẠY THẬT (app + db + nginx + certbot, db KHÔNG publish port).
- server/src/services/cron.js (khung cron có cờ CRON_ENABLED) — backup 02:00 nên đi bằng
  cron của HOST/container chứ đừng nhồi vào tiến trình Node nếu §8.7 không đòi.
- /healthz đã có (Dockerfile HEALTHCHECK gọi vào đó).
- server/src/config/env.js nạp deploy/.env bằng process.loadEnvFile TRỪ KHI NODE_ENV=production
  — bản production đọc biến môi trường thật, đừng phá quy ước đó.

VIỆC CỦA SESSION NÀY: Phase 8 theo §7, 11 việc 8.1–8.11:
- 8.1 Dockerfile multi-stage node:24-alpine, chạy user không phải root, HEALTHCHECK /healthz.
- 8.2 docker-compose.yml 4 service app/db/nginx/certbot, db không publish port, volume pgdata.
- 8.3 Nginx bản chạy thật: reverse proxy, gzip, client_max_body_size 10m, timeout, phục vụ web/.
- 8.4 HTTPS Let's Encrypt qua certbot + tự gia hạn + chuyển hướng 80→443 (chờ tên miền: viết
  cấu hình và runbook, ghi rõ chưa xin được chứng thư).
- 8.5 Header bảo mật: thêm HSTS (chỉ khi có HTTPS), giữ nguyên phần đã có.
- 8.6 Bí mật: .env chmod 600 không vào git; deploy/.env.example đủ mẫu; mật khẩu Postgres
  sinh ngẫu nhiên ≥32 ký tự (kèm lệnh sinh trong runbook).
- 8.7 backup.sh: pg_dump -Fc mỗi ngày 02:00, giữ 14 bản, nén, ghi log.
- 8.8 restore.sh + THỬ PHỤC HỒI THẬT vào CSDL rỗng trên máy dev, ghi lại mất bao lâu.
- 8.9 Nhật ký: pino ra stdout + xoay vòng log Docker (max-size=10m, max-file=5).
- 8.10 Tường lửa: ufw chỉ 22/80/443, fail2ban cho SSH, SSH chỉ khoá — viết vào runbook,
  không chạy được trên máy dev Windows.
- 8.11 deploy/runbook.md: dựng mới, lên bản mới, lùi bản, phục hồi CSDL, 5 sự cố thường gặp.

KHÔNG LÀM:
- Đừng commit deploy/.env (mật khẩu thật) hay data/* (ảnh chụp có tên, email, mật khẩu thô).
  Không git add . — luôn nêu đường dẫn rõ.
- Đừng đổi hình dạng phản hồi của cầu RPC hay bỏ tên nào trong 37 tên. Đừng nới quyền §6.
- Đừng làm nút Duyệt/Từ chối trên cây (D3–D8 UI) và chuông thông báo — trừ khi người dùng
  yêu cầu trong session (§13.4 mục 16 đang chờ trả lời).
- Đừng thêm thư viện mới ngoài §3.3 mà không cập nhật §3.3.

XONG KHI: 1255 test cũ vẫn xanh · có test cho phần kiểm được bằng máy (Dockerfile/compose
hợp lệ, header, script sao lưu) · `docker compose config` sạch và `nginx -t` sạch (chạy trong
container) · dựng được bằng docker compose trên máy dev rồi `down && up -d` không mất dữ liệu ·
thử restore.sh vào CSDL rỗng thành công có ghi thời gian · lint + format:check sạch ·
runbook đủ 5 sự cố · phần chờ VPS thật ghi rõ ở §13.2/§13.4. Đừng báo "xong" khi còn điểm đỏ.

Viết test song song với code, chạy ngay sau mỗi việc (`cd server && npm test`), không dồn
đến cuối phase.

CUỐI SESSION, bắt buộc trước khi tổng kết: cập nhật §13.2, thêm 1 dòng vào §13.3 (KHÔNG sửa
dòng cũ — dùng dòng trắng trước "### 13.4" làm mốc chèn), bổ sung §13.4 nếu có câu cần tôi
trả lời, bổ sung §13.5 nếu phát hiện bẫy mới. Nếu thiết kế đổi thì sửa luôn mục gốc
(§4/§5/§6/§7), không chỉ ghi ở §13. Cập nhật mục 1 và mục 3 của docs/BAT-DAU-SESSION.md —
mục 3 lần sau là prompt cho Phase 9 (nghiệm thu, chạy song song, cắt chuyển; §7 Phase 9;
28 dòng thật nhập tay qua giao diện web). Commit theo từng việc nhỏ, thông điệp có mã phase
(phase-8: ...). Không dùng git add .

Trả lời tiếng Việt.
```

---

## 4. Lệnh chạy môi trường dev — chạy đúng thứ tự này

Lần đầu trên một máy mới:

```bash
cp deploy/.env.example deploy/.env     # rồi SỬA mật khẩu và SESSION_SECRET trong deploy/.env
cd server && npm install               # tools/ có node_modules riêng: cd tools && npm install
```

Mỗi lần bắt đầu làm việc:

```bash
# 1. Bật CSDL (db 5432, db-test 5434, adminer http://127.0.0.1:8080)
docker compose -f deploy/docker-compose.dev.yml up -d
docker compose -f deploy/docker-compose.dev.yml ps      # cả 3 phải "healthy"/"running"

# 2. Tạo/cập nhật bảng
cd server && npm run migrate:up

# 3. Kiểm mọi thứ còn xanh TRƯỚC KHI sửa gì — LUÔN chạy từ trong server/, không từ gốc repo
cd server && npm test    # phải 835/835 xanh trong 44 file (hết Phase 0–5)
npm run lint && npm run format:check

# 4. Chạy máy chủ khi cần thử tay
npm run dev       # http://127.0.0.1:3000/healthz

# 5. Nạp dữ liệu mẫu §8.3 — CHỈ vào CSDL dev, chạy lại nhiều lần không nhân đôi
npm run seed:dev  # 13 tài khoản TEST001..TEST013, mật khẩu Test@12345, đều bị bắt đổi lần đầu
```

Lệnh hay cần:

```bash
npm run migrate:down          # lùi 1 migration
npm run migrate:redo          # lùi rồi chạy lại migration cuối
npm run test:watch            # chạy test liên tục khi đang viết
npm run coverage              # ngưỡng 70%
MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/deploy/nginx/app.conf:/etc/nginx/conf.d/app.conf:ro" \
  -v "$PWD/deploy/nginx/security-headers.conf:/etc/nginx/snippets/security-headers.conf:ro" \
  nginx:1.27-alpine nginx -t                               # kiểm cú pháp Nginx (§7 việc 4.8)
docker compose -f deploy/docker-compose.dev.yml down       # tắt, GIỮ dữ liệu dev
docker compose -f deploy/docker-compose.dev.yml down -v    # tắt và XOÁ SẠCH dữ liệu dev
```

Dựng Nginx thật để chạy lượt khói §8.5 (đã dùng ở Phase 4, cổng 8099):

```bash
# 0. Máy chủ Node chạy trên máy thật (cổng 3000), CSDL riêng để không chạm dữ liệu dev:
docker exec -i qlcv-dev-db psql -U qlcv -d postgres -c 'CREATE DATABASE quanlycongviec_uat'
cd server && DATABASE_URL=postgres://qlcv:<mk>@127.0.0.1:5432/quanlycongviec_uat npm run migrate:up
cd server && DATABASE_URL=postgres://qlcv:<mk>@127.0.0.1:5432/quanlycongviec_uat npm run seed:dev
cd server && DATABASE_URL=postgres://qlcv:<mk>@127.0.0.1:5432/quanlycongviec_uat npm run dev

# 1. Mạng riêng + CẦU tới máy thật. Nginx dùng resolver Docker nên nó BỎ QUA /etc/hosts:
#    --add-host app:host-gateway KHÔNG có tác dụng, phải có một container TÊN là app.
docker network create qlcv-uat
docker run -d --name app --network qlcv-uat alpine/socat \
  tcp-listen:3000,fork,reuseaddr tcp-connect:host.docker.internal:3000

# 2. Nginx phục vụ web/ và chuyển /api sang container app.
#    MSYS_NO_PATHCONV=1 là BẮT BUỘC trên Git Bash: không có nó, Git Bash đổi "/etc/nginx/..."
#    thành "C:/Program Files/Git/etc/nginx/..." nên app.conf KHÔNG được nạp — nginx chạy bằng
#    default.conf của image, / trả 200 nhưng /api/* và /assets/vendor/* đều 404.
#    Đích của web/ phải là /srv/web — đúng dòng `root` trong deploy/nginx/app.conf.
MSYS_NO_PATHCONV=1 docker run -d --name qlcv-uat-nginx --network qlcv-uat -p 127.0.0.1:8099:80 \
  -v "$PWD/deploy/nginx/app.conf:/etc/nginx/conf.d/app.conf:ro" \
  -v "$PWD/deploy/nginx/security-headers.conf:/etc/nginx/snippets/security-headers.conf:ro" \
  -v "$PWD/web:/srv/web:ro" nginx:1.27-alpine

# 2b. Kiểm nhanh là app.conf ĐÃ được nạp (thiếu bước này thì bước 3 báo lỗi rất khó hiểu)
MSYS_NO_PATHCONV=1 docker exec qlcv-uat-nginx ls /etc/nginx/conf.d/   # phải thấy app.conf
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8099/api/csrf   # phải 200, không phải 404

# 3. Chạy lượt khói (in mã HTTP từng điểm, tự dọn dòng nó tạo)
bash tools/smoke-8.5.sh            # hoặc BASE=http://127.0.0.1:3000 bash tools/smoke-8.5.sh

# 4. Dọn
docker rm -f qlcv-uat-nginx app && docker network rm qlcv-uat
```

`down -v` xoá volume `db-data` — mất toàn bộ dữ liệu dev. Chỉ dùng khi thật sự muốn làm lại từ đầu.

---

## 5. Lưu ý bắt buộc — đọc trước khi viết dòng code đầu tiên

**Về ngữ cảnh AI** (tiết kiệm được cả session):

- Không đọc tràn `Code.gs.moi` và `js.clean.html`. Chỉ `Grep` đúng tên hàm cần port.
- Làm **một phase một lần**. Đang dở phase thì không nhảy sang phase khác.
- Viết file dài theo khối ≤ 50 dòng. Chạy test ngay sau mỗi hàm, không dồn đến cuối.
- Việc quét rộng (tìm mọi chỗ gọi một hàm) thì giao subagent, chỉ nhận kết luận.

**Về bảo mật — không được commit:**

- `deploy/.env` (mật khẩu thật) và `data/*` (snapshot chứa tên, email, **mật khẩu văn bản
  thuần** của người dùng thật). `.gitignore` đã chặn; đừng dùng `git add .`, hãy `git add`
  từng file. Kiểm nhanh: `git check-ignore -v deploy/.env data/snapshot-x.json`.
- Test **không** được đọc snapshot thật — dùng dữ liệu mẫu `dev.sql` hoặc fixture riêng ở
  `server/tests/fixtures/`. Không log mật khẩu, kể cả mật khẩu mẫu.
- Nhánh `main` không commit trực tiếp. Mỗi phase một nhánh `vps/phase-N-<tên>`.
- Trong repo còn `Code.gs.moi`, `HUONG-DAN-BAO-TRI.md`, `KE-HOACH-PHAT-TRIEN.md`,
  `tools/test-tasks-gd2.js`, `file tai xuong tu google sheet.xlsx` đang sửa dở / chưa theo dõi
  từ trước — **đừng stage kèm**. Riêng `web/` **đã là thư mục thật của frontend** từ Phase 4
  (`index.html`, `assets/js/{app.js,api-bridge.js}`, `assets/css/app.css`, `assets/vendor/**`);
  vẫn `git add` từng file — đừng `git add web/` khi trong đó có bản tải về của
  thư viện ngoài chưa kiểm.

**Bẫy riêng của máy này** (đã mất thời gian một lần, xem §13.5 của kế hoạch):

| Hiện tượng | Nguyên nhân thật | Cách làm đúng |
|---|---|---|
| `spawnSync npx.cmd EINVAL` | Node ≥20 trên Windows chặn spawn file `.cmd` | gọi `process.execPath` + `node_modules/<pkg>/bin/*.js` |
| Gói cài "thành công" nhưng thiếu file `.node` | npm ở máy này chặn install script (`allowScripts`) | dùng gói có sẵn bản biên dịch, ví dụ `@node-rs/bcrypt` thay `bcrypt` |
| `docker compose up` báo "port is already allocated" | cổng 5433 đã bị Postgres của dự án khác chiếm | CSDL test dùng **5434**, khai qua biến trong `deploy/.env` |
| Cả bộ test chết bằng `process.exit(1)` không nói lý do | `env.js` từ chối một biến mà `vitest.config.js` truyền vào | đọc stderr của worker; giữ enum trong `env.js` khớp với `vitest.config.js` |
| Test xoá mất dữ liệu dev | tưởng `process.loadEnvFile()` ghi đè `process.env` — **không** ghi đè | đã có 2 lớp chặn: `vitest.config.js` dừng nếu `DATABASE_URL === TEST_DATABASE_URL`; `global-setup.js` chỉ xoá CSDL có hậu tố `_test` |
| ~~`dump-sheets.js` báo "thiếu sheet Dự án/Nhiệm vụ"~~ (công cụ đã bỏ 2026-08-25) | `.xlsx` cấm dấu `/` trong tên sheet ⇒ bản tải về bị đổi thành `Dự ánNhiệm vụ` | vẫn đúng khi **mở tay** file `.xlsx`: đừng tìm sheet có dấu `/` |
| Tạo công việc đầu tiên bằng API đổ vì trùng `UNIQUE` trên `code` | dữ liệu mẫu chèn bằng mã **viết cứng** nên 6 sequence vẫn ở 1 | `dev.sql` kết thúc bằng 6 câu `setval(seq, GREATEST(last_value, n))`; thêm dòng mới vào seed thì **nhớ nâng số** |
| `seed:dev` chạy lần 2 làm số liệu phồng lên | 4 bảng không có cột `code` (`reminders`, `chat_messages`, `notifications`, `activity_logs`) nên `ON CONFLICT` không dùng được | dùng `INSERT … SELECT … WHERE NOT EXISTS` với khoá tự chọn — xem cuối `dev.sql` |
| Test một chốt an toàn làm **cả vitest thoát** giữa lúc chạy | chốt kết thúc bằng `process.exit(1)`, gọi trong tiến trình test là giết luôn runner | chạy bằng `spawnSync(process.execPath, [run.js])` như `tests/integration/seed-guard.test.js` |
| Seed hoặc test đỏ ở chỗ trông như lỗi SQL sau khi sửa `001_init.sql` | CSDL dev vẫn giữ lược đồ cũ | `npm run migrate:redo` mỗi khi đụng vào migration |
| Test so mốc thời gian đỏ ngẫu nhiên (`15.000016…` > 15) | mốc lấy từ `now()` của Postgres, so bằng `Date.now()` của máy — hai đồng hồ lệch vài chục ms | so bằng khoảng (`> 13 && < 16`), đừng so `<=` đúng biên |
| Test ghi nhật ký đọc `activity_logs` ra 0 dòng | `audit.js` ghi ở sự kiện `finish` của response, tức SAU khi supertest đã nhận xong | chờ bằng vòng lặp `waitForLogs()` như `tests/integration/auth-password.test.js` |
| Đăng nhập đúng nhưng mọi API sau đó trả 403 `MUST_CHANGE_PASSWORD`, kể cả API đổi mật khẩu | `requirePasswordChanged` mắc TRƯỚC router `/v1/auth` ⇒ khoá luôn đường thoát | giữ đúng thứ tự khai trong `app.js`: `api.use('/v1/auth', authRouter)` rồi mới `api.use(requirePasswordChanged)` |
| Mật khẩu dài hơn 72 byte vẫn "đúng" khi gõ thiếu ký tự cuối | bcrypt cắt cụt sau 72 **byte** (tiếng Việt có dấu ≈ 3 byte/ký tự) | `password.js` từ chối thẳng nếu `Buffer.byteLength(pw) > 72` |
| Frontend không gửi được token CSRF | cookie CSRF bị đặt `httpOnly` ⇒ JavaScript không đọc nổi | cookie `csrf` **không** httpOnly (chỉ cookie `sid` mới httpOnly) |
| Test đỏ hàng loạt 401, log in ra `RUN v4.1.11 E:/quanlycongviec` | gọi `npx vitest` từ **gốc repo** ⇒ chạy vitest@4 của thư mục gốc, không có `globalSetup` nên CSDL test chưa dựng | luôn `cd server` trước mọi lệnh `npm`/`npx`; kiểm dòng `RUN v2.1.8 E:/quanlycongviec/server` ở đầu output |
| `api.delete is not a function` | helper HTTP ở `tests/helpers/http.js` đặt tên là **`del`** (`delete` là từ khoá) | dùng `api.del(url)` |
| `ECONNRESET` khi test đồng thời (TC-TREE-31) | 20 request cùng lúc, mỗi request tự đi lấy token CSRF ⇒ 40 kết nối, supertest dựng server mới mỗi lần | lấy token **một lần** rồi dùng lại cho cả 20 request |
| Tiếng Việt gửi bằng `curl -d '…'` hoặc `psql -c '…'` vào CSDL thành `U+FFFD` (`KH?I 8.5`) | Git Bash chuyển **argv** sang codepage console trước khi trao cho `.exe`; hệ thống lưu luôn bản đã hỏng | đưa mọi thân JSON và mọi câu SQL qua **stdin**: `printf '%s' "$body" \| curl … --data-binary @-`, `printf '%s' "$sql" \| docker exec -i qlcv-dev-db psql …` |
| Nginx trong Docker trả 502 dù `--add-host app:host-gateway` | `resolver 127.0.0.11` phân giải qua DNS Docker, **bỏ qua `/etc/hosts`** | chạy một container **tên `app`** làm cầu: `alpine/socat tcp-listen:3000,fork,reuseaddr tcp-connect:host.docker.internal:3000` (xem mục 4) |
| `npm run seed:dev` đỏ với «Cha phải là công việc con (cấp 2)» | CSDL đã có dòng tay cùng `code` nhưng khác `level`; `ON CONFLICT (code) DO UPDATE` **không** sửa được `level` | xoá dòng tay, hoặc seed sang CSDL khác bằng `DATABASE_URL=…` trên dòng lệnh (biến dòng lệnh thắng `loadEnvFile()`) |
| `array_length(...) does not exist` khi kiểm link kết quả bằng SQL | `work_items.result_links` là **jsonb**, không phải mảng text | `jsonb_array_length(result_links)` |
| `column "revoked_at" does not exist` khi thử phiên hết hạn | bảng `sessions` không có cột đó | đẩy `expires_at` về quá khứ: `UPDATE sessions SET expires_at = now() - interval '1 hour'` |
| `npm run …` báo `Could not read package.json` | đứng ở **gốc repo**, `package.json` nằm trong `server/` | `cd server` trước mọi lệnh npm (kể cả `lint`, `format:check`) |
| Khói T1–T10 500 `INTERNAL` dù code bootstrap đã có | CSDL `quanlycongviec_uat` đứng ở migration cũ (thiếu `v_countable_*`) — `npm run migrate:up` mặc định vào **dev** | `DATABASE_URL=postgres://qlcv:<mk>@127.0.0.1:5432/quanlycongviec_uat npm run migrate:up` mỗi khi thêm migration |
| XSS-guard đỏ vì helper tên `add*Html` dù đã escape | `BUILDER` chỉ nhận `create`/`build`/`render`/`wrap`/`describe`/`linkify`/`get*Html` | đặt tên `create*Html`; đừng nhét vào danh sách trắng cho hết đỏ |
| Test jsdom mới `no-undef window` | `eslint.config.js` khai globals bằng danh sách trắng từng file | thêm file vào khối jsdom (như `pending-badge` / `subwork-button-ui`) |

**Quy ước code đã chốt** (giữ nguyên, đừng đổi giữa đường):

- ESM (`import`), Node ≥ 24. `server/` là ESM, `tools/` là CommonJS với `node_modules` riêng.
- SQL viết tay, **tham số hoá 100%**, không nối chuỗi. Không ORM.
- Ngày kiểu `date` trả về **chuỗi `YYYY-MM-DD`** (đã đặt type parser ở `pool.js`) — đừng
  `new Date()` rồi format lại, đó là đường dẫn tới lỗi lệch một ngày.
- Log đi qua `src/utils/logger.js`, không `console.log` (ESLint cảnh báo).
- Lỗi trả về **đúng §5.3**: thành công `{ ok: true, data }` · thất bại
  `{ ok: false, error: { code, message, field?, traceId? } }`. Không lộ stack. Đừng dùng
  `{ success: false }` — dạng đó đã bị xoá khỏi `app.js` ở Phase 1.
- Ném lỗi bằng `new AppError(code, message, …)` trong `src/utils/errors.js`; mã HTTP do bảng
  `ERROR_STATUS` quyết định, đừng `res.status()` rải rác.
- `eslint.config.js` khai `globals` bằng **danh sách trắng viết tay** (process, console,
  setTimeout, URL, Buffer). Dùng global mới thì phải thêm vào đó, nếu không lint đỏ.
- Comment và thông báo lỗi cho người dùng viết **tiếng Việt**.
- **Từ vựng (§0.1)**: cấp 1 = **công việc** (`works`, mã `CV0xx`), cấp 2 = **công việc con**,
  cấp 3 = **nhiệm vụ** (cả hai ở `work_items`). Vai trò là `Quản lý công việc`. **Không** viết
  "dự án" trong code, comment hay giao diện — trừ khi đang nhắc **tên thật** của sheet/cột
  Google Sheets (`Dự án/Nhiệm vụ`, `Mã dự án`) hoặc mã cũ `DA0xx`.
- Mọi hàm ghi chạy trong `withTransaction()`.

---

## 6. Checklist cuối session — làm trước khi tổng kết

1. `npm test` xanh, `npm run lint` và `npm run format:check` sạch.
2. `KE-HOACH-VPS.md`: cập nhật §13.2 · thêm **1 dòng** vào §13.3 (không sửa dòng cũ) ·
   §13.4 nếu có câu cần người dùng trả lời · §13.5 nếu có bẫy mới.
3. Thiết kế đổi thì sửa **mục gốc** (§2/§3/§4/§5/§6/§7), không chỉ ghi ở §13.
4. Cập nhật **mục 1** của file này (đang ở đâu) và mục 3 (prompt cho phase kế tiếp).
5. Chạy lại bộ khói nếu phase vừa làm mở thêm điểm §8.5:
   `"C:\Program Files\Git\bin\bash.exe" tools/smoke-8.5.sh` **từ gốc repo** (`bash` trần là WSL),
   rồi cập nhật phần "Checklist khói §8.5" trong `docs/UAT.md` (nêu tên điểm đỏ, đừng chỉ đổi
   con số) và bảng "Ghi chú nghiệm thu" ở cuối file.
6. Commit từng việc nhỏ, thông điệp có mã phase. Không `git add .`.



