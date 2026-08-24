# Bắt đầu một session mới — dán prompt, chạy, không phải nhớ gì

File này để **mở một session AI mới** mà không mất thời gian dò lại dự án đang ở đâu. Nguồn sự
thật về tiến độ vẫn là **§13 của `KE-HOACH-VPS.md`**; file này chỉ là bàn đạp.

Thứ tự dùng: đọc mục 1 (đang ở đâu) → copy prompt ở mục 2 hoặc 3 → dán vào session mới.

---

## 1. Đang ở đâu (cập nhật mỗi khi xong một phase)

| | |
|---|---|
| Nhánh đang làm | `vps/phase-1-auth` (tách từ `vps/phase-0-setup`) |
| Phase đã xong | **0**, **1** và **2** — Phase 1: 12/12 việc (xác thực, phiên, CSRF, RBAC, nhật ký, giới hạn tần suất) · Phase 2: **đã đổi hướng** sang dữ liệu test tự tạo, `tools/import-from-sheets.js` **bị bỏ hẳn** |
| Test đang xanh | **322** trong 15 file (299 sau Phase 1 + 23 của Phase 2: 21 test `seed-dev` mở rộng + 2 test `seed-guard` chạy bằng tiến trình con) |
| Phase kế tiếp | **3 — API công việc 3 tầng** (§7 Phase 3, 10 việc 3.1–3.10 + §8.4 nhóm **C**, TC-TREE-01..35). Đề nghị / App / Chat / Excel là **Phase 7**, không phải Phase 3 |
| Còn treo | Chỉ **một** việc: gắn `loginRateLimiter` cho `/api/rpc/authenticateUser` — đường dẫn đó chỉ có từ **Phase 4** (đã ghi chú trong `src/app.js`) |
| Đang chờ người dùng | §13.4 **mục 10** (mã sinh mới dùng tiền tố `CV` hay `DA` — không chặn, đang làm theo `CV`), **mục 11** (còn giữ `dump-sheets.js` + snapshot không — đang giữ), **mục 12** (Phase 9 nhập tay 28 dòng bằng cách nào). Mục 8 và 9 đã **hết hiệu lực** vì bỏ công cụ nhập |
| Dữ liệu để làm việc | `npm run seed:dev` → **dữ liệu mẫu §8.3**: 5 phòng (`PH05` rỗng hoàn toàn), 13 người, 9 công việc, 13 công việc con, 17 nhiệm vụ, 7 nhắc việc, 5 đề nghị, 4 app, 12 tin nhắn, 6 thông báo, 20 dòng nhật ký. **Cố ý có dữ liệu bẩn** (email chữ hoa, trùng họ tên, nhiệm vụ mồ côi, link thiếu `http`, ngày 29/02) — đừng "sửa cho sạch" |
| Tài khoản thử tay | `TEST001..TEST013` (§13.7), mật khẩu chung `Test@12345`, tất cả bị bắt đổi ở lần đăng nhập đầu. Có đủ **6 vai trò** |
| Dữ liệu thật (chỉ để đối chiếu) | `data/snapshot-20260824.json` (5 người dùng, 4 phòng, 2 công việc, 1 đề nghị, 1 chat — §13.8). **Không nhập tự động nữa**: 28 dòng thật nhập tay ở **Phase 9**. `data/*` không commit |

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

## 3. Prompt cho session tiếp theo — Phase 3 (API công việc 3 tầng), dán nguyên khối

```text
Dự án e:\quanlycongviec — chuyển hệ quản lý công việc từ Google Apps Script + Google Sheets
sang VPS (Node 24 + Express 5 + PostgreSQL 16 + Docker). Kế hoạch đầy đủ ở KE-HOACH-VPS.md.

TRƯỚC KHI LÀM BẤT CỨ VIỆC GÌ:
1. Đọc §13 của KE-HOACH-VPS.md — nguồn sự thật về việc đang làm đến đâu. Đọc thêm §0.1
   (TỪ VỰNG: cấp 1 = công việc, cấp 2 = công việc con, cấp 3 = nhiệm vụ; KHÔNG gọi cấp 1 là
   "dự án") và §13.4 mục 6 + mục 10 (dạng mã và tiền tố mã).
2. Làm theo §13.1. Đọc §13.5 (bẫy đã biết, gồm cả bảng bẫy Phase 2) — đừng phát hiện lại.
3. Đọc §7 Phase 3 (10 việc 3.1–3.10), §8.4 nhóm C (TC-TREE-01..35), §4.1 phần bảng work_items
   + reminders, §5.2 (hàm cây), §2.2 và §2.3 (tính năng nhóm B, C). Không đọc cả §7, cả §8.
4. Đọc docs/BAT-DAU-SESSION.md mục 4 và 5 (lệnh chạy + bẫy riêng của máy này + quy ước code).
5. Đọc §8.3 và phần work_items của server/src/db/seeds/dev.sql để biết dữ liệu mẫu đang có gì
   — Phase 3 viết test TRÊN dữ liệu mẫu đó, đừng dựng lại dữ liệu từ đầu.

KHÔNG đọc tràn Code.gs.moi (3645 dòng) và js.clean.html (3653 dòng). Phase 3 phải đối chiếu
hành vi cũ nhưng chỉ Grep đúng tên hàm: addTask, updateTask, deleteTask, getTasks,
moveTaskToProject, duplicateProject, generateTaskIdForProject, filterLevel3Tasks.
NGƯỢC LẠI, tools/test-tasks-gd2.js (40 phép kiểm đang xanh) thì ĐỌC CẢ FILE: đó là đặc tả
hành vi đã kiểm chứng của cây 3 tầng, việc của Phase 3 là port nó sang vitest + Postgres thật.

TRẠNG THÁI: Phase 0, 1, 2 đã xong. 322 test xanh trong 15 file. Nhánh vps/phase-1-auth.
ĐÃ CÓ SẴN, ĐỪNG LÀM LẠI: src/config/env.js (14 biến, zod), src/db/pool.js (withTransaction,
DATE trả về chuỗi YYYY-MM-DD), src/app.js (đã nối đủ attachSession → issueCsrfCookie →
verifyCsrf → audit → /v1/auth → requirePasswordChanged), src/utils/logger.js,
src/utils/errors.js (AppError + ERROR_STATUS), src/middleware/errorHandler.js (ok/
notFoundHandler/errorHandler), migration 001_init.sql (12 bảng, 6 sequence + next_code(),
3 trigger kiểm cấu trúc cây), src/modules/users/repo.js, src/modules/departments/repo.js,
src/modules/activityLogs/repo.js, src/middleware/rbac.js (can() theo §6),
src/middleware/{session,csrf,validate,rateLimit,audit}.js,
src/modules/auth/{password,cookies,service,repo,routes}.js, src/db/seeds/{dev.sql,run.js},
tests/global-setup.js, tests/helpers/{db,rbac,http}.js.

CSDL ĐÃ LÀM SẴN PHẦN KHÓ, ĐỪNG VIẾT LẠI Ở TẦNG JS:
- trigger trg_work_items_check_parent: cha phải là cấp 2 và cùng work_id
- CHECK lvl2_no_parent: cấp 2 buộc parent_id NULL. Cấp 3 parent_id NULL là HỢP LỆ (mồ côi)
- CHECK work_items_level_check: level chỉ 2 hoặc 3 · no_self_parent · work_items_completion_check
- trigger trg_reminders_only_level3: nhắc việc chỉ gắn được vào cấp 3
- next_code('CV', 'seq_work_item_code') sinh mã; sequence đã được dev.sql đẩy qua CV030
Việc của service là DỊCH lỗi CSDL thành mã lỗi §5.3 (PARENT_NOT_SUBWORK, PARENT_OTHER_WORK,
SELF_PARENT, CYCLE, REMINDER_ON_SUBWORK...), không phải kiểm trùng lặp rồi bỏ trigger.
VIỆC CỦA SESSION NÀY: làm trọn Phase 3 trên nhánh mới vps/phase-3-works (tách từ
vps/phase-1-auth). Theo đúng §7 Phase 3, 10 việc:
- 3.1 works CRUD + nhân bản: nhân bản kéo theo CẢ cây con, sinh mã mới, parent_id của bản sao
  trỏ vào BẢN SAO của cha chứ không trỏ về cây gốc (lỗi có sẵn ở bản cũ — TC-TREE-26/27)
- 3.2 workItems CRUD: MỘT service cho cả cấp 2 và cấp 3, phân biệt bằng level
- 3.3 đủ 6 nhánh chặn của updateTask: không đổi cấp · không tự trỏ vào mình · không trỏ vào
  con cháu · cha phải tồn tại · cha phải là cấp 2 · cấp 2 không được có cha
- 3.4 chuyển sang công việc khác: chặn cấp 2 ĐANG CÓ CON; cấp 3 thì bỏ parent_id và trả
  parentCleared: true. Chuyển sang công việc không tồn tại ⇒ 400 và dòng cũ VẪN CÒN NGUYÊN
- 3.5 xoá đệ quy: CASCADE lo dữ liệu, service trả về DANH SÁCH MÃ đã xoá để frontend hỏi lại
- 3.6 GET /works/tree: WITH RECURSIVE; nhiệm vụ parent_id IS NULL gom vào nhóm
  "(chưa gán công việc con)" và KHÔNG được biến mất — dữ liệu mẫu đã có sẵn CV001-030 mồ côi
- 3.7 reorder: cập nhật sort_order trong MỘT transaction; mã lạ trong danh sách thì bỏ qua
- 3.8 reminders CRUD: chỉ cho level = 3, gọi trên cấp 2 trả 409 REMINDER_ON_SUBWORK
- 3.9 sinh mã bằng next_code(), KHÔNG dùng mốc thời gian như generateTaskIdForProject
- 3.10 ràng buộc ngày: ngày nhiệm vụ ngoài khoảng ngày công việc cha là CẢNH BÁO, không chặn

DỮ LIỆU MẪU ĐÃ CÓ SẴN ĐỂ TEST (§8.3) — dùng luôn, đừng dựng lại:
- CV001-008 là công việc con RỖNG ⇒ tính tiến độ chia cho 0
- CV001-030 là nhiệm vụ MỒ CÔI (parent_id NULL) ⇒ nhóm "(chưa gán công việc con)"
- CV002-029 có 4 link kết quả, 1 link THIẾU http ⇒ đừng tin dữ liệu link là URL hợp lệ
- CV003-028 hạn 29/02/2028 · CV009 vắt qua năm 2026→2027 ⇒ test mốc ngày
- TEST008 và TEST013 TRÙNG HỌ TÊN ⇒ dò người theo tên phải trả NULL + giữ tên (TC-TREE-21)
- 9 công việc có đủ 4 trạng thái duyệt; mục "Chờ duyệt" KHÔNG được cộng vào số đếm nào

XONG KHI: toàn bộ 40 phép kiểm của tools/test-tasks-gd2.js đã port sang integration test chạy
trên Postgres thật và xanh · TC-TREE-01..35 xanh · thêm ≥25 test cho tree/reorder/cascade/
đồng thời, gồm TC-TREE-31 (20 request tạo nhiệm vụ ĐỒNG THỜI ra 20 mã khác nhau) và
TC-TREE-35 (lỗi giữa transaction ⇒ rollback sạch) · 322 test cũ vẫn xanh · lint +
format:check sạch.

Viết test song song với code, chạy ngay sau mỗi hàm, không dồn đến cuối phase.

CUỐI SESSION, bắt buộc trước khi tổng kết: cập nhật §13.2, thêm 1 dòng vào §13.3 (không sửa
dòng cũ), bổ sung §13.4 nếu có câu cần tôi trả lời, bổ sung §13.5 nếu phát hiện bẫy mới.
Nếu thiết kế đổi thì sửa luôn mục gốc (§4/§5/§7), không chỉ ghi ở §13. Cập nhật mục 1 và mục
3 của docs/BAT-DAU-SESSION.md — mục 3 lần sau là prompt cho Phase 4 (cắt frontend sang API:
tách file, cầu tương thích RPC §5.1 đủ 36 tên hàm, soát 53 chỗ innerHTML, gắn
loginRateLimiter cho /api/rpc/authenticateUser — §7 Phase 4 việc 4.1–4.8 + §8.6 checklist
khói 60 điểm + §8.7 TC-SEC-02/03).
Commit theo từng việc nhỏ, thông điệp có mã phase (phase-3: ...). Không dùng git add .

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
npm test          # phải 322/322 xanh trong 15 file (hết Phase 0 + 1 + 2)
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
- Test **không** được đọc snapshot thật — dùng dữ liệu mẫu `dev.sql` hoặc fixture riêng ở
  `server/tests/fixtures/`. Không log mật khẩu, kể cả mật khẩu mẫu.
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
| `dump-sheets.js` báo "thiếu sheet Dự án/Nhiệm vụ" | `.xlsx` cấm dấu `/` trong tên sheet ⇒ bản tải về bị đổi thành `Dự ánNhiệm vụ` | đã xử lý: khớp theo tên **chuẩn hoá**, ghi tên thật vào `actual_name` |
| Tạo công việc đầu tiên bằng API đổ vì trùng `UNIQUE` trên `code` | dữ liệu mẫu chèn bằng mã **viết cứng** nên 6 sequence vẫn ở 1 | `dev.sql` kết thúc bằng 6 câu `setval(seq, GREATEST(last_value, n))`; thêm dòng mới vào seed thì **nhớ nâng số** |
| `seed:dev` chạy lần 2 làm số liệu phồng lên | 4 bảng không có cột `code` (`reminders`, `chat_messages`, `notifications`, `activity_logs`) nên `ON CONFLICT` không dùng được | dùng `INSERT … SELECT … WHERE NOT EXISTS` với khoá tự chọn — xem cuối `dev.sql` |
| Test một chốt an toàn làm **cả vitest thoát** giữa lúc chạy | chốt kết thúc bằng `process.exit(1)`, gọi trong tiến trình test là giết luôn runner | chạy bằng `spawnSync(process.execPath, [run.js])` như `tests/integration/seed-guard.test.js` |
| Seed hoặc test đỏ ở chỗ trông như lỗi SQL sau khi sửa `001_init.sql` | CSDL dev vẫn giữ lược đồ cũ | `npm run migrate:redo` mỗi khi đụng vào migration |
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
5. Commit từng việc nhỏ, thông điệp có mã phase. Không `git add .`.



