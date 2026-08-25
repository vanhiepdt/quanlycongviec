# Bắt đầu một session mới — dán prompt, chạy, không phải nhớ gì

File này để **mở một session AI mới** mà không mất thời gian dò lại dự án đang ở đâu. Nguồn sự
thật về tiến độ vẫn là **§13 của `KE-HOACH-VPS.md`**; file này chỉ là bàn đạp.

Thứ tự dùng: đọc mục 1 (đang ở đâu) → copy prompt ở mục 2 hoặc 3 → dán vào session mới.

---

## 1. Đang ở đâu (cập nhật mỗi khi xong một phase)

| | |
|---|---|
| Nhánh đang làm | `vps/phase-5-approval` (tách từ `vps/phase-4-frontend`, HEAD `57cfa89`) — **toàn bộ Phase 5 nằm ở nhánh này**. `vps/phase-4-frontend` dừng ở `d99759f`, `vps/phase-3-works` ở `0e74738`, `vps/phase-2-import` ở `49f42b2`, `vps/phase-1-auth` ở `8aed2a8` |
| Phase đã xong | **0**, **1**, **2**, **3**, **4** và **5** — Phase 5: 11/11 việc (5.1 khoá duyệt khi tạo · 5.2/5.3/5.5/5.7 REST duyệt · 5.4 hai view `v_countable_*` · 5.6 nhãn vàng · 5.8 cron 07:00 · 5.10 bootstrap · 5.11 nhân sự/phòng · 5.12 nút «+ công việc con»; **5.9 email bỏ**). RPC **27 chạy / 10 còn 501**. Điểm đỏ §8.5 **C7** và **D1** hết đỏ |
| Test đang xanh | **835** trong 44 file, lint + `format:check` sạch |
| Phase kế tiếp | **6 — thống kê, lọc, Gantt** (§7 Phase 6 việc 6.1–6.9; §8.4 nhóm F TC-STAT-01..16; T5–T10/R1–R7 phần *vẽ* của checklist khói §8.5) |
| Còn treo | **D3–D8 UI**: máy chủ REST `/approvals/.../{submit,approve,reject}` + `pending-count` đã có; `app.js` **không** có nút Duyệt/Từ chối trên cây, `#*-pending-count` đếm trạng thái công việc chứ không đọc `pendingCount` bootstrap — **không** tự làm trong Phase 6 trừ khi người dùng yêu cầu. **R8–R12** đề nghị/chat/app/Excel + `addNotificationWithAuth` = Phase 7 (10 tên RPC còn 501). Nợ hiệu năng: `getTasks` N+1 (§13.5) — gộp ở Phase 6 |
| Đang chờ người dùng | **KHÔNG còn câu nào.** Mục 1–7, 10–15 đã trả lời; mục 8, 9 hết hiệu lực |
| Dữ liệu để làm việc | `npm run seed:dev` → **dữ liệu mẫu §8.3**: 5 phòng (`PH05` rỗng hoàn toàn), 13 người, 9 công việc, 13 công việc con, 17 nhiệm vụ, 7 nhắc việc, 5 đề nghị, 4 app, 12 tin nhắn, 6 thông báo, 20 dòng nhật ký. **Cố ý có dữ liệu bẩn** (email chữ hoa, trùng họ tên, nhiệm vụ mồ côi, link thiếu `http`, ngày 29/02) — đừng "sửa cho sạch" |
| ⚠ CSDL dev đang bị chặn seed | CSDL `quanlycongviec` (dev) còn **5 dòng tay** từ lúc thử tay (`CV001` "Việc gốc"…) trùng `code` nhưng khác `level` ⇒ `npm run seed:dev` nổ `PARENT_NOT_SUBWORK` ở đó. Cách chữa: xoá 5 dòng đó rồi seed lại, hoặc seed sang CSDL khác (`DATABASE_URL=…/quanlycongviec_uat npm run seed:dev` — `loadEnvFile()` không ghi đè biến dòng lệnh) |
| ⚠ CSDL khói UAT dễ thiếu migration | `quanlycongviec_uat` **không** tự `migrate:up` khi dev có migration mới. Thiếu `004_countable_views` ⇒ bootstrap 500. Mỗi lần thêm migration: `DATABASE_URL=…/quanlycongviec_uat npm run migrate:up` |
| Tài khoản thử tay | `TEST001..TEST013` (§13.7), mật khẩu chung `Test@12345`, tất cả bị bắt đổi ở lần đăng nhập đầu. Có đủ **6 vai trò** |
| Tự tay test giao diện | `docs/HUONG-DAN-TEST-GIAO-DIEN.md` — toast «Nạp dữ liệu người dùng chưa được chuyển» **không còn đúng** (5.10 đã nối). Còn 501: đề nghị / chat / app |
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

## 3. Prompt cho session tiếp theo — Phase 6 (thống kê, lọc, Gantt), dán nguyên khối

```text
Dự án e:\quanlycongviec — chuyển hệ quản lý công việc từ Google Apps Script + Google Sheets
sang VPS (Node 24 + Express 5 + PostgreSQL 16 + Docker). Kế hoạch đầy đủ ở KE-HOACH-VPS.md.

TRƯỚC KHI LÀM BẤT CỨ VIỆC GÌ:
1. Đọc §13 của KE-HOACH-VPS.md — nguồn sự thật về việc đang làm đến đâu. Đọc thêm §0.1
   (TỪ VỰNG: cấp 1 = công việc, cấp 2 = công việc con, cấp 3 = nhiệm vụ; KHÔNG gọi cấp 1 là
   "dự án"). Mọi con số thống kê chỉ đếm cấp 3; cấp 2 là nhóm, không cộng vào.
2. Làm theo §13.1. Đọc §13.5 — đủ khối bẫy Phase 0–5 (XSS / cầu RPC / Nginx / công cụ /
   duyệt-bootstrap-khói). Đừng phát hiện lại. Bẫy riêng Phase 6 đã ghi sẵn: thống kê backend
   (`getSummaryStats`) và frontend (`renderStats`) bản cũ có thể lệch nhau — việc ĐẦU TIÊN
   của Phase 6 là xác định con số nào đang hiện thật trên giao diện rồi lấy đó làm chuẩn.
3. Đọc §7 Phase 6 — 9 việc 6.1–6.9. Đọc §8.4 nhóm F (TC-STAT-01..16), §5.2 (REST thống kê /
   Gantt đã chốt đường, CHƯA có module), §5.3. Không đọc cả §7, không đọc cả §8.
4. Đọc docs/UAT.md phần "Checklist khói §8.5" — lượt Phase 5 (2026-08-25, HEAD 57cfa89):
   36 ✅ · 0 ❌ · 23 ⏳ · 1 —. Phase 6 phải đưa T5–T10 (vẽ đủ 6 biểu đồ + hoạt động gần đây)
   và R1–R7 (Gantt 1/2/3 tháng, nhóm 3 kiểu, thu gọn) từ «có nguồn» sang «vẽ đúng». Đừng tô
   xanh D3–D8 hay R8–R12 — không thuộc phase này.
5. Đọc docs/BAT-DAU-SESSION.md mục 4 và 5 (lệnh chạy + bẫy máy + quy ước code).

KHÔNG đọc tràn Code.gs.moi (3645 dòng) và web/assets/js/app.js (~3653 dòng / 305 KB) — đây là
nguyên nhân cháy ngữ cảnh phổ biến nhất của dự án này. Cần biết giao diện gọi gì thì Grep:
"renderStats", "chartData", "summaryStats", "calculateGanttBarStyle", "groupBy", "getSummaryStats".
Việc quét rộng thì giao subagent và chỉ nhận danh sách kết luận.

TRẠNG THÁI: Phase 0–5 đã xong. 835 test xanh trong 44 file, lint + format:check sạch.
Nhánh vps/phase-5-approval (HEAD 57cfa89) — Phase 6 tách nhánh mới vps/phase-6-stats TỪ
vps/phase-5-approval (không tách từ nhánh khác).

ĐÃ CÓ SẴN, ĐỪNG LÀM LẠI:
- Hai view v_countable_works / v_countable_items (việc 5.4). MỌI truy vấn thống kê / biểu đồ
  / Gantt đếm phải đọc qua view. Test EXPLAIN đã có — đừng thêm AND approval_status rải rác.
- GET /api/v1/bootstrap (việc 5.10) đã trả summaryStats + MỘT chartData theo trạng thái +
  activities. Đó là nguồn đầu trang, KHÔNG thay cho GET /stats/summary và /stats/charts?type=
  (6 loại). Đừng nhét 6 loại vào bootstrap.
- Cầu RPC 37 tên: 27 chạy / 10 pending (đề nghị/chat/app/addNotificationWithAuth → Phase 7).
  Phase 6 KHÔNG nối thêm tên RPC nào. Thống kê + Gantt là REST mới, không có tên cũ.
- publicUser() đã gán name = full_name. getInitialDataWithAuth lúc chưa đăng nhập vẫn
  {requireLogin:true}.
- XSS: pin TC-SEC-17 = 498 giá trị / 70 chỗ. HTML mới phải escapeHtml / textContent; helper
  trả HTML phải tên create*/build*/render* (BUILDER), không add*Html. Đổi pin thì sửa cả
  docs/XSS-4.6.md.
- Vitest: LUÔN `cd server && npm test`. Không npx vitest từ gốc repo. Helper HTTP là `del`
  không phải `delete`. POST/PATCH/DELETE cần X-CSRF-Token.

VIỆC CỦA SESSION NÀY: làm trọn Phase 6 trên nhánh mới vps/phase-6-stats (tách từ
vps/phase-5-approval). Theo đúng §7 Phase 6, 9 việc:
- 6.1 GET /api/v1/stats/summary — 4 thẻ số + tỷ lệ; chỉ đếm level = 3; loại Chờ duyệt qua
  view. Tỷ lệ 0 nhiệm vụ = 0%, không NaN.
- 6.2 GET /api/v1/stats/charts?type= — ĐỦ 6 loại, trả đúng hình dạng {labels, data} mà
  Chart.js / renderStats đang nhận. Không dữ liệu ⇒ {labels:[], data:[]} + thông báo, không
  lỗi. Việc ĐẦU: Grep renderStats / chart type ở app.js để chốt 6 type, đừng đoán.
- 6.3 Hoạt động gần đây — đọc activity_logs có phân trang (bootstrap đang lấy 22 dòng không
  trang; đường này là trang được).
- 6.4 Lọc theo tháng — GIAO NHAU khoảng ngày: daterange(start,end) && daterange(:from,:to).
  Việc kéo 3 tháng hiện ở cả 3 tháng. Việc kết thúc đúng ngày 01 của tháng lọc VẪN có. Thiếu
  ngày bắt đầu hoặc kết thúc: không làm mất dòng, không lỗi.
- 6.5 Lọc theo phòng — admin/Phó GĐ chọn được nhiều phòng; vai khác bị ÉP về phòng mình
  Ở SERVER (TC-STAT-10). Không tin query string.
- 6.6 GET /api/v1/gantt?from=&to=&groupBy=department|deputy|assignee — trả cây đã nhóm sẵn,
  thứ tự phòng theo sort_order. Một Phó GĐ phụ trách 2 phòng ⇒ gộp cả 2 vào nhóm người đó.
- 6.7 Chọn 1 / 2 / 3 tháng — GIỮ calculateGanttBarStyle (1 tháng) và
  calculateGanttBarStyleRange (2–3 tháng) đang có trong app.js. Việc dài hơn khoảng: thanh
  bị cắt hai đầu, KHÔNG mất. Việc nằm ngoài hẳn khoảng: không hiện thanh.
- 6.8 Cây 4 mức thu gọn — Nhóm → Công việc → Công việc con → Nhiệm vụ; trạng thái thu gọn
  lưu localStorage, tải lại trang vẫn giữ.
- 6.9 Đối chiếu số liệu — chạy song song bản Apps Script và bản VPS trên CÙNG dữ liệu, so
  từng con số. Xong khi 4 thẻ + 6 biểu đồ chênh 0. Nếu hai bên bản cũ đang lệch nhau thì
  lấy số ĐANG HIỆN trên giao diện làm chuẩn (rủi ro §7 Phase 6), ghi rõ vào §13.5.
Nợ Phase 4 (bắt buộc làm trong phase này, không để tiếp): getTasks của cầu RPC đang N+1
(mỗi công việc một GET /work-items, đã đo ở §8.5 C6). Gộp một truy vấn (listForWorks đã có
ở bootstrap — dùng lại, đừng viết SQL mới).

KHÔNG LÀM:
- Email / nodemailer / services/mailer.js (5.9 đã bỏ).
- Đề nghị / chat / app / xuất Excel / addNotificationWithAuth (Phase 7, 10 tên còn 501).
- Nút Duyệt/Từ chối trên cây (D3–D8 UI) — máy chủ REST đã có, không có tên RPC. Trừ khi
  người dùng yêu cầu trong session.
- Nới quyền §6. Không git add . Không commit deploy/.env hay data/*.
- Không đọc tràn hai file nguồn lớn.

RỦI RO LỚN NHẤT CỦA PHASE 6 LÀ ĐẾM SAI (cấp 2 lẫn cấp 3, hoặc lọt Chờ duyệt), KHÔNG PHẢI
VẼ ĐƯỢC BIỂU ĐỒ. Mọi SQL đếm đi qua v_countable_*. Test chốt TC-STAT-01 (cấp 2 không cộng)
+ TC-APR-06 (thêm 1 mục Chờ duyệt ⇒ 4 thẻ và 6 biểu đồ không đổi một đơn vị) vẫn xanh.

XONG KHI: 835 test cũ vẫn xanh · TC-STAT-01..16 xanh · bảng đối chiếu 4 thẻ + 6 biểu đồ
chênh 0 (hoặc ghi rõ chuẩn lấy từ UI nếu bản cũ lệch) · Gantt 3 tháng cắt thanh đúng hai
đầu · nhân viên gọi ?departmentId= phòng khác bị ép về phòng mình · getTasks không còn N+1
· lint + format:check sạch · CHẠY LẠI bash tools/smoke-8.5.sh (nhớ migrate UAT nếu có
migration mới) và cập nhật docs/UAT.md: T5–T10 và R1–R7 phải từ «có nguồn» sang xanh vẽ.
Đừng báo "xong" khi còn điểm đỏ — ghi rõ điểm nào chưa đạt và vì sao.

Viết test song song với code, chạy ngay sau mỗi việc (`cd server && npm test`), không dồn
đến cuối phase.

CUỐI SESSION, bắt buộc trước khi tổng kết: cập nhật §13.2, thêm 1 dòng vào §13.3 (không sửa
dòng cũ), bổ sung §13.4 nếu có câu cần tôi trả lời, bổ sung §13.5 nếu phát hiện bẫy mới.
Nếu thiết kế đổi thì sửa luôn mục gốc (§4/§5/§6/§7), không chỉ ghi ở §13. Cập nhật mục 1 và
mục 3 của docs/BAT-DAU-SESSION.md — mục 3 lần sau là prompt cho Phase 7 (đề nghị, quản lý
app, chat, xuất Excel: §7 việc 7.1–7.6; 10 tên RPC còn 501; quyền xuất chỉ trong phạm vi
được thấy — 7.6 dễ thành lỗ rò).
Commit theo từng việc nhỏ, thông điệp có mã phase (phase-6: ...). Không dùng git add .

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
5. Chạy lại `bash tools/smoke-8.5.sh` nếu phase vừa làm mở thêm điểm §8.5, rồi cập nhật phần
   "Checklist khói §8.5" trong `docs/UAT.md` (nêu tên điểm đỏ, đừng chỉ đổi con số) và bảng
   "Ghi chú nghiệm thu" ở cuối file.
6. Commit từng việc nhỏ, thông điệp có mã phase. Không `git add .`.



