# Việc 4.6 — Soát XSS toàn bộ tầng trình duyệt

Bản ghi kết quả soát của `web/assets/js/app.js` (Phase 4, nhánh `vps/phase-4-frontend`).
Bản Apps Script cũ chạy trong iframe sandbox của Google; bản VPS chạy trên tên miền của mình, nên
một lỗ XSS ở đây là chiếm được phiên đăng nhập thật. Kế hoạch §7 nói rõ: **rủi ro lớn nhất của
Phase 4 là XSS, không phải nghiệp vụ.**

## 1. Con số

| Số | Ý nghĩa |
| --- | --- |
| 55 | dòng có ghi HTML (`innerHTML` / `insertAdjacentHTML`) |
| 70 | **chỗ ghi HTML** — nhiều dòng có 2–3 chỗ vì mã đã tối giản, một dòng dài 3000 ký tự |
| 474 | **giá trị được nội suy** vào chuỗi HTML — đây mới là số chỗ phải thoát |

Kế hoạch §7 ghi "53 chỗ innerHTML": đó là đếm dòng trên `js.clean.html` cũ (56 dòng có nhắc
`innerHTML`, trong đó có cả chỗ ĐỌC). Con số phải soát thật là **474**.

## 2. Bốn hàm thoát (app.js, ngay trên `formatDateForDisplay`)

| Hàm | Dùng ở đâu | Vì sao |
| --- | --- | --- |
| `escapeHtml(v)` | giữa hai thẻ, và trong thuộc tính có dấu bao | thoát đủ 5 ký tự `& < > " '` |
| `escapeHtmlAttr(v)` | tên cũ, giữ lại vì đã có nhiều chỗ gọi | nay **gọi thẳng** `escapeHtml` |
| `escapeForInlineHandler(v)` | trong chuỗi JS của thuộc tính `on*` | thoát JS **trước**, thoát HTML **sau** |
| `safeUrl(v)` | mọi `href` / `src` dựng động | chỉ cho `http:` `https:` `mailto:` và đường dẫn tương đối |

Ba cái bẫy đã trả giá để biết:

1. **`escapeHtmlAttr` cũ thiếu dấu nháy đơn.** File này dựng rất nhiều nút
   `onclick="handleX('GIÁ TRỊ')"`, nên thiếu `'` là đủ để chiếm toàn bộ trang.
2. **Trong `on*`, thoát HTML là vô dụng.** Bộ phân tích HTML *giải mã thực thể trước* khi JS thấy
   đoạn mã: `&#39;` biến lại thành `'` và đóng chuỗi JS. Phải thoát JS trước (`\` `'` CR LF) rồi mới
   thoát HTML — khi đó `&#39;` mà kẻ tấn công tự gõ thành `&amp;#39;`, là chữ chết.
   `TC-SEC-28` cố tình chứng minh chiều ngược lại: dùng `escapeHtml` trong `on*` **là chiếm được**.
3. **`safeUrl` phải `.trim()` sau khi bỏ ký tự điều khiển.** Trình duyệt tự bỏ khoảng trắng đầu
   URL, nên `" javascript:alert(1)"` lọt qua mọi phép kiểm lược đồ làm ẩu.

Hai cách "thoát" cũ trong file đã bị bỏ vì **đều khai thác được**:

- `decodeURIComponent('" + encodeURIComponent(x) + "')` — `encodeURIComponent` để nguyên
  `' ( ) * - . _ ~ !`, nên `'-alert(1)-'` chạy được.
- `JSON.stringify(x).replace(/"/g, "&quot;")` — kẻ tấn công gõ sẵn `&#34;` là thoát ra;
  nay là `escapeHtml(JSON.stringify(x))`.

## 3. Kết quả 474 giá trị

| Loại | Số | Nghĩa |
| --- | --- | --- |
| `DA-THOAT` | 412 | đã đi qua một hàm thoát đúng ngữ cảnh |
| `HTML-LONG` | 31 | giá trị **chính là HTML** do hàm dựng khác trả về; các lỗ bên trong nó được soát riêng |
| `SO` | 9 | `.length`, `parseInt(...)`, `Math.max(...)` |
| `HTML-BIEN` | 8 | biến chứa HTML đã dựng ở dòng trên |
| `CAN-THOAT` | 8 | cố ý không bọc — lý do ở §4 |
| `DA-THOAT-BIEN` | 6 | biến **đã tự thoát** từ chỗ gán — bọc thêm là hiện `&quot;` trong ô nhập |

Phân theo ngữ cảnh: `text` 244 · `attr` 190 · `handler` 26 (trong chuỗi JS của `on*`) ·
`url` 6 · `handler-ngoai` 5 · `trong-the` 3. Không còn thuộc tính nào **thiếu dấu bao**.

## 4. Tám chỗ cố ý không bọc

| Ngữ cảnh | Mã | Số chỗ | Lý do |
| --- | --- | --- | --- |
| `trong-the` | `text3` | 3 | cờ `selected` do **chính mã** sinh ra (`"selected"` hoặc `""`), không có dữ liệu người dùng |
| `handler-ngoai` | `index` | 4 | chỉ số `.map()`, nằm trong `on*` nhưng **ngoài** chuỗi JS: `onclick="f(" + i + ")"` |
| `text` | `text` | 1 | `const wrapRow = text => "<tr><td …>" + text + "</td></tr>"` — cả 4 chỗ gọi đều truyền HTML **hằng** |

Bốn hàm dựng ngày tháng (`format*`) **không** được coi là an toàn: `formatDateForDisplay` trả về
*nguyên giá trị* khi không phân tích được ngày, nên một ô ngày chứa HTML sẽ đi thẳng ra giao diện.
15 chỗ ngày tháng vì thế vẫn phải bọc.

## 5. Sáu chỗ ghi HTML phải soát tay

| Dòng | Vế phải | Kết luận |
| --- | --- | --- |
| 1672, 3634, 3640, 3645 | `""` | xoá rỗng vùng chứa, không có dữ liệu nào đi vào |
| 2039 | `""` | như trên (`setButtonLoading` khi bắt đầu quay) |
| 2039 | `el.dataset.originalContent` | cất `innerHTML` **của chính nút** rồi trả lại — không nhận dữ liệu ngoài |

## 6. Những chỗ thật sự hở, đã sửa tay

- `linkifyText` — bản cũ nhét `$1` **thô** vào cả `href` và chữ của liên kết, và cho phần chữ xung
  quanh đi qua không thoát. Viết lại: quét từng liên kết, `escapeHtml(safeUrl(...))` cho `href`,
  `escapeHtml` cho chữ và cho mọi đoạn giữa các liên kết.
- `formatTaskLinks` — `"<a href=\"" + filtered2 + "\"…"`: dán thẳng dòng người dùng nhập vào `href`.
- Ô hiện liên kết kết quả (`parsed2.url`), ảnh của thẻ ứng dụng (`appIcon`), modal nhúng ứng dụng
  (`url` ở **cả** `href` và `src`).
- `showToast(message)` — thông điệp lỗi từ máy chủ đi thẳng vào `innerHTML`.
- Hai danh sách lời nhắc: tham số của `openEditReminderModal(...)` và `handleDeleteReminder(...)`
  trong `onclick`.
- `createDepartmentTableRow` — hai chỗ `escapeHtmlAttr(departmentId)` **bên trong `onclick`** tưởng
  là an toàn: nâng lên `escapeForInlineHandler`.
- `formatTaskLinks` đánh số liên kết: bước bọc máy móc từng tạo ra `escapeHtml(index) + 1` =
  `"Link 01"`. Nay là `escapeHtml(index + 1)` — bọc **kết quả** phép tính, không bọc toán hạng.

## 7. Cách kiểm lại (bắt buộc chạy khi sửa app.js)

```
cd server && npx vitest run tests/unit/xss-guard.test.js tests/unit/xss-escape.test.js
```

- `tests/helpers/xss-audit.js` — bộ soát tĩnh bằng acorn: tìm mọi chuỗi ghép có thẻ HTML, tính
  ngữ cảnh của từng lỗ bằng **máy trạng thái** (không dùng biểu thức chính quy: `onclick="f('` có
  `"` và `'` lồng nhau nên mọi mẫu kiểu `[^"']*$` đều trượt — đúng nhóm nguy hiểm nhất).
- `tests/unit/xss-guard.test.js` (TC-SEC-10…20) — chốt: không còn lỗ nào ngoài 8 chỗ ở §4, mọi
  `on*` dùng `escapeForInlineHandler`, mọi `href/src` qua `safeUrl`, không có thuộc tính thiếu dấu
  bao, và hai con số 70/474. TC-SEC-18…20 soát `tests/fixtures/xss-mau.js` — file có lỗ **đã biết**
  — để một bộ soát bị hỏng không thể báo "xanh" oan.
- `tests/unit/xss-escape.test.js` (TC-SEC-21…34) — hành vi thật trong jsdom: đọc
  `getAttribute('onclick')` rồi **chạy** đoạn mã đó, đòn tấn công phải đến nơi dưới dạng dữ liệu và
  `window.BI_CHIEM` phải không được đặt.

Khi test đỏ: **không sửa danh sách cho hết đỏ.** Bọc giá trị bằng đúng hàm cho ngữ cảnh của nó.

## 8. Còn nợ (không thuộc 4.6)

- `app.js` mặc định ảnh ứng dụng về `https://cdn-icons-png.flaticon.com/...` — một lần gọi ra
  ngoài lúc chạy. Việc 4.3 đã bỏ hết CDN khác; chỗ này nên đổi sang ảnh tự chứa (ghi vào §13.4).

## 9. Phụ lục — bản ghi từng chỗ ghi HTML (70 chỗ)

Sinh ra bằng `tests/helpers/xss-audit.js`. "HTML dựng sẵn" = vế phải là chuỗi HTML hoặc hàm dựng,
mọi giá trị bên trong nó đã tính ở §3. "soát tay" = sáu chỗ ở §5.

| Dòng | Kiểu | Kết luận | Vế phải (60 ký tự đầu) |
| --- | --- | --- | --- |
| 211 | innerHTML | HTML dựng sẵn | `"<div class=\"text-center text-gray-500 text-sm py-4\"><i cl` |
| 214 | innerHTML | HTML dựng sẵn | `"<div class=\"text-center text-red-500 text-sm\">Lỗi tải tin` |
| 377 | innerHTML | HTML dựng sẵn | `text` |
| 395 | innerHTML | HTML dựng sẵn | `"<div class=\"flex items-center\"><i class=\"fas fa-exclamat` |
| 422 | innerHTML | HTML dựng sẵn | `"<div class=\"loading-card\">Vui lòng đăng nhập</div>"` |
| 578 | innerHTML | HTML dựng sẵn | `allProjects.map(project => "<option value=\"" + escapeHtml(p` |
| 611 | innerHTML | HTML dựng sẵn | `allProjects.map(project => "<option value=\"" + escapeHtml(p` |
| 676 | innerHTML | HTML dựng sẵn | `text` |
| 841 | innerHTML | HTML dựng sẵn | `"<div class=\"loading-card\">Chưa có dự án nào</div>"` |
| 844 | innerHTML | HTML dựng sẵn | `userAllowedProjects.map(userAllowedProject => createProjectC` |
| 875 | innerHTML | HTML dựng sẵn | `"<div class=\"loading-card\">Chưa có nhiệm vụ nào</div>"` |
| 902 | innerHTML | HTML dựng sẵn | `text || "<div class=\"loading-card\">Không có nhiệm vụ nào k` |
| 934 | innerHTML | HTML dựng sẵn | `"<tr><td colspan=\"5\" class=\"px-3 py-4 text-center text-gr` |
| 934 | innerHTML | HTML dựng sẵn | `"<tr><td colspan=\"3\" class=\"px-3 py-4 text-center text-gr` |
| 943 | innerHTML | HTML dựng sẵn | `"<tr><td colspan=\"5\" class=\"px-3 py-4 text-center text-gr` |
| 943 | innerHTML | HTML dựng sẵn | `filteredStaff.map(filteredStaff3 => createStaffTableRow(filt` |
| 943 | innerHTML | HTML dựng sẵn | `"<tr><td colspan=\"3\" class=\"px-3 py-4 text-center text-gr` |
| 943 | innerHTML | HTML dựng sẵn | `filteredStaff2.map(filteredStaff22 => createStaffTableRow(fi` |
| 1308 | innerHTML | HTML dựng sẵn | `"<div class=\"loading-card\">Không có hoạt động nào</div>"` |
| 1312 | innerHTML | HTML dựng sẵn | `slice.map(slice2 => "\n <div class=\"activity-item\">\n <div` |
| 1336 | innerHTML | HTML dựng sẵn | `text2` |
| 1588 | innerHTML | HTML dựng sẵn | `wrapRow("Chỉ Admin xem được cấu hình phòng.")` |
| 1592 | innerHTML | HTML dựng sẵn | `wrapRow("<i class=\"fas fa-spinner fa-spin mr-2\"></i>Đang t` |
| 1598 | innerHTML | HTML dựng sẵn | `wrapRow("Chưa có phòng nào. Bấm \"Thêm phòng\" để tạo.")` |
| 1601 | innerHTML | HTML dựng sẵn | `allDepartments.map(item => createDepartmentTableRow(item)).j` |
| 1651 | innerHTML | HTML dựng sẵn | `createDepartmentModal(!!department, department)` |
| 1672 | innerHTML | HTML dựng sẵn | `messages.map(message => "<div class=\"text-red-600 text-sm\"` |
| 1672 | innerHTML | **soát tay** | `""` |
| 2039 | innerHTML | **soát tay** | `""` |
| 2039 | innerHTML | **soát tay** | `el.dataset.originalContent` |
| 2143 | innerHTML | HTML dựng sẵn | `"\n <div class=\"flex items-center space-x-3\">\n <i class=\` |
| 2208 | innerHTML | HTML dựng sẵn | `text2` |
| 2257 | innerHTML | HTML dựng sẵn | `text3` |
| 2347 | innerHTML | HTML dựng sẵn | `"\n <div class=\"flex justify-between items-center mb-3 pb-2` |
| 2369 | innerHTML | HTML dựng sẵn | `text` |
| 2378 | innerHTML | HTML dựng sẵn | `text` |
| 2447 | innerHTML | HTML dựng sẵn | `reminders.map((reminder, index) => "\n <div class=\"reminder` |
| 2447 | innerHTML | HTML dựng sẵn | `"\n <div class=\"text-center py-8 text-gray-400\">\n <i clas` |
| 2571 | innerHTML | HTML dựng sẵn | `text3` |
| 2692 | innerHTML | HTML dựng sẵn | `"<div class=\"lg:col-span-2 text-center py-8 text-gray-500 t` |
| 2695 | innerHTML | HTML dựng sẵn | `filteredList.map(filteredList2 => { const taskName = filtere` |
| 3128 | innerHTML | HTML dựng sẵn | `validation.map(validation2 => "<div class=\"text-red-600 tex` |
| 3144 | innerHTML | HTML dựng sẵn | `"<i class=\"fas fa-pause-circle text-sm\"></i>" + escapeHtml` |
| 3144 | innerHTML | HTML dựng sẵn | `"<i class=\"fas fa-play-circle text-sm\"></i>" + escapeHtml(` |
| 3144 | innerHTML | HTML dựng sẵn | `"<i class=\"fas fa-check-circle text-sm\"></i>" + escapeHtml` |
| 3144 | innerHTML | HTML dựng sẵn | `"<i class=\"fas fa-pause text-sm\"></i>" + escapeHtml(data.p` |
| 3155 | innerHTML | HTML dựng sẵn | `"<i class=\"fas fa-pause-circle text-sm\"></i>" + escapeHtml` |
| 3155 | innerHTML | HTML dựng sẵn | `"<i class=\"fas fa-play-circle text-sm\"></i>" + escapeHtml(` |
| 3155 | innerHTML | HTML dựng sẵn | `"<i class=\"fas fa-check-circle text-sm\"></i>" + escapeHtml` |
| 3155 | innerHTML | HTML dựng sẵn | `"<i class=\"fas fa-pause text-sm\"></i>" + escapeHtml(data.p` |
| 3155 | innerHTML | HTML dựng sẵn | `"<i class=\"fas fa-times-circle text-sm\"></i>" + escapeHtml` |
| 3171 | innerHTML | HTML dựng sẵn | `"<div class=\"text-center text-gray-500 text-sm\">Chưa có ti` |
| 3174 | innerHTML | HTML dựng sẵn | `messages.map(message => { const flag = message.user === curr` |
| 3223 | innerHTML | HTML dựng sẵn | `"\n<div class=\"flex items-start gap-3 flex-row-reverse\">\n` |
| 3291 | insertAdjacentHTML | HTML dựng sẵn | `text` |
| 3405 | innerHTML | HTML dựng sẵn | `text` |
| 3435 | insertAdjacentHTML | HTML dựng sẵn | `text` |
| 3452 | innerHTML | HTML dựng sẵn | `"<div class=\"text-center py-8 text-gray-500\">Không có dữ l` |
| 3455 | innerHTML | HTML dựng sẵn | `items.map(item => { if (type === "project") { const projectI` |
| 3500 | innerHTML | HTML dựng sẵn | `"<div class=\"glass-card p-8 text-center text-gray-500\">Chư` |
| 3534 | innerHTML | HTML dựng sẵn | `text || "<div class=\"glass-card p-8 text-center text-gray-5` |
| 3634 | innerHTML | HTML dựng sẵn | `"<option value=\"\">-- Chọn nhiệm vụ --</option>" + filtered` |
| 3634 | innerHTML | **soát tay** | `""` |
| 3640 | innerHTML | **soát tay** | `""` |
| 3645 | innerHTML | **soát tay** | `""` |
| 3648 | innerHTML | HTML dựng sẵn | `"\n <div class=\"bg-gray-50 p-3 rounded-lg text-sm space-y-1` |
| 3688 | innerHTML | HTML dựng sẵn | `"<div class=\"col-span-full text-center text-gray-500 py-8\"` |
| 3701 | innerHTML | HTML dựng sẵn | `"<div class=\"col-span-full text-center text-gray-500 py-8\"` |
| 3729 | innerHTML | HTML dựng sẵn | `text` |
| 3741 | insertAdjacentHTML | HTML dựng sẵn | `text3` |
