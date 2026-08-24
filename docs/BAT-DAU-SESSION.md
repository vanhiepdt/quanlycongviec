# Bắt đầu một session mới — dán prompt, chạy, không phải nhớ gì

File này để **mở một session AI mới** mà không mất thời gian dò lại dự án đang ở đâu. Nguồn sự
thật về tiến độ vẫn là **§13 của `KE-HOACH-VPS.md`**; file này chỉ là bàn đạp.

Thứ tự dùng: đọc mục 1 (đang ở đâu) → copy prompt ở mục 2 hoặc 3 → dán vào session mới.

---

## 1. Đang ở đâu (cập nhật mỗi khi xong một phase)

| | |
|---|---|
| Nhánh đang làm | `vps/phase-1-auth` (tách từ `vps/phase-0-setup`) |
| Phase đã xong | **0** và **1** trọn vẹn (Phase 1: 12/12 việc — xác thực, phiên, CSRF, RBAC, nhật ký, giới hạn tần suất, dữ liệu mẫu) |
| Test đang xanh | **299** (243 của Phase 0 + 2 việc đầu Phase 1, cộng 56 mới: 6 password, 7 cookie, 4 rateLimit, 11 login, 13 phiên/CSRF, 9 đổi mật khẩu + nhật ký, 6 seed) |
| Phase kế tiếp | **2 — nhập dữ liệu từ Google Sheets** (§7 Phase 2 + §8.4 nhóm TC-IMP) |
| Còn treo | Gắn `loginRateLimiter` cho `/api/rpc/authenticateUser` — đường dẫn đó chỉ có từ **Phase 4** (đã ghi chú trong `src/app.js`). Nợ từ Phase 0: chạy `dump-sheets.js` trên `.xlsx` thật (§13.4 mục 5) |
| Đang chờ người dùng | §13.4 mục 8 (nhiệm vụ cũ nhập thành cấp 2 hay cấp 3 — **không chặn**, mặc định cấp 2) và mục 9 (sheet `Thông báo` không tồn tại — không chặn) |
| Đã có dữ liệu thật | `file tai xuong tu google sheet.xlsx` → `data/snapshot-20260824.json` (5 người dùng, 4 phòng, 2 công việc, 1 đề nghị, 1 chat). Số liệu chi tiết ở §13.8 — **đọc trước khi viết công cụ nhập** |
| Tài khoản thử tay | `npm run seed:dev` → 10 tài khoản `TEST001..TEST010` (§13.7), mật khẩu `Test@12345`, tất cả bị bắt đổi ở lần đăng nhập đầu |

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

## 3. Prompt cho session tiếp theo — Phase 2 (nhập dữ liệu), dán nguyên khối

```text
Dự án e:\quanlycongviec — chuyển hệ quản lý công việc từ Google Apps Script + Google Sheets
sang VPS (Node 24 + Express 5 + PostgreSQL 16 + Docker). Kế hoạch đầy đủ ở KE-HOACH-VPS.md.

TRƯỚC KHI LÀM BẤT CỨ VIỆC GÌ:
1. Đọc §13 của KE-HOACH-VPS.md — nguồn sự thật về việc đang làm đến đâu. Đọc KỸ §13.8 (số
   liệu snapshot thật) và §13.4 mục 5–9 (những gì đã chốt về dữ liệu).
2. Làm theo §13.1. Xem §13.5 (bẫy đã biết) — đừng phát hiện lại từ đầu.
3. Đọc §7 Phase 2 (7 việc 2.1–2.7), §8.4 nhóm TC-IMP-01..14, §4.3 (bảng đối chiếu cột
   Sheets → CSDL) và các bảng ở §4.1 sẽ nhập. Không đọc cả §7, không đọc cả §8.
4. Đọc docs/BAT-DAU-SESSION.md mục 4 và 5 (lệnh chạy + bẫy của máy này + quy ước code).
5. Đọc data/snapshot-20260824.report.txt và phần bảng liên quan của
   server/src/db/migrations/001_init.sql trước khi viết dòng code đầu tiên.

KHÔNG đọc tràn Code.gs.moi (3645 dòng) và js.clean.html (3653 dòng) — Phase 2 gần như không
cần hai file này; cần gì thì Grep đúng tên cột/hàm. Cũng KHÔNG đọc tràn
data/snapshot-20260824.json — viết node đọc từng khoá và in vài dòng mẫu.

TRẠNG THÁI: Phase 0 và Phase 1 đã xong trọn vẹn (12/12 việc mỗi phase); 299 test xanh; nhánh
vps/phase-1-auth.
ĐÃ CÓ SẴN, ĐỪNG LÀM LẠI: src/config/env.js (14 biến, zod), src/db/pool.js (withTransaction,
DATE trả về chuỗi YYYY-MM-DD), src/app.js (đã nối đủ attachSession → issueCsrfCookie →
verifyCsrf → audit → /v1/auth → requirePasswordChanged), src/utils/logger.js,
src/utils/errors.js (AppError + ERROR_STATUS), src/middleware/errorHandler.js (ok/
notFoundHandler/errorHandler), migration 001_init.sql (12 bảng, 6 sequence + next_code(),
3 trigger), src/modules/users/repo.js, src/modules/departments/repo.js,
src/middleware/rbac.js, src/middleware/{session,csrf,validate,rateLimit,audit}.js,
src/modules/auth/{password,cookies,service,repo,routes}.js, src/db/seeds/{dev.sql,run.js},
tests/global-setup.js, tests/helpers/{db,rbac,http}.js, tools/dump-sheets.js.
Gói @node-rs/bcrypt đã có trong package.json.
QUAN TRỌNG: src/modules/auth/password.js ĐÃ TỒN TẠI (hashPassword/verifyPassword,
@node-rs/bcrypt cost 12, chặn mật khẩu > 72 byte). Công cụ nhập phải `import` lại đúng hàm
đó, KHÔNG tự băm và KHÔNG viết file mới. Nhật ký ghi qua src/middleware/audit.js (nó ghi ở
sự kiện `finish` của response — test phải chờ, xem §13.5).

VIỆC CỦA SESSION NÀY: làm trọn Phase 2 trên nhánh mới vps/phase-2-import (tách từ
vps/phase-1-auth). Theo đúng §7 Phase 2:
- tools/import-from-sheets.js đọc data/snapshot-*.json, nhập theo thứ tự: departments →
  users → department_managers → works → work_items (2 lượt) → reminders → proposals →
  apps → chat_messages → notifications → activity_logs
- chạy lại không hỏng: INSERT ... ON CONFLICT (code) DO UPDATE; lần 2 phải ghi 0 dòng mới
- --dry-run: chỉ in báo cáo, không ghi một dòng nào vào CSDL
- nối cha–con 2 lượt: lượt 1 chèn hết work_items, lượt 2 UPDATE parent_id theo Mã cha; cha
  không tồn tại ⇒ parent_id = NULL + ghi vào báo cáo, KHÔNG bỏ mất dòng
- dùng lại src/modules/auth/password.js đã có (hashPassword bằng @node-rs/bcrypt cost 12) —
  đừng băm trực tiếp trong công cụ nhập, đừng tạo lại file đó
- dò Họ tên → user_id: trùng tên hoặc không tìm thấy ⇒ NULL, giữ *_name, in vào báo cáo
- báo cáo đối chiếu data/import-report.txt: mỗi thực thể — số dòng ở Sheets / đã nhập / bỏ
  qua / lý do

SỰ THẬT VỀ DỮ LIỆU (§13.8) — xử lý đúng và có test cho từng cái:
- Sheet "Dự án/Nhiệm vụ" trong .xlsx mang tên "Dự ánNhiệm vụ" (Google xoá hẳn dấu /). Sheet
  "Thông báo" KHÔNG tồn tại ⇒ nhập 0 dòng, không được báo lỗi "thiếu sheet bắt buộc".
- Cột Phân quyền thật có giá trị "Admin" (chữ A hoa) — không khớp CHECK users_role_valid.
  Phải chuẩn hoá hoa/thường và IN RA từng dòng đã đổi. Giá trị lạ ngoài danh sách §6 thì
  KHÔNG tự đoán, in ra để sửa tay (TC-IMP-11).
- Cột Phòng của người dùng ghi TÊN phòng ("Quản lý Đào tạo"), không phải mã ⇒ dò sang
  departments.name. Một người thuộc MỘT phòng (đã chốt §13.4 mục 1, giữ users.department_id).
- 2 trong 5 người dùng có mật khẩu RỖNG ⇒ sinh mật khẩu tạm ngẫu nhiên,
  must_change_password = true, ghi danh sách ra data/import-temp-passwords.txt (KHÔNG commit,
  KHÔNG in ra log). Tuyệt đối không để tài khoản không mật khẩu.
- Mã người dùng có lỗ (NV001, NV004, NV005, NV006, NV007) — đừng suy ra mã liên tục.
- Cột Trạng thái duyệt của DA001 và DA002 rỗng ⇒ gán 'Đã duyệt' (dữ liệu cũ đang dùng, không
  thể bắt đi duyệt lại).
- Ô Nhiệm vụ JSON thật KHÔNG có khoá Cấp và Mã cha ⇒ theo §13.4 mục 8 nhập thành CẤP 2
  (công việc con). Ghi rõ quyết định này vào báo cáo nhập.
- Ngày: pool.js đã trả date dạng chuỗi YYYY-MM-DD. Test riêng 3 mốc 01/01, 31/12, 29/02; ô
  ngày rỗng phải thành NULL, không thành 30/12/1899 (TC-IMP-08..10).
- Ô Nhiệm vụ JSON có thể hỏng: đếm và liệt kê, các công việc khác vẫn nhập đủ (TC-IMP-03).

BẢO MẬT: data/* KHÔNG commit (chứa email và mật khẩu văn bản thuần của người thật). Test
KHÔNG dùng snapshot thật — tạo fixture riêng ở server/tests/fixtures/. Không log mật khẩu.

Viết test song song với code, chạy ngay sau mỗi hàm, không dồn đến cuối. XONG KHI: 14 test
TC-IMP-01..14 xanh + 299 test cũ vẫn xanh · chạy thật trên snapshot vào CSDL dev khớp 100% số
dòng · chạy lần 2 ghi 0 dòng mới · đối chiếu tay 10 mẫu (2 công việc, 5 nhiệm vụ, 2 người
dùng, 1 đề nghị) khớp từng trường · lint + format:check sạch.

CUỐI SESSION, bắt buộc trước khi tổng kết: cập nhật §13.2, thêm 1 dòng vào §13.3 (không sửa
dòng cũ), bổ sung §13.4 nếu có câu cần tôi trả lời, bổ sung §13.5 nếu phát hiện bẫy mới.
Nếu thiết kế đổi thì sửa luôn mục gốc (§4/§5/§7), không chỉ ghi ở §13. Cập nhật mục 1 và mục
3 của docs/BAT-DAU-SESSION.md — mục 3 lần sau là prompt cho Phase 3 (API nghiệp vụ: công
việc, công việc con, nhiệm vụ, đề nghị — §7 Phase 3 + §8.4 nhóm TC-WORK/TC-PROP).
Commit theo từng việc nhỏ, thông điệp có mã phase (phase-2: ...). Không dùng git add .

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
npm test          # phải 299/299 xanh (hết Phase 0 + Phase 1)
npm run lint && npm run format:check

# 4. Chạy máy chủ khi cần thử tay
npm run dev       # http://127.0.0.1:3000/healthz

# 5. Nạp 10 tài khoản thử tay TEST001..TEST010 (§13.7) — chỉ vào CSDL dev
npm run seed:dev  # mật khẩu Test@12345, tất cả bị bắt đổi ở lần đăng nhập đầu
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
  thuần** của người dùng thật; `data/import-temp-passwords.txt` chứa mật khẩu tạm sinh khi
  nhập). `.gitignore` đã chặn; đừng dùng `git add .`, hãy `git add` từng file. Kiểm nhanh:
  `git check-ignore -v deploy/.env data/snapshot-x.json`.
- Nhánh `main` không commit trực tiếp. Mỗi phase một nhánh `vps/phase-N-<tên>`.
- Trong repo còn `Code.gs.moi`, `HUONG-DAN-BAO-TRI.md`, `KE-HOACH-PHAT-TRIEN.md`,
  `tools/test-tasks-gd2.js`, `web/`, `file tai xuong tu google sheet.xlsx` đang sửa dở /
  chưa theo dõi từ trước — **đừng stage kèm**.

**Bẫy riêng của máy này** (đã mất thời gian một lần, xem §13.5 của kế hoạch):

| Hiện tượng | Nguyên nhân thật | Cách làm đúng |
|---|---|---|
| `spawnSync npx.cmd EINVAL` | Node ≥20 trên Windows chặn spawn file `.cmd` | gọi `process.execPath` + `node_modules/<pkg>/bin/*.js` |
| Gói cài "thành công" nhưng thiếu file `.node` | npm ở máy này chặn install script (`allowScripts`) | dùng gói có sẵn bản biên dịch, ví dụ `@node-rs/bcrypt` thay `bcrypt` |
| `docker compose up` báo "port is already allocated" | cổng 5433 đã bị Postgres của dự án khác chiếm | CSDL test dùng **5434**, khai qua biến trong `deploy/.env` |
| Cả bộ test chết bằng `process.exit(1)` không nói lý do | `env.js` từ chối một biến mà `vitest.config.js` truyền vào | đọc stderr của worker; giữ enum trong `env.js` khớp với `vitest.config.js` |
| Test xoá mất dữ liệu dev | tưởng `process.loadEnvFile()` ghi đè `process.env` — **không** ghi đè | đã có 2 lớp chặn: `vitest.config.js` dừng nếu `DATABASE_URL === TEST_DATABASE_URL`; `global-setup.js` chỉ xoá CSDL có hậu tố `_test` |
| Công cụ nhập báo "thiếu sheet Dự án/Nhiệm vụ" | `.xlsx` cấm dấu `/` trong tên sheet ⇒ bản tải về bị đổi tên | `dump-sheets.js` khớp theo tên chuẩn hoá, ghi tên thật vào `actual_name` |
| Test so mốc thời gian đỏ ngẫu nhiên (`15.000016…` > 15) | mốc lấy từ `now()` của Postgres, so bằng `Date.now()` của máy — hai đồng hồ lệch vài chục ms | so bằng khoảng (`> 13 && < 16`), đừng so `<=` đúng biên |
| Test ghi nhật ký đọc `activity_logs` ra 0 dòng | `audit.js` ghi ở sự kiện `finish` của response, tức SAU khi supertest đã nhận xong | chờ bằng vòng lặp `waitForLogs()` như `tests/integration/auth-password.test.js` |
| Đăng nhập đúng nhưng mọi API sau đó trả 403 `MUST_CHANGE_PASSWORD`, kể cả API đổi mật khẩu | `requirePasswordChanged` mắc TRƯỚC router `/v1/auth` ⇒ khoá luôn đường thoát | giữ đúng thứ tự khai trong `app.js`: `api.use('/v1/auth', authRouter)` rồi mới `api.use(requirePasswordChanged)` |
| Mật khẩu dài hơn 72 byte vẫn "đúng" khi gõ thiếu ký tự cuối | bcrypt cắt cụt sau 72 **byte** (tiếng Việt có dấu ≈ 3 byte/ký tự) | `password.js` từ chối thẳng nếu `Buffer.byteLength(pw) > 72` |
| Frontend không gửi được token CSRF | cookie CSRF bị đặt `httpOnly` ⇒ JavaScript không đọc nổi | cookie `csrf` **không** httpOnly (chỉ cookie `sid` mới httpOnly) |

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
- Mọi hàm ghi chạy trong `withTransaction()`.

---

## 6. Checklist cuối session — làm trước khi tổng kết

1. `npm test` xanh, `npm run lint` và `npm run format:check` sạch.
2. `KE-HOACH-VPS.md`: cập nhật §13.2 · thêm **1 dòng** vào §13.3 (không sửa dòng cũ) ·
   §13.4 nếu có câu cần người dùng trả lời · §13.5 nếu có bẫy mới.
3. Thiết kế đổi thì sửa **mục gốc** (§2/§3/§4/§5/§6/§7), không chỉ ghi ở §13.
4. Cập nhật **mục 1** của file này (đang ở đâu) và mục 3 (prompt cho phase kế tiếp).
5. Commit từng việc nhỏ, thông điệp có mã phase. Không `git add .`.



