# Bắt đầu một session mới — dán prompt, chạy, không phải nhớ gì

File này để **mở một session AI mới** mà không mất thời gian dò lại dự án đang ở đâu. Nguồn sự
thật về tiến độ vẫn là **§13 của `KE-HOACH-VPS.md`**; file này chỉ là bàn đạp.

Thứ tự dùng: đọc mục 1 (đang ở đâu) → copy prompt ở mục 2 hoặc 3 → dán vào session mới.

---

## 1. Đang ở đâu (cập nhật mỗi khi xong một phase)

| | |
|---|---|
| Nhánh đang làm | `vps/phase-4-frontend` (tách từ `vps/phase-3-works`) — **toàn bộ Phase 4 nằm ở nhánh này**. `vps/phase-3-works` dừng ở `0e74738`, `vps/phase-2-import` ở `49f42b2`, `vps/phase-1-auth` ở `8aed2a8` |
| Phase đã xong | **0**, **1**, **2**, **3** và **4** — Phase 4: 8/8 việc (tách `web/` · `api-bridge.js` đủ **37** tên hàm cũ · tự chứa Tailwind/Chart.js/Font Awesome/Inter/Alpine · đăng nhập cookie + phát lại lời gọi khi 401 · modal đổi mật khẩu bắt buộc khi 403 · **soát 55 dòng / 70 chỗ / 474 giá trị `innerHTML`** · bỏ code chết · Nginx phục vụ `web/`) + đã chạy tay **cả 60 điểm** checklist khói §8.5 |
| Test đang xanh | **675** trong 33 file (495 sau Phase 3 + 180 của Phase 4), lint + `format:check` sạch |
| Phase kế tiếp | **5 — luồng duyệt + thông báo + lịch chạy** (§7 Phase 5, việc 5.1–5.8 + **5.10** `GET /api/v1/bootstrap`, **5.11** nối 7 tên nhân sự/phòng, **5.12** nút «+ công việc con» trên cây — cả ba thêm ngày 2026-08-25; §8.4 nhóm E; nhóm Duyệt 8 điểm của §8.5) |
| Còn treo | Hết nợ Phase 1 (`loginRateLimiter` đã gắn cho `/api/rpc/authenticateUser`, có test 429). Còn **2 điểm đỏ** của §8.5, cả hai đã ghi trong `docs/UAT.md`: **C7** biểu mẫu cũ không tạo được công việc con cấp 2 (§13.4 mục 14 đã chốt **phương án (b)** ⇒ **việc 5.12**) và **D1** Trưởng phòng tạo ra «Đã duyệt» (việc 5.1). Còn **18/37** tên hàm cũ trả `501` — Phase 5 mở 10 + 3, Phase 7 mở phần còn lại |
| Đang chờ người dùng | **KHÔNG còn câu nào.** Mục 14 chốt 2026-08-25 = **phương án (b)** (nút «+ công việc con» trên cây ⇒ việc 5.12, biểu mẫu vẫn tạo cấp 3); mục 15 chốt cùng ngày = **`Phó Giám đốc` phụ trách phòng cũng đặt được nhắc việc** (đã cài, +2 test). Mục 1–7, 10–15 đã trả lời; mục 8, 9 hết hiệu lực |
| Dữ liệu để làm việc | `npm run seed:dev` → **dữ liệu mẫu §8.3**: 5 phòng (`PH05` rỗng hoàn toàn), 13 người, 9 công việc, 13 công việc con, 17 nhiệm vụ, 7 nhắc việc, 5 đề nghị, 4 app, 12 tin nhắn, 6 thông báo, 20 dòng nhật ký. **Cố ý có dữ liệu bẩn** (email chữ hoa, trùng họ tên, nhiệm vụ mồ côi, link thiếu `http`, ngày 29/02) — đừng "sửa cho sạch" |
| ⚠ CSDL dev đang bị chặn seed | CSDL `quanlycongviec` (dev) còn **5 dòng tay** từ lúc thử tay (`CV001` "Việc gốc"…) trùng `code` nhưng khác `level` ⇒ `npm run seed:dev` nổ `PARENT_NOT_SUBWORK` ở đó. Cách chữa: xoá 5 dòng đó rồi seed lại, hoặc seed sang CSDL khác như Phase 4 đã làm (`DATABASE_URL=…/quanlycongviec_uat npm run seed:dev` — `loadEnvFile()` không ghi đè biến dòng lệnh) |
| Tài khoản thử tay | `TEST001..TEST013` (§13.7), mật khẩu chung `Test@12345`, tất cả bị bắt đổi ở lần đăng nhập đầu. Có đủ **6 vai trò** |
| Chạy lại lượt khói | `bash tools/smoke-8.5.sh` — cần một Nginx trỏ về máy chủ (xem mục 4) hoặc đặt `BASE=http://127.0.0.1:3000`. Script tự dọn dòng nó tạo và in số dòng còn lại để đối chiếu với seed (9 / 30) |
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

## 3. Prompt cho session tiếp theo — Phase 5 (luồng duyệt + thông báo + lịch chạy), dán nguyên khối

```text
Dự án e:\quanlycongviec — chuyển hệ quản lý công việc từ Google Apps Script + Google Sheets
sang VPS (Node 24 + Express 5 + PostgreSQL 16 + Docker). Kế hoạch đầy đủ ở KE-HOACH-VPS.md.

TRƯỚC KHI LÀM BẤT CỨ VIỆC GÌ:
1. Đọc §13 của KE-HOACH-VPS.md — nguồn sự thật về việc đang làm đến đâu. Đọc thêm §0.1
   (TỪ VỰNG: cấp 1 = công việc, cấp 2 = công việc con, cấp 3 = nhiệm vụ; KHÔNG gọi cấp 1 là
   "dự án").
2. Làm theo §13.1. Đọc §13.5 — CẢ NĂM khối bẫy (Phase 1, 2, 3 và 4 chỗ bẫy của Phase 4:
   XSS / cầu RPC / Nginx / công cụ-môi trường), đừng phát hiện lại.
3. Đọc §7 Phase 5 — 10 việc: 5.1–5.8 cộng 5.10 và 5.11 (hai việc thêm ngày 2026-08-25 sau lượt
   khói §8.5). Việc 5.9 (email) ĐÃ BỎ theo §13.4 mục 4: KHÔNG cài nodemailer, KHÔNG viết
   services/mailer.js. Đọc tiếp §8.4 nhóm E (test luồng duyệt), §5.2 (bảng 37 tên hàm cũ → REST:
   19 tên đang chạy, 18 tên còn trả 501 — Phase 5 mở 13 trong số đó), §5.3 (hình dạng phản hồi)
   và §6 (ai duyệt được). Không đọc cả §7, không đọc cả §8.
4. Đọc docs/UAT.md phần cuối "Checklist khói §8.5 — 6 nhóm / 60 điểm": đó là kết quả chạy tay
   thật ngày 2026-08-25 (19 xanh / 2 đỏ / 38 chờ / 1 không có ở bản cũ). Phase 5 phải xử điểm đỏ
   D1 và mở 37 trong 38 điểm ⏳ — danh sách điểm nào thuộc việc nào đã ghi sẵn ở đó.
5. Đọc docs/BAT-DAU-SESSION.md mục 4 và 5 (lệnh chạy + bẫy riêng của máy này + quy ước code).

KHÔNG đọc tràn Code.gs.moi (3645 dòng) và web/assets/js/app.js (3653 dòng / 305 KB) — đây là
nguyên nhân cháy ngữ cảnh phổ biến nhất của dự án này. Cần biết giao diện gọi gì thì Grep:
"google.script.run", "approval", "Chờ duyệt", "pendingCount", "badge". Việc quét rộng thì giao
subagent và chỉ nhận danh sách kết luận.

TRẠNG THÁI: Phase 0, 1, 2, 3, 4 đã xong. 675 test xanh trong 33 file, lint + format:check sạch.
Nhánh vps/phase-4-frontend — Phase 5 tách nhánh mới vps/phase-5-approval TỪ vps/phase-4-frontend
(không tách từ nhánh khác).

ĐÃ CÓ SẴN, ĐỪNG LÀM LẠI:
- Cầu RPC: server/src/rpc/{index.js,table.js,legacyFields.js} — bảng 37 tên hàm cũ. Thêm một
  tên vào đời thật = đổi pending() thành hàm thật trong table.js, KHÔNG sửa web/assets/js/app.js.
  GET /api/rpc in ra cả bảng ánh xạ để đối chiếu.
- Frontend: web/ (index.html + assets/js/app.js + assets/js/api-bridge.js + assets/css/app.css
  + assets/vendor/**). Điều lệ ở đầu app.js vẫn còn hiệu lực: KHÔNG đổi tên hàm, KHÔNG đổi id
  DOM, KHÔNG dọn code — trừ khi chính việc của Phase 5 buộc phải thêm phần tử mới (nhãn vàng,
  badge, nút Duyệt/Từ chối), lúc đó thêm mới và ghi rõ trong commit.
- Xác thực/CSRF/phân quyền/nhật ký (Phase 1), cây 3 tầng + nhắc việc (Phase 3), dữ liệu mẫu
  §8.3 (Phase 2). Mọi lời ghi POST/PATCH/DELETE phải có header X-CSRF-Token, nếu không nhận 403.
- Escape XSS: escapeHtml / escapeHtmlAttr trong app.js đã soát đủ 474 giá trị ở Phase 4. Mọi
  HTML mới của Phase 5 (nhãn vàng, badge, dòng lý do từ chối do người dùng nhập) phải đi qua
  đúng hai hàm đó, hoặc dùng textContent. Lý do từ chối là dữ liệu người dùng nhập — coi như
  nguồn tấn công, thêm test XSS cho nó.

VIỆC CỦA SESSION NÀY: làm trọn Phase 5 trên nhánh mới vps/phase-5-approval (tách từ
vps/phase-4-frontend). Theo đúng §7 Phase 5, 11 việc. §13.4 KHÔNG còn câu nào chờ trả lời —
mục 14 và 15 đã chốt ngày 2026-08-25, cứ làm theo, đừng hỏi lại:
- 5.1 đặt trạng thái khi tạo: Trưởng/Phó phòng tạo cấp 1 hoặc cấp 2 ⇒ 'Chờ duyệt'; admin và
  Phó GĐ ⇒ 'Đã duyệt'; cấp 3 LUÔN 'Đã duyệt'. Đây là điểm đỏ D1 của §8.5: hiện cột
  works.approval_status có mặc định 'Đã duyệt' và không chỗ nào đặt 'Chờ duyệt', nên kiểm bằng
  đúng cách của lượt khói: đăng nhập tp01@test.local, tạo một công việc, đọc lại cột trong CSDL.
- 5.2 ba hành động submit / approve / reject — reject BẮT BUỘC có lý do ≥ 10 ký tự.
- 5.3 quyền duyệt: admin mọi phòng; Phó GĐ chỉ phòng có tên mình trong department_managers
  (phòng khác phải 403). Không nới thêm vai nào.
- 5.4 LOẠI 'Chờ duyệt' KHỎI MỌI CON SỐ bằng hai view v_countable_works / v_countable_items,
  KHÔNG thêm điều kiện rải rác ở từng truy vấn — đây là chỗ dễ sót nhất của cả dự án.
- 5.5 badge: GET /approvals/pending-count, gọi lại sau mỗi lần duyệt.
- 5.6 nhãn vàng: cả phòng thấy mục 'Chờ duyệt', người không phải người tạo không sửa được.
- 5.7 thông báo: có mục mới chờ ⇒ thông báo Phó GĐ phụ trách; được duyệt / bị từ chối ⇒ thông
  báo người tạo. Chỉ ghi bảng notifications + badge, KHÔNG gửi email.
- 5.8 services/cron.js: 07:00 hằng ngày quét nhiệm vụ quá hạn và tạo thông báo, chạy trong
  container app, có cờ CRON_ENABLED để staging tắt. Test bằng cách gọi trực tiếp hàm quét với
  đồng hồ giả, đừng chờ 07:00.
- 5.10 GET /api/v1/bootstrap: một lời gọi trả gói dữ liệu đầu trang (người đăng nhập, danh sách
  phòng, danh sách người, số đếm chờ duyệt, thống kê tổng quan) rồi nối getDataForUser +
  getInitialDataWithAuth + getDepartmentContext vào nó trong rpc/table.js. GIỮ NGUYÊN ngoại lệ:
  khi CHƯA đăng nhập, getInitialDataWithAuth trả {requireLogin:true} chứ không 401/501 — có
  test rồi, đừng làm đổ. Việc này mở 17 điểm ⏳ (cả nhóm Tổng quan 10 điểm + R1–R7 Gantt).
  Thống kê trong gói đọc qua view của việc 5.4; biểu đồ đầy đủ vẫn để Phase 6.
- 5.11 nối 7 tên nhân sự/phòng vào cầu RPC (getStaffList, addStaffWithAuth, updateStaffWithAuth,
  deleteStaffWithAuth, deleteDepartmentWithAuth + 2 tên phòng đã chạy): nghiệp vụ đã có từ
  Phase 1 ở /api/v1/users và /api/v1/departments, chỉ thiếu lớp ánh xạ. Mở 10 điểm ⏳ (nhóm
  Người dùng & Phòng). Đừng viết lại nghiệp vụ, đừng nới quyền của §6.
- 5.12 nút «+ công việc con» trên cây — §13.4 mục 14 chốt phương án (b). Bấm ở hàng CÔNG VIỆC
  ⇒ mở #task-form ở chế độ tạo cấp 2 (không cha); bấm ở hàng CÔNG VIỆC CON ⇒ tạo cấp 3 với
  parentRef là hàng đó. KHÔNG thêm ô "Cấp" cho người dùng chọn — cấp suy ra từ chỗ bấm.
  COL.T_LEVEL/COL.T_PARENT (app.js:56–57) đang khai rồi bỏ không, việc này mới dùng đến. Đây là
  việc ĐƯỢC PHÉP đổi DOM, nên phải thêm id mới vào tests/unit/dom-contract.test.js. Xong thì
  điểm đỏ C7 của §8.5 mới hết đỏ.
Đề nghị / chat / app vẫn để 501 tới Phase 7 — đừng tiện tay làm luôn.

RỦI RO LỚN NHẤT CỦA PHASE 5 LÀ SÓT MỘT CHỖ ĐẾM, KHÔNG PHẢI VIẾT ĐƯỢC NÚT DUYỆT:
"Chờ duyệt" phải biến mất khỏi 4 thẻ số, 6 biểu đồ, mọi bộ lọc và cả gói bootstrap. Cách duy
nhất không sót là hai view của việc 5.4 + một test chạy EXPLAIN mọi truy vấn thống kê để khẳng
định chúng đều đọc qua view. Test chốt: ghi lại 4 thẻ số, tạo 1 mục 'Chờ duyệt', đọc lại — không
đổi MỘT ĐƠN VỊ nào.

QUYỀN ĐẶT NHẮC VIỆC ĐÃ ĐỔI (§13.4 mục 15, chốt 2026-08-25): admin + Phó Giám đốc PHỤ TRÁCH
phòng đó + Trưởng phòng / Phó phòng của phòng đó. Đã cài ở VAI_DAT_NHAC_VIEC trong
modules/reminders/service.js, 23 phép kiểm xanh — đừng nới thêm vai nào nữa.

XONG KHI: 675 test cũ vẫn xanh · test "tạo 1 mục Chờ duyệt ⇒ 4 thẻ số và 6 biểu đồ không đổi
một đơn vị nào" xanh · Phó GĐ phòng A duyệt mục phòng B nhận 403 · lý do từ chối rỗng hoặc
< 10 ký tự bị chặn · EXPLAIN khẳng định mọi truy vấn thống kê đọc qua v_countable_* · bootstrap
trả đủ gói và getInitialDataWithAuth lúc chưa đăng nhập vẫn trả {requireLogin:true} · 13 tên hàm
cũ mới nối đều có test (đúng route, đúng phương thức, có CSRF) · lý do từ chối có test XSS ·
lint + format:check sạch · CHẠY LẠI bash tools/smoke-8.5.sh và cập nhật docs/UAT.md: nhóm Tổng
quan phải từ 0/10 lên xanh, nhóm Duyệt phải xử xong D1 và D2–D8, nhóm Người dùng & Phòng lên
xanh, R1–R7 lên xanh. Đừng báo "xong" khi còn điểm đỏ — ghi rõ điểm nào chưa đạt và vì sao.

Viết test song song với code, chạy ngay sau mỗi việc, không dồn đến cuối phase.

CUỐI SESSION, bắt buộc trước khi tổng kết: cập nhật §13.2, thêm 1 dòng vào §13.3 (không sửa
dòng cũ), bổ sung §13.4 nếu có câu cần tôi trả lời, bổ sung §13.5 nếu phát hiện bẫy mới.
Nếu thiết kế đổi thì sửa luôn mục gốc (§4/§5/§6/§7), không chỉ ghi ở §13. Cập nhật mục 1 và mục
3 của docs/BAT-DAU-SESSION.md — mục 3 lần sau là prompt cho Phase 6 (thống kê, lọc, Gantt: §7
Phase 6 việc 6.1–6.9, chú ý 6.4 lọc tháng theo GIAO NHAU khoảng ngày, 6.9 đối chiếu số liệu với
bản Apps Script phải chênh 0, và nợ hiệu năng từ Phase 4: getTasks đang gọi N+1 — gộp một truy
vấn; test §8.4 nhóm F + nhóm Tổng quan và R1–R7 của checklist khói §8.5).
Commit theo từng việc nhỏ, thông điệp có mã phase (phase-5: ...). Không dùng git add .

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
cd server && npm test    # phải 675/675 xanh trong 33 file (hết Phase 0 + 1 + 2 + 3 + 4)
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
docker run --rm -v "$PWD/deploy/nginx/app.conf:/etc/nginx/conf.d/app.conf:ro" \
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

# 2. Nginx phục vụ web/ và chuyển /api sang container app
docker run -d --name qlcv-uat-nginx --network qlcv-uat -p 127.0.0.1:8099:80 \
  -v "$PWD/deploy/nginx/app.conf:/etc/nginx/conf.d/app.conf:ro" \
  -v "$PWD/deploy/nginx/security-headers.conf:/etc/nginx/snippets/security-headers.conf:ro" \
  -v "$PWD/web:/var/www/qlcv:ro" nginx:1.27-alpine

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
5. Chạy lại `bash tools/smoke-8.5.sh` nếu phase vừa làm mở thêm điểm §8.5, rồi cập nhật phần
   "Checklist khói §8.5" trong `docs/UAT.md` (nêu tên điểm đỏ, đừng chỉ đổi con số) và bảng
   "Ghi chú nghiệm thu" ở cuối file.
6. Commit từng việc nhỏ, thông điệp có mã phase. Không `git add .`.



