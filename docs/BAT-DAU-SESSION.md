# Bắt đầu một session mới — dán prompt, chạy, không phải nhớ gì

File này để **mở một session AI mới** mà không mất thời gian dò lại dự án đang ở đâu. Nguồn sự
thật về tiến độ vẫn là **§13 của `KE-HOACH-VPS.md`**; file này chỉ là bàn đạp.

Thứ tự dùng: đọc mục 1 (đang ở đâu) → copy prompt ở mục 2 hoặc 3 → dán vào session mới.

---

## 1. Đang ở đâu (cập nhật mỗi khi xong một phase)

| | |
|---|---|
| Nhánh đang làm | `vps/phase-0-setup` (Phase 0 đã xong, 5 commit) |
| Phase đã xong | **0** — bộ xương server, `001_init.sql` (12 bảng + `pgmigrations`), docker dev, `dump-sheets.js`, `docs/UAT.md` |
| Test đang xanh | **28** (18 lược đồ + 6 env + 4 health) |
| Phase kế tiếp | **1** — xác thực, phiên, phân quyền, nhật ký (§7 Phase 1 + §8.4 nhóm A và B) |
| Đang chờ người dùng | §13.4 mục 2, 3, 4, 5, 6, 7 |

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

## 3. Prompt cho session tiếp theo — Phase 1, dán nguyên khối

```text
Dự án e:\quanlycongviec — chuyển hệ quản lý công việc từ Google Apps Script + Google Sheets
sang VPS (Node 24 + Express 5 + PostgreSQL 16 + Docker). Kế hoạch đầy đủ ở KE-HOACH-VPS.md.

TRƯỚC KHI LÀM BẤT CỨ VIỆC GÌ:
1. Đọc §13 của KE-HOACH-VPS.md — nguồn sự thật về việc đang làm đến đâu.
2. Làm theo §13.1. Đặc biệt xem §13.5 (bẫy đã biết) — đừng phát hiện lại từ đầu.
3. Đọc §7 Phase 1 (12 việc 1.1–1.12), §8.4 nhóm A (TC-AUTH-01..15) và nhóm B
   (TC-RBAC-01..10), §6 (ma trận phân quyền), §5.3 (hình dạng lỗi). Không đọc cả §7, cả §8.
4. Đọc docs/BAT-DAU-SESSION.md mục 4 và 5 (lệnh chạy + bẫy của máy này).

KHÔNG đọc tràn Code.gs.moi (3645 dòng) và js.clean.html (3653 dòng) — chỉ Grep tên hàm cần
port (Phase 1 cần: authenticateUser, storeUserSession, getCurrentUser, logout,
changePassword, checkUserPermission, isAdmin, isManager, isDeputyDirector,
isDepartmentHead, logActivity). Đọc tràn hai file này là nguyên nhân cháy ngữ cảnh phổ biến
nhất của dự án này.

TRẠNG THÁI: Phase 0 đã xong trên nhánh vps/phase-0-setup, 28 test xanh. Đã có sẵn và
ĐỪNG LÀM LẠI: src/config/env.js (14 biến, zod, thiếu là chết ngay), src/db/pool.js
(withTransaction, DATE giữ dạng chuỗi), src/app.js (helmet, /healthz, /readyz, 404, error
handler §5.3), src/utils/logger.js (pino, đã che cookie/authorization/password),
migration 001_init.sql (12 bảng, 6 sequence + next_code(), 3 trigger),
tests/global-setup.js + tests/helpers/db.js (resetTables, makeDepartment, makeUser,
makeWork, makeItem). Vì vậy việc 1.1 và 1.12 của §7 Phase 1 coi như xong.

VIỆC CỦA SESSION NÀY: làm trọn Phase 1 trên nhánh mới vps/phase-1-auth (tách từ
vps/phase-0-setup). Theo đúng §7 Phase 1:
- repo users + departments + department_managers, SQL viết tay, tham số hoá 100%
- auth.login: @node-rs/bcrypt cost 12 (§3.3 — KHÔNG dùng gói bcrypt, xem §13.5), khoá tài
  khoản sau 5 lần sai trong 15 phút, thông báo lỗi không phân biệt sai email / sai mật khẩu
- phiên: cookie sid httpOnly + SameSite=Lax + Secure theo env, bảng sessions, hạn 8 giờ,
  tự gia hạn, đăng xuất xoá dòng
- CSRF, rateLimit cho /auth/login, middleware/session.js, middleware/audit.js ghi
  activity_logs, middleware/validate.js (zod)
- middleware/rbac.js: port checkUserPermission theo §6 thành hàm can() THUẦN, không phụ
  thuộc Express. So khớp vai trò CHÍNH XÁC, tuyệt đối không dùng
  String(role).toLowerCase().includes(...) — đó là bẫy "Trợ lý admin" thành admin (§13.5)
- changePassword + bắt đổi mật khẩu lần đầu (403 MUST_CHANGE_PASSWORD)
Viết test song song với code, chạy test ngay sau mỗi hàm, không dồn đến cuối. Xong khi
≥45 test Phase 1 xanh, trong đó ma trận quyền 6 vai × 5 thực thể × 4 hành động sinh tự
động từ MỘT bảng khai báo, cộng với 28 test cũ vẫn xanh.

CUỐI SESSION, bắt buộc trước khi tổng kết: cập nhật §13.2, thêm 1 dòng vào §13.3 (không sửa
dòng cũ), bổ sung §13.4 nếu có câu cần tôi trả lời, bổ sung §13.5 nếu phát hiện bẫy mới.
Nếu thiết kế đổi thì sửa luôn mục gốc (§4/§5/§6), không chỉ ghi ở §13. Cập nhật mục 1 của
docs/BAT-DAU-SESSION.md. Commit theo từng việc nhỏ, thông điệp có mã phase (phase-1: ...).

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

# 3. Kiểm mọi thứ còn xanh TRƯỚC KHI sửa gì
npm test          # phải 28/28 xanh (tính đến hết Phase 0)
npm run lint && npm run format:check

# 4. Chạy máy chủ khi cần thử tay
npm run dev       # http://127.0.0.1:3000/healthz
```

Lệnh hay cần:

```bash
npm run migrate:down          # lùi 1 migration
npm run migrate:redo          # lùi rồi chạy lại migration cuối
npm run test:watch            # chạy test liên tục khi đang viết
npm run coverage              # ngưỡng 70%
node tools/dump-sheets.js <file.xlsx>          # xuất snapshot từ .xlsx tải về
docker compose -f deploy/docker-compose.dev.yml down       # tắt, GIỮ dữ liệu dev
docker compose -f deploy/docker-compose.dev.yml down -v    # tắt và XOÁ SẠCH dữ liệu dev
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
- Nhánh `main` không commit trực tiếp. Mỗi phase một nhánh `vps/phase-N-<tên>`.
- Trong repo còn `Code.gs.moi`, `HUONG-DAN-BAO-TRI.md`, `KE-HOACH-PHAT-TRIEN.md`,
  `tools/test-tasks-gd2.js` đang sửa dở / chưa theo dõi từ trước — **đừng stage kèm**.

**Bẫy riêng của máy này** (đã mất thời gian một lần, xem §13.5 của kế hoạch):

| Hiện tượng | Nguyên nhân thật | Cách làm đúng |
|---|---|---|
| `spawnSync npx.cmd EINVAL` | Node ≥20 trên Windows chặn spawn file `.cmd` | gọi `process.execPath` + `node_modules/<pkg>/bin/*.js` |
| Gói cài "thành công" nhưng thiếu file `.node` | npm ở máy này chặn install script (`allowScripts`) | dùng gói có sẵn bản biên dịch, ví dụ `@node-rs/bcrypt` thay `bcrypt` |
| `docker compose up` báo "port is already allocated" | cổng 5433 đã bị Postgres của dự án khác chiếm | CSDL test dùng **5434**, khai qua biến trong `deploy/.env` |
| Cả bộ test chết bằng `process.exit(1)` không nói lý do | `env.js` từ chối một biến mà `vitest.config.js` truyền vào | đọc stderr của worker; giữ enum trong `env.js` khớp với `vitest.config.js` |
| Test xoá mất dữ liệu dev | tưởng `process.loadEnvFile()` ghi đè `process.env` — **không** ghi đè | đã có 2 lớp chặn: `vitest.config.js` dừng nếu `DATABASE_URL === TEST_DATABASE_URL`; `global-setup.js` chỉ xoá CSDL có hậu tố `_test` |
| Công cụ nhập báo "thiếu sheet Dự án/Nhiệm vụ" | `.xlsx` cấm dấu `/` trong tên sheet ⇒ bản tải về bị đổi tên | `dump-sheets.js` khớp theo tên chuẩn hoá, ghi tên thật vào `actual_name` |

**Quy ước code đã chốt** (giữ nguyên, đừng đổi giữa đường):

- ESM (`import`), Node ≥ 24. `server/` là ESM, `tools/` là CommonJS với `node_modules` riêng.
- SQL viết tay, **tham số hoá 100%**, không nối chuỗi. Không ORM.
- Ngày kiểu `date` trả về **chuỗi `YYYY-MM-DD`** (đã đặt type parser ở `pool.js`) — đừng
  `new Date()` rồi format lại, đó là đường dẫn tới lỗi lệch một ngày.
- Log đi qua `src/utils/logger.js`, không `console.log` (ESLint cảnh báo).
- Lỗi trả về theo §5.3: `{ success: false, error, code, traceId }`, không lộ stack.
- Comment và thông báo lỗi cho người dùng viết **tiếng Việt**.
- Mọi hàm ghi chạy trong `withTransaction()`.

---

## 6. Checklist cuối session — làm trước khi tổng kết

1. `npm test` xanh, `npm run lint` và `npm run format:check` sạch.
2. `KE-HOACH-VPS.md`: cập nhật §13.2 · thêm **1 dòng** vào §13.3 (không sửa dòng cũ) ·
   §13.4 nếu có câu cần người dùng trả lời · §13.5 nếu có bẫy mới.
3. Thiết kế đổi thì sửa **mục gốc** (§2/§3/§4/§5/§6/§7), không chỉ ghi ở §13.
4. Cập nhật **mục 1** của file này (đang ở đâu) và mục 3 (prompt cho phase kế tiếp).
5. Commit từng việc nhỏ, thông điệp có mã phase. Không `git add .`.



