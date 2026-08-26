# Nhật ký sửa lỗi dòng 1626 (`app.js`) và hoàn thiện vòng phân công ba lớp

> Ngày: **2026-08-26** · Nhánh: `vps/tinh-nang-phan-cong` · Bản app.js: `20260826-68`
> Ghi lại **toàn bộ** những gì đã làm trong vòng việc này để tra cứu lại được, kể cả cách chẩn đoán.

---

## 1. Bối cảnh

Ngày 2026-08-26 đã thực hiện **6 yêu cầu giao diện** của người dùng xong (commit trước đó đã có: giao diện phân công ba lớp, cầu RPC `assignment-options`, endpoint ứng viên…). Trên nền đó, vòng việc này gồm hai cụm lớn:

1. **Cụm "dropdown Phòng + cảnh báo máy chủ cũ"** (phiên trước, chưa kịp commit):
   - Thêm khóa `D_DB_ID` («ID phòng (DB)») vào `COL` **cả hai phía** client (`web/assets/js/app.js`) lẫn server (`server/src/rpc/legacyFields.js`, `departmentToLegacy` trả `row.id`), vì `buildDeptIdOptions` đọc `d.id/d.name` trên object legacy nên mọi option rỗng.
   - Value option chuyển sang **id số**: `buildDeptIdOptions` đọc `d[COL.D_DB_ID]`; lọc bỏ dòng thiếu `D_DB_ID` + `console.warn` «Bỏ x/y phòng vì máy chủ không gửi ID phòng…»; `projectFromLegacy` đổi `departmentId/supervisorId` sang `idOrNullOrUndefined` — gửi `""` khi SỬA thành `null` để PATCH **xoá liên kết** đúng ý.
   - **Tự báo động khi chạy phải bản cũ**: banner `console.info("[QLCV] app.js 20260826-xx")` đầu app.js; `veLaiPhong` toast lỗi «Danh sách phòng trống: máy chủ đang chạy bản cũ…»; mở form trước khi `getDepartmentContext` kịp trả thì vẽ lại ô Phòng rồi nạp phân công.
   - Đồng bộ mirror Apps Script `Code.gs.moi`; `server/eslint.config.js` thêm env jsdom cho 2 test DOM + global `DOMParser`/`Event`.
   - Test mới (jsdom chạy app.js/fetch giả THẬT): `dept-select.test.js`, `project-form-phan-cong.test.js`, `project-from-legacy-phong.test.js`.

2. **Cụm "sửa lỗi cú pháp dòng 1626 + kiểm chứng cuối"** (chi tiết bên dưới).

## 2. Sự cố: `SyntaxError: Unexpected token ')'` tại dòng 1626

### Nguyên nhân gốc rễ

Khối `<div>` ô **Người thực hiện** trong `createTaskModal` (phần 6 yêu cầu giao diện) bị script vá chèn **sai quy ước escape** đang dùng trong file:

| | Byte trong file | Hệ quả |
|---|---|---|
| Chuẩn (khối supervisor đang chạy đúng) | `style=\"" + (laCapHai ? "" : "display:none") + "\">` | `"` trần mở/đóng đoạn chuỗi, biểu thức JS nằm giữa |
| Bị hỏng | `style=\"\" + (laCapHai ? \"display:none\" : \"\") + \">` | Toàn bộ quote bị escape ⇒ chuỗi template **không bao giờ đóng** ⇒ parser trượt sang code kế tiếp |

Hậu quả trực tiếp: toàn trang web trắng vì `app.js` không parse được (`Unexpected token ')'` tại dòng 1626 là chỗ parser "chốt" lỗi, không phải chỗ gõ sai).

### Cách chẩn đoán

Đoán từng lớp JSON-escape bằng mắt cứ lệch liên tục, nên chuyển hẳn sang **so sánh byte-level với bản HEAD trong git** (`git show HEAD:web/assets/js/app.js`, bản này `node --check` OK):

- `tools/_diff-byte.mjs` — so từng dòng hai bản, chỉ ra chính xác vùng sai lệch quanh 1626.
- Đọc pattern chuẩn ngay tại khối `task-supervisor-group` trong cùng file ⇒ dựng đoạn thay thế **đúng quy ước**, đảo nhánh ternary (ẩn khi `laCapHai`), giữ nguyên logic và thụt lề của khối assignee.

### Cách vá

- Dùng `tools/_vaa-assignee.mjs` thay khối hỏng bằng chuỗi dựng theo pattern supervisor chuẩn ⇒ `node --check` PASS.
- Bắt thêm 1 nệt sót: `<divclass=` thiếu dấu cách sinh ra lúc vá ⇒ sửa thành `<div class=`.
- Kiểm chứng lần cuối bằng `tools/_kiem-tra-cuoi.mjs`: đủ 7 mốc (banner `-68`, `createProject`, `workMatchesMonth`, `projects-month-filter`, `napPhanCongTask`, `updateAssigneePermission`, khối phân công ba lớp).

## 3. dom-contract bắt được listener treo → bổ sung UI lọc tháng

Chạy `npm run test:unit` thấy `dom-contract.test.js` đỏ: 2 id **có đăng listener trong app.js nhưng index.html không sinh ra element**:

- `projects-month-filter` — thêm `<input type="month" id="projects-month-filter">` vào header mục Quản lý công việc.
- `projects-month-clear` — thêm `<button type="button" id="projects-month-clear" class="hidden">Bỏ lọc</button>` cạnh ô tháng.

App.js đã có sẵn logic lọc (`workMatchesMonth` + hiển thị nút bỏ lọc khi chọn tháng), nay đủ chỗ gắn vào.

## 4. Pin XSS cập nhật

TC-SEC-17 (pin đếm giá trị nội suy qua `escapeHtml`) đổi mốc **550 → 551**; số **chỗ ghi HTML** giữ nguyên **78**. Lý do tăng: thành phần phân công trong modal chi tiết dùng builder thoát đủ nhưng có thêm một nội suy. Ghi nhận lịch sử trong `docs/XSS-4.6.md` (mục *Cập nhật 2026-08-26*). Quy trình đọc lại ở header `server/tests/unit/xss-guard.test.js` — **hễ đổi code sinh HTML là phải chạy `tools/dem-xss.mjs` và cập nhật pin + tài liệu cùng commit**.

## 5. Hạ tầng/tài liệu kèm theo commit này

- Bump cache-buster `web/index.html`: `app.js ?v=20260826-67 → -68` (khớp banner console.info), `project-details.js ?v=-2 → -3` (file vừa sửa: 「Cán bộ thực hiện」 lấy từ nhiệm vụ được gán trong công việc con + nút «Thêm nhiệm vụ cho công việc con này» + lưới phân công 3 cột Ban lãnh đạo / Lãnh đạo phòng phụ trách).
- `.gitignore`: loại các file tạm dò/vá `tools/_*`, PID `tools/uat-server.pid`, `.vscode/`, file dữ liệu tải về. Các script tạm vẫn nằm trên đĩa để tra lại, chỉ là không commit; cần commit thủ công thì `git add -f <file>`.
- Nhật ký này + 1 dòng sổ tiến độ `KE-HOACH-VPS.md`.

## 6. Kết quả kiểm chứng

| Hạng mục | Lệnh | Kết quả |
|---|---|---|
| Cú pháp app.js | `node --check web/assets/js/app.js` | OK |
| Unit test | `npm run test:unit` (thư mục `server/`) | **410/410 test · 23 file** xanh |
| Full suite | `npm test` (unit + integration) | **914/914 test · 54 file** xanh |
| Lint | `npm run lint` | sạch |
| Format | `npm run format:check` | sạch |
| Mốc tính năng | `node tools/_kiem-tra-cuoi.mjs` | đủ 7/7 |

## 7. Việc còn lại (không thuộc vòng này)

Triển khai lên VPS (lặp lại từ sổ tiến độ): đồng bộ `web/` + `server/src/` lên VPS, `npm run migrate:up` (005 nếu chưa), restart Node, UPDATE tên admin trên CSDL VPS — người dùng phía VPS vẫn đang chạy bản cũ (đã có banner `console.info` để tự nhận biết).

---

## 8. Vòng lần 3 (cùng ngày) — «Cán bộ trực tiếp» + modal chi tiết gọn lại

> Ngày: **2026-08-26** · Đầu session: nhánh `vps/tinh-nang-phan-cong`, HEAD `5cb6360`, baseline
> **914/914 test · 54 file** xanh, lint/format/`node --check` sạch — xác nhận đủ trước khi sửa.

### 8.1 Việc làm và vị trí

| # | Yêu cầu | Sửa ở đâu |
|---|---|---|
| 4a | Nhãn «Người thực hiện» → **«Cán bộ trực tiếp»** trong ô gán người của `createTaskModal` | `web/assets/js/app.js` ~1540 (label trong chuỗi template, mốc `<label class=\"form-label\">Cán bộ trực tiếp</label>`); 2 nhãn xem nhanh «Chi tiết nhiệm vụ» ở dòng **3869** và **3909** |
| 4b | Ứng viên của ô này **chỉ lấy role «Nhân viên»** | `app.js` dòng **1544**: nối `.filter(canBo => canBo[COL.S_ROLE] === "Nhân viên")` SAU filter «Nhà cung cấp» có sẵn — mọi nhánh quyền vẫn chạy trước như cũ. Trưởng/Phó phòng/Phó GĐ/admin biến mất khỏi dropdown dù vai nào mở form |
| 5 | Option người **chỉ họ tên, bỏ email** | `app.js` ~1644: xoá khai báo `text4` (ghép `" (email)"`) và bỏ `escapeHtml(text4)` trong option gán người; value option vẫn là **tên người** — trường `assignee_id` từ form ghép về sau và luật server `LEADER_NOT_IN_SOURCE` không hề đụng tới |
| 1 | Thông tin phân công của modal chi tiết thành **MỘT HÀNG** | `project-details.js` dòng **84** `buildPhanCongNhomHtml()` (builder nhận văn bản thô, tự `escapeHtml` MỘT lần); hàng công việc ở dòng **240–245** (class `phan-cong-hang flex flex-wrap`), hàng của từng CV con ở dòng **156–162**. Chữ nhỏ **11px/12px cùng cỡ**, dấu «·» ngăn giữa các nhóm (`PHAN_CONG_CACH_HTML` dòng 42), `flex-wrap` cho phép xuống tối đa dòng 2 khi hẹp — hết kiểu 3 ô xếp dọc |
| 2 | Tên công việc con vào **KHUNG riêng** | `project-details.js` dòng **123**: hàng tiêu đề CV con thành hộp trắng viền xanh `cv-con-tieu-de rounded-lg px-3 py-2 shadow-sm` — hết chữ trôi trên nền xanh; danh sách nhiệm vụ vẫn nằm ngoài khung |
| 3 | Icon **BÚT CHỈ** theo quyền trên từng CV con | SVG inline tự vẽ `buildButChiIconHtml()` (dòng **46**); quyền render `coQuyenSuaCongViecCon(sw)` (dòng **71**) = `isAdmin()` tái dùng + tên trong `T_SUP`/`T_LEADERS` (tên do máy chủ trả) của CHÍNH CV con đó qua `tenTrongDanhSach()` (dòng 55); button `edit-subwork-btn data-id=` (dòng **146–152**); listener trong `showProjectDetailsModal` dòng **293–303** — bấm thì **kiểm lại quyền** rồi `openEditModal("task", id)` (form sửa cấp 2 hiện đủ ô Ban lãnh đạo/Lãnh đạo phòng), trái quyền thì toast lỗi |

Không đụng: server, schema, `assignments` service, RPC bridge, `Code.gs.moi`.

### 8.2 Kiểm chứng

| Hạng mục | Kết quả |
|---|---|
| Byte vùng đụng tới của app.js so `git show HEAD:web/assets/js/app.js` | **4539 dòng cả hai bản** — thay đổi bù nhau ±1 dòng (−1 `text4` ≈ +1 filter); ký tự Việt nguyên vẹn, quy ước escape giữ đúng (thuộc tính `"` trần ngoài chuỗi, biểu thức JS bên trong) |
| Vá bằng gì | script node `tools/_tam.mjs` đọc/ghi utf8, mỗi mốc phải xuất hiện ĐÚNG số lần mới ghi (đã xoá sau dùng). Không dùng PowerShell Set-Content |
| Test jsdom mới | `server/tests/unit/task-form-candidate.test.js` **4/4** (nhãn mới, trường dữ liệu giữ `name="assignee"`, ứng viên chỉ Nhân viên cho cả admin lẫn quản lý, option không chứa `@`) · `server/tests/unit/project-details-phan-cong.test.js` **8/8** (hàng flex 3 nhóm + 2 chấm ngăn, mỗi CV con 1 hàng riêng, khung `.cv-con-tieu-de`, HTML nguy hiểm trong tên CV con vẫn là chữ, bút chì: admin thấy 2 · Phó GĐ đúng CV con mình · lãnh đạo phòng đúng CV con mình · nhân viên ngoài cuộc 0, bấm nút mở form sửa đúng `CV001-01`) |
| Bộ cũ | Full suite **926/926 test · 56 file** xanh (lượt đầu đỏ 1 test integration vì thời điểm chạy — chạy lại và chạy tách nhóm đều xanh trọn; toàn bộ còn lại không đổi hành vi) · unit riêng 422/25 · integration 504/31 |
| Pin XSS | Chạy lại `node tools/dem-xss.mjs`: **78 chỗ ghi HTML / 550 giá trị** (−1 giá trị do bỏ nội suy email). Pin `TC-SEC-17` đã bump kèm dòng lý do; `docs/XSS-4.6.md` thêm 2 mục cập nhật |
| Lint + format | eslint 0 lỗi (đã khai 2 file test jsdom mới vào `eslint.config.js`) · prettier sạch |
| Cache-buster + banner | `web/index.html`: `app.js?v=20260826-68→-69`, `project-details.js?v=20260826-3→-4`; banner console `"[QLCV] app.js 20260826-69"` ở app.js dòng 9 |

### 8.3 Bẫy mới gặp ở vòng này (đã ghi thêm §13.5)

Vá file bằng công cụ editor dạng JSON: tham số văn bản bị lớp JSON xử lý trước làm mất cặp `\` trước
nháy trong chuỗi nguồn, nên `old_text` chứa `\"` không bao giờ khớp mặc dù "nhìn" giống hệt — phải
xác nhận bằng đếm mã ký tự quanh mốc (`codePointAt`) hoặc chọn mốc trong-dòng không vướng escape.
