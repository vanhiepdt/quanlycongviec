# Bắt đầu một session mới — dán prompt, chạy, không phải nhớ gì

File này để **mở một session AI mới** mà không mất thời gian dò lại dự án đang ở đâu. Nguồn sự
thật về tiến độ vẫn là **§13 của `KE-HOACH-VPS.md`**; file này chỉ là bàn đạp.

Thứ tự dùng: đọc mục 1 (đang ở đâu) → copy prompt ở mục 2 hoặc 3 → dán vào session mới.

---

## 1. Đang ở đâu (cập nhật mỗi khi xong một phase)

| | |
|---|---|
| Nhánh đang làm | `vps/phase-3-works` (tách từ `vps/phase-2-import`) — **toàn bộ Phase 3 nằm ở nhánh này**. `vps/phase-2-import` dừng ở `49f42b2`, `vps/phase-1-auth` dừng ở `8aed2a8` |
| Phase đã xong | **0**, **1**, **2** và **3** — Phase 3: 13/13 việc (works CRUD + nhân bản cả cây · workItems một service hai cấp · 6 nhánh chặn · chuyển công việc · xoá đệ quy · `/works/tree` · reorder · nhắc việc · sinh mã · cảnh báo ngày · phòng cả ba cấp · nguồn gốc · nhật ký từng đầu việc) |
| Test đang xanh | **495** trong 24 file (322 sau Phase 2 + 173 của Phase 3, gồm 21 test port từ `tools/test-tasks-gd2.js`) |
| Phase kế tiếp | **4 — cắt frontend sang API** (§7 Phase 4, việc 4.1–4.8 + §8.5 checklist khói 60 điểm + §8.7 TC-SEC-02/03). **Điểm dừng an toàn** hết phase này |
| Còn treo | Chỉ **một** việc, và Phase 4 phải làm: gắn `loginRateLimiter` cho `/api/rpc/authenticateUser` — đường dẫn đó chỉ có khi dựng cầu RPC (đã ghi chú trong `src/app.js`) |
| Đang chờ người dùng | §13.4 **mục 10** (tiền tố mã `CV` hay `DA` — đang làm theo `CV`), **mục 11** (còn giữ `dump-sheets.js` + snapshot không — đang giữ), **mục 12** (Phase 9 nhập tay 28 dòng bằng cách nào), **mục 13** (ai được đặt nhắc việc — đang cho "ai sửa được nhiệm vụ", bản cũ chỉ admin). Mục 8 và 9 đã **hết hiệu lực** |
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

## 3. Prompt cho session tiếp theo — Phase 4 (cắt frontend sang API), dán nguyên khối

```text
Dự án e:\quanlycongviec — chuyển hệ quản lý công việc từ Google Apps Script + Google Sheets
sang VPS (Node 24 + Express 5 + PostgreSQL 16 + Docker). Kế hoạch đầy đủ ở KE-HOACH-VPS.md.

TRƯỚC KHI LÀM BẤT CỨ VIỆC GÌ:
1. Đọc §13 của KE-HOACH-VPS.md — nguồn sự thật về việc đang làm đến đâu. Đọc thêm §0.1
   (TỪ VỰNG: cấp 1 = công việc, cấp 2 = công việc con, cấp 3 = nhiệm vụ; KHÔNG gọi cấp 1 là
   "dự án").
2. Làm theo §13.1. Đọc §13.5 — CẢ BA bảng bẫy (Phase 1, Phase 2, Phase 3), đừng phát hiện lại.
3. Đọc §7 Phase 4 (8 việc 4.1–4.8), §5.1 (cầu tương thích RPC, có sẵn khung code), §5.2 (bảng
   36 hàm cũ → service mới — đây là đặc tả của cầu), §8.5 (checklist khói 60 điểm, 6 nhóm) và
   §8.7 TC-SEC-02/03 (XSS). Không đọc cả §7, không đọc cả §8.
4. Đọc docs/BAT-DAU-SESSION.md mục 4 và 5 (lệnh chạy + bẫy riêng của máy này + quy ước code).
5. Đọc §5.3 (hình dạng phản hồi) rồi mở server/src/modules/*/routes.js đúng những route mà cầu
   RPC cần gọi lại — đừng đoán tên trường, API Phase 3 đã cố định chúng.

KHÔNG đọc tràn Code.gs.moi (3645 dòng) và js.clean.html (3653 dòng) — đây là nguyên nhân cháy
ngữ cảnh phổ biến nhất của dự án này, và Phase 4 là phase dễ mắc nhất vì việc nằm đúng ở hai
file đó. Cách làm đúng:
- Việc 4.1 là việc CƠ HỌC: dùng lệnh copy/move của hệ điều hành để đưa js.clean.html thành
  web/assets/js/app.js, CSS.html thành web/assets/css/app.css. Chỉ ĐỌC vài dòng đầu và vài
  dòng cuối để bỏ hai thẻ <script> bọc ngoài (và <style> của CSS). Không đọc giữa file.
- Cần biết frontend gọi gì thì Grep, đừng đọc: "google.script.run", "innerHTML",
  "withSuccessHandler", "escapeHtmlAttr", "#add-notification-btn".
- Việc quét rộng (liệt kê 53 chỗ innerHTML, đối chiếu 36 tên hàm RPC) thì giao subagent và
  chỉ nhận danh sách kết luận.

TRẠNG THÁI: Phase 0, 1, 2, 3 đã xong. 495 test xanh trong 24 file. Nhánh vps/phase-3-works —
Phase 4 tách nhánh mới vps/phase-4-frontend TỪ vps/phase-3-works (không tách từ nhánh khác).

BACKEND ĐÃ XONG, PHASE 4 KHÔNG VIẾT LẠI NGHIỆP VỤ — chỉ gọi lại:
- Xác thực: POST /api/v1/auth/login, /auth/logout, /auth/password (ĐỔI MẬT KHẨU — tên route là
  /password, không phải /change-password), GET /api/v1/auth/me.
  Phiên bằng cookie HttpOnly, CSRF theo mẫu double-submit (cookie + header X-CSRF-Token) —
  bridge PHẢI gửi header này cho mọi POST/PATCH/DELETE, nếu không nhận 403.
- Công việc cấp 1: GET/POST /api/v1/works, GET/PATCH/DELETE /api/v1/works/:idOrCode,
  POST /works/:id/copy (nhân bản cả cây), POST /works/:id/reorder, GET /works/tree,
  GET /works/:id/history.
- Cấp 2 + cấp 3: GET/POST /api/v1/work-items, GET/PATCH/DELETE /work-items/:idOrCode,
  POST /work-items/:id/copy, GET /work-items/:id/history. Chuyển việc, bỏ cha, đổi cha đều là
  PATCH trên chính đầu việc đó.
- Nhắc việc lồng dưới đầu việc: GET/POST /api/v1/work-items/:id/reminders,
  PATCH/DELETE .../reminders/:reminderId — chỉ gắn được vào cấp 3, gọi trên cấp 2 trả 409
  REMINDER_ON_SUBWORK. KHÔNG có /api/v1/reminders ở gốc.
- Mọi phản hồi theo §5.3: { ok: true, data } hoặc { ok: false, error: { code, message, field } }.
  DELETE cây trả về DANH SÁCH MÃ đã xoá; tạo/sửa có thể kèm data.warnings (ngày ngoài khoảng
  ngày công việc cha là CẢNH BÁO, không phải lỗi) — giao diện phải hiện cảnh báo đó.
- Mã (CV0xx, CV0xx-NNN) là DANH TÍNH, không đổi kể cả khi chuyển sang công việc khác. Giao diện
  đừng suy ra công việc cha từ tiền tố mã; đọc work_id/workCode trong dữ liệu trả về.

RỦI RO LỚN NHẤT CỦA PHASE 4 LÀ XSS, KHÔNG PHẢI NGHIỆP VỤ:
frontend cũ dựng HTML bằng innerHTML ở 53 chỗ với dữ liệu người dùng nhập (tên việc, ghi chú,
link kết quả). Trên Apps Script chuyện này bị che bởi iframe sandbox; trên VPS thì không còn gì
che. Việc 4.6 và TC-SEC-02/03 là bắt buộc, không phải tuỳ chọn: soát ĐỦ 53 chỗ, chỗ nào chỉ
chèn văn bản thì chuyển sang textContent, chỗ nào buộc dựng HTML thì escape từng giá trị (kể cả
trong thuộc tính và trong href — chặn cả javascript:). Kiểm bằng đúng chuỗi thử của §8.7.

VIỆC CỦA SESSION NÀY: làm trọn Phase 4 trên nhánh mới vps/phase-4-frontend (tách từ
vps/phase-3-works). Theo đúng §7 Phase 4, 8 việc:
- 4.1 tách file: index.html bỏ <?!= include('js') ?> và include('CSS'), thay bằng <script src>
  + <link rel=stylesheet>; js.clean.html → web/assets/js/app.js (bỏ 2 thẻ <script> bọc ngoài);
  CSS.html → web/assets/css/app.css. Việc cơ học, làm bằng lệnh copy, đừng đọc cả file.
- 4.2 web/assets/js/api-bridge.js theo §5.1: định nghĩa lại window.google.script.run với
  withSuccessHandler / withFailureHandler, ĐỦ 36 tên hàm ở bảng §5.2, nạp TRƯỚC app.js. app.js
  gọi 28 chỗ google.script.run — mục tiêu là app.js gần như KHÔNG phải sửa. Hàm nào backend
  chưa có thì gọi thất bại rõ ràng (báo lỗi tiếng Việt), KHÔNG im lặng trả undefined.
- 4.3 tự chứa thư viện ngoài: Tailwind (bản build sẵn — production KHÔNG dùng
  cdn.tailwindcss.com), Chart.js, Font Awesome, font Inter tải về web/assets/vendor/.
- 4.4 đăng nhập bằng cookie phiên; 401 giữa lúc đang dùng ⇒ hiện lại modal đăng nhập rồi chạy
  lại request vừa hỏng, không đứng im.
- 4.5 nhận 403 MUST_CHANGE_PASSWORD ⇒ mở thẳng modal đổi mật khẩu, không cho vào app.
- 4.6 chống XSS: soát ĐỦ 53 chỗ innerHTML; có sẵn escapeHtmlAttr, viết thêm escapeHtml cho
  nội dung; ưu tiên textContent khi chỉ chèn văn bản.
- 4.7 bỏ code chết: listener #add-notification-btn không có nút tương ứng trong index.html —
  hoặc thêm nút, hoặc bỏ listener (chọn bỏ listener nếu tính năng chưa có thật).
- 4.8 Nginx phục vụ web/: cache assets/ 30 ngày, index.html KHÔNG cache.

CÒN MỘT VIỆC NỢ TỪ PHASE 1, LÀM LUÔN Ở PHASE 4: gắn loginRateLimiter cho
/api/rpc/authenticateUser (route RPC mới sinh ra ở việc 4.2 — nếu không gắn thì cầu tương thích
trở thành đường vòng thoát khỏi chặn dò mật khẩu của /api/v1/auth/login). §8.7 không có mã test
riêng cho việc này — tự viết một test: sai mật khẩu quá ngưỡng qua đường RPC phải nhận 429.

TRẢ LỜI TRƯỚC KHI SỬA GIAO DIỆN: §13.4 còn 4 câu chờ tôi (mục 10, 11, 12, 13). Mục 13 (ai được
đặt nhắc việc) ảnh hưởng trực tiếp đến nút "Đặt nhắc" trên giao diện — hỏi lại tôi ở đầu
session, đừng tự quyết rồi làm cả hai đường.

XONG KHI: 495 test cũ vẫn xanh · api-bridge.js có test cho ĐỦ 36 tên hàm (mỗi tên gọi đúng
route, đúng phương thức, có header CSRF; hàm ghi thiếu CSRF phải hỏng thấy được, không im lặng)
· TC-SEC-02/03 xanh: gửi <img src=x onerror=alert(1)> vào tên công việc / tên nhiệm vụ / ghi chú
rồi kiểm HTML dựng ra chỉ có chữ, không có thẻ · đã soát và ghi lại kết quả cho CẢ 53 chỗ
innerHTML (chỗ nào đổi, chỗ nào an toàn sẵn vì chỉ chèn HTML tĩnh) · /api/rpc/authenticateUser
có loginRateLimiter và có test 429 · lint + format:check sạch · chạy tay checklist khói §8.5
(6 nhóm, 60 điểm, tích vào docs/UAT.md) và ghi rõ điểm nào chưa đạt, đừng báo "xong" khi còn
điểm đỏ.

Viết test song song với code, chạy ngay sau mỗi việc, không dồn đến cuối phase. Frontend chạy
được trong vitest bằng jsdom cho phần bridge/escape; phần vẽ giao diện thì kiểm tay theo §8.5.

CUỐI SESSION, bắt buộc trước khi tổng kết: cập nhật §13.2, thêm 1 dòng vào §13.3 (không sửa
dòng cũ), bổ sung §13.4 nếu có câu cần tôi trả lời, bổ sung §13.5 nếu phát hiện bẫy mới.
Nếu thiết kế đổi thì sửa luôn mục gốc (§4/§5/§7), không chỉ ghi ở §13. Cập nhật mục 1 và mục
3 của docs/BAT-DAU-SESSION.md — mục 3 lần sau là prompt cho Phase 5 (luồng duyệt + thông báo +
lịch chạy: §7 Phase 5 việc 5.1–5.8, chú ý 5.4 loại "Chờ duyệt" khỏi MỌI thống kê bằng hai view
v_countable_works / v_countable_items, và 5.9 đã BỎ email theo §13.4 mục 4 — đừng cài
nodemailer; test §8.4 nhóm duyệt + nhóm Duyệt (8 điểm) của checklist khói §8.5).
Commit theo từng việc nhỏ, thông điệp có mã phase (phase-4: ...). Không dùng git add .

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
cd server && npm test    # phải 495/495 xanh trong 24 file (hết Phase 0 + 1 + 2 + 3)
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
  `tools/test-tasks-gd2.js`, `file tai xuong tu google sheet.xlsx` đang sửa dở / chưa theo dõi
  từ trước — **đừng stage kèm**. Riêng `web/` là **thư mục của Phase 4**: hiện chỉ có khung rỗng
  `web/assets/{css,js,vendor}` (một file `.gitkeep`), chưa theo dõi. Từ Phase 4 trở đi thì
  commit, nhưng vẫn `git add` từng file — đừng `git add web/` khi trong đó có bản tải về của
  thư viện ngoài chưa kiểm.

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
| Test đỏ hàng loạt 401, log in ra `RUN v4.1.11 E:/quanlycongviec` | gọi `npx vitest` từ **gốc repo** ⇒ chạy vitest@4 của thư mục gốc, không có `globalSetup` nên CSDL test chưa dựng | luôn `cd server` trước mọi lệnh `npm`/`npx`; kiểm dòng `RUN v2.1.8 E:/quanlycongviec/server` ở đầu output |
| `api.delete is not a function` | helper HTTP ở `tests/helpers/http.js` đặt tên là **`del`** (`delete` là từ khoá) | dùng `api.del(url)` |
| `ECONNRESET` khi test đồng thời (TC-TREE-31) | 20 request cùng lúc, mỗi request tự đi lấy token CSRF ⇒ 40 kết nối, supertest dựng server mới mỗi lần | lấy token **một lần** rồi dùng lại cho cả 20 request |

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



