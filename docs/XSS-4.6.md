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

> **Cập nhật Phase 5 (việc 5.6).** Nhãn vàng "Chờ duyệt" thêm 5 chỗ gọi `pendingApprovalBadge(...)`
> vào ba hàm vẽ (`createProjectCard`, `renderTasks`, `createTaskTableRowSimple`,
> `createTaskListItem`) ⇒ **481 giá trị**, vẫn **70 chỗ ghi HTML** (không thêm `innerHTML` nào).
> Năm chỗ này nằm trong danh sách "cố ý không bọc" của `xss-guard.test.js`: hàm trả về HTML đã
> thoát sẵn, bọc thêm là hiện thẻ ra dưới dạng chữ. Hành vi thoát của chính nó do
> `tests/unit/pending-badge.test.js` canh.
>
> **Cập nhật Phase 5 (việc 5.12).** Nút «+ công việc con» thêm 17 giá trị nội suy ⇒ **498 giá trị**,
> vẫn **70 chỗ ghi HTML**. Tám chỗ gọi `createSubworkFromWorkButtonHtml` /
> `createTaskFromSubworkButtonHtml` xếp `HTML-LONG` (hàm `create*` trả HTML đã thoát sẵn; bọc thêm
> là hiện thẻ ra chữ). Chín chỗ còn lại (`className`, `data-project-*`, `data-parent-id`, ô ẩn
> `level`/`parent`) đi qua `escapeHtml`. Hành vi nút/ô ẩn do `tests/unit/subwork-button-ui.test.js`
> canh.
>
> **Cập nhật Phase 6.** Gantt vẽ lại từ cây máy chủ + Tổng quan nạp 6 biểu đồ từ `/stats/charts`
> thêm **4 chỗ ghi HTML** (`gantt-items` ×3, `.gantt-days` ×1) và **43 giá trị nội suy** ⇒
> **74 chỗ / 541 giá trị**. Toàn bộ helper mới trả HTML đặt tên đúng quy ước BUILDER:
> `createGanttToggleHtml`, `createGanttGroupRowHtml`, `createGanttWorkRowHtml`,
> `createGanttSubRowHtml`, `createGanttTaskRowHtml`, `createGanttTreeHtml`,
> `buildGanttCellHtml` (nhận VĂN BẢN thô, tự escape một lần — caller không escape trước),
> `renderGanttDaysHtml`. Thuộc tính id/class phát sinh (`bodyId`, `domId`, `an`) và mọi số
> đếm/ngày nội suy đều đi qua `escapeHtml`. Hành vi cắt-thanh/ngoài-khoảng/thu-gọn do
> `tests/unit/gantt-ui.test.js` canh.
>
> **Cập nhật 2026-08-26 (tính năng phân công ba lớp).** Modal chi tiết viết lại thành file riêng
> `web/assets/js/project-details.js` (nạp sau app.js, ghi đè `showProjectDetailsModal`) cùng khối
> HTML phân công chèn vào form công việc/nhiệm vụ trong app.js: thêm **3 chỗ ghi HTML** và
> **14 giá trị nội suy** ⇒ **77 chỗ / 555 giá trị**. Helper mới trả HTML đều đặt tên đúng quy ước
> BUILDER: `buildDetailRowHtml`, `buildStatCardHtml`, `createSubworkDetailHtml`,
> `buildSupervisorOptionsHtml`, `buildLeaderCheckboxesHtml`, `buildDeptIdOptions`; mọi id/name
> người dùng nội suy đi qua `escapeHtml`/`escapeHtmlAttr`/`escapeForInlineHandler`. Pin canh bởi
> TC-SEC-17.
>
> **Cập nhật 2026-08-26 (bổ sung — bỏ ô «Quản lý công việc»).** Ô chọn người quản lý trong form
> tạo/sửa công việc bị cắt (thay bằng khối phân công ba lớp): mất **1 chỗ ghi HTML** (select) và
> **5 giá trị nội suy**, đồng thời bớt 1 chỗ cờ `selected` cố ý không bọc (`text3` 3 → 2 chỗ,
> xem TC-SEC-11) ⇒ **77 chỗ / 550 giá trị**. Lưu ý: pin chỉ đếm app.js; chuỗi HTML mới trong
> `project-details.js` chưa thuộc bộ soát này (file ghi đè, sẽ soát riêng khi tách module).
>
> **Cập nhật 2026-08-26 (bẫy COL lần 2 — vẽ lại ô Phòng khi bối cảnh nạp trễ).** Form công việc
> thêm **1 chỗ ghi HTML**: `deptSel.innerHTML = buildDeptIdOptions(…)` trong `createProjectModal`
> — khi mở form trước khi `getDepartmentContext` kịp trả, context về là vẽ lại ô Phòng rồi mới
> nạp phân công (chống ô phòng trống vĩnh viễn). `buildDeptIdOptions` là builder thoát đủ
> (`escapeHtmlAttr` cho id số, `escapeHtml` cho tên phòng), không có giá trị nội suy mới
> ⇒ **78 chỗ / 550 giá trị** (TC-SEC-17).
>
> **Cập nhật 2026-08-26 (6 yêu cầu giao diện — lọc tháng, tạo nhiệm vụ gắn dự án, dòng Phòng).**
> Thêm bộ lọc tháng ở mục Quản lý công việc: ô trống «không có công việc» giờ dựng có điều kiện,
> kèm `escapeHtml(thangDangXem)`; thẻ công việc thêm dòng «Phòng:» với
> `escapeHtml(project[COL.P_DEPT] || "Chưa gán")`; form nhiệm vụ thêm khối «Thuộc dự án»
> (select dựng bằng `.map(...).join("")`, mọi giá trị đi qua `escapeHtml`) và ô Người thực hiện
> ẩn/hiện theo cấp (giá trị hằng do mã sinh). Ô chọn phòng dựng lại bằng builder COL-an-toàn.
> Ròng rã **+1 giá trị nội suy**, số chỗ ghi giữ 78 ⇒ **78 chỗ / 551 giá trị** (TC-SEC-17).
>
> **Cập nhật 2026-08-26 (vòng lần 3 — «Cán bộ trực tiếp»).** Option ứng viên của ô gán người
> trong `createTaskModal` bỏ phần hiển thị email («Tên (email)» → «Tên»): xoá biến trung gian
> `text4` cùng một nội suy `escapeHtml(text4)` ⇒ **78 chỗ / 550 giá trị** (TC-SEC-17, −1 giá trị).
> Nhãn ô đổi thành «Cán bộ trực tiếp», danh sách ứng viên lọc chỉ role `Nhân viên` — không thêm
> HTML mới nào, mọi chuỗi tiếng Việt trong nhãn là hằng số chương trình.
>
> **Cập nhật 2026-08-26 (vòng lần 3 — modal chi tiết cấp 1).** Gộp thông tin phân công thành
> MỘT hàng flex (`buildPhanCongNhomHtml`, builder tự escape MỘT lần, nhận văn bản thô), tên công
> việc con bỏ vào khung riêng, thêm nút bút chì SVG inline theo quyền. Toàn bộ ở
> `web/assets/js/project-details.js` — file này KHÔNG thuộc bộ đếm của TC-SEC-17 (chỉ soát
> `app.js`) nên pin giữ nguyên **78 chỗ / 550 giá trị**; mọi giá trị nội suy mới đều qua
> `escapeHtml` / `escapeForInlineHandler`, sự kiện gắn bằng `addEventListener` (không dùng
> onclick kèm dữ liệu), id dòng trong thuộc tính data-* đã escape.
>
> **Cập nhật 2026-08-26 (Gantt xem theo tháng).** Giao diện Gantt thêm thẻ tooltip tự vẽ cho TÊN
> dòng (`#tooltip-gantt`.innerHTML = `buildGanttHoverCardHtml` — builder escape trực tiếp từng
> trường bằng `escapeHtml`) và ô Năm xoá option trước khi nạp lại; tên công việc/CV con/nhiệm vụ
> nhúng JSON tooltip đã qua `escapeHtmlAttr` một lần (bộ soát ghi 3 giá trị cờ "trong-the" như
> cờ selected) ⇒ **80 chỗ / 566 giá trị** (TC-SEC-17). Bộ Legacy còn lại của Gantt không còn đọc
> hai ô ngày đã bỏ — dom-contract TC-DEAD-02 về trạng thái sạch.
>
> **Cập nhật 2026-08-27 (việc 7.3 — chat qua REST, hỏi lại 10 giây).** `loadChatMessagesAsync`
> chuyển sang `napChatTuServer()` và BỎ nhánh `withFailureHandler` từng ghi "Lỗi tải tin nhắn" vào
> `#chat-messages`: một lượt mạng chập chờn trong vòng hỏi lại 10 giây không được phép xoá khung
> chat người dùng đang đọc (lỗi giờ trả `null` im lặng qua `restGetIm`). Chỗ ghi bỏ đi là HTML
> hằng, không có nội suy ⇒ **79 chỗ / 566 giá trị** (TC-SEC-17). Nội dung tin nhắn vẫn đi qua
> `escapeHtml(formatChatMessage(...))` trong `renderChatMessages` — máy chủ lưu nguyên văn thẻ
> người gõ (TC-MISC-08), nên chỗ thoát duy nhất là chỗ vẽ này; test
> `tests/unit/chat-ui.test.js` chạy app.js thật trong jsdom để chốt.
>
> **Cập nhật 2026-08-27 (tab Nhiệm vụ — lọc Tháng/Năm/Cán bộ/Phòng, gom theo công việc con).**
> `renderTasks` không còn dựng một khối `glass-card` cho mỗi công việc cấp 1; cấp 1 giờ chỉ là dải
> phân cách mỏng (`createTasksWorkSeparatorHtml`) và mỗi CÔNG VIỆC CON là một khối riêng
> (`createTasksSubworkBlockHtml`: mũi tên thu gọn, thư mục đỏ, mã, số nhiệm vụ, trạng thái + tiến độ
> tổng hợp theo đúng luật `ganCayCon`). Hai builder này thoát từng trường một lần
> (`escapeHtml` cho chữ, `escapeHtmlAttr` cho `data-khoi` / `data-project-id` / `data-project-name`),
> không có on* mang dữ liệu; ròng rã **+4 giá trị nội suy**. Ô Năm của tab Nhiệm vụ xoá rỗng option
> trước khi nạp lại — **+1 chỗ ghi HẰNG** (`innerHTML = ""`, đã ghi vào `SINK_DA_SOAT_TAY`)
> ⇒ **80 chỗ / 570 giá trị** (TC-SEC-17). Hai ô ngày cũ (`#tasks-date-filter`,
> `#tasks-date-clear`) bị bỏ ở CẢ index.html và app.js nên dom-contract vẫn sạch.
>
> **Cập nhật 2026-08-27 (ủy quyền có thời hạn — §6 `docs/KE-HOACH-UY-QUYEN.md`).** Modal «Ủy quyền
> của tôi» thêm **3 chỗ ghi HTML**: bảng ủy quyền (`createUyQuyenModal(...)` — hai bảng «tôi giao» /
> «tôi nhận» dựng qua `buildUyQuyenBang` → `buildUyQuyenRow`), khung lỗi trong modal
> (`showUyQuyenError` dựng `<div class="text-red-600 …">` + `escapeHtml(message)`), và **1 chỗ ghi
> HẰNG** xoá rỗng khung lỗi đó (`innerHTML = ""`, `SINK_DA_SOAT_TAY` `""` 7 → 8 chỗ).
> **+18 giá trị nội suy**: tên hai đầu người, hai mốc ngày (`ngayVN`), tên phòng của phạm vi
> (`tenPhongTheoIds`, id lạ thì hiện `#<id>`), nhãn trạng thái + lớp màu, ghi chú, `data-id` /
> `data-nguoi` của nút huỷ, hai giá trị `value` mặc định của `<input type="date">`, và hai nhãn cột
> đổi theo chiều ủy quyền ⇒ **83 chỗ / 588 giá trị** (TC-SEC-17).
>
> Ba điểm đáng nói ở khối này: (a) không có on* nào mang dữ liệu — nút huỷ đọc `dataset.id` /
> `dataset.nguoi` trong listener chứ không nhét id vào `onclick="…"`, nên không cần
> `escapeForInlineHandler`; (b) câu lỗi của MÁY CHỦ (`DELEGATION_OVERLAP`,
> `DELEGATION_SCOPE_TOO_WIDE`…) cũng đi qua `escapeHtml` — chuỗi từ máy chủ vẫn là chuỗi ngoài;
> (c) `tenPhongTheoIds` đọc `allDepartments` (tên phòng do người dùng nhập) nên phải thoát y như
> dữ liệu người dùng. `tests/unit/uy-quyen-ui.test.js` bơm `<img src=x onerror=alert(1)>` vào tên
> người, tên phòng và ghi chú để chốt cả ba đường.
>
> **Cập nhật 2026-08-28 (bộ lọc một dòng + trang «Quản lý tài khoản»).** Tab «Quản lý công việc» đổi
> `<input type="month">` sang hai ô chọn Tháng/Năm giống Sơ đồ Gantt: `dongBoOThangNamProjects` xoá
> rỗng option Năm trước khi nạp lại ⇒ **+1 chỗ ghi HẰNG** (`oNam.innerHTML = ""`). Trang tài khoản
> thêm **2 chỗ ghi**: khung `#account-info` dựng bằng `buildTaiKhoanDong(nhãn, giá trị)` (mỗi ô thoát
> nhãn + giá trị đúng một lần) và nhánh «cần đăng nhập» (chuỗi HẰNG) ⇒ **+2 giá trị nội suy**
> ⇒ **86 chỗ / 590 giá trị** (TC-SEC-17).
>
> Hai điểm đáng nói: (a) form đổi mật khẩu trong trang là markup TĨNH ở `index.html`, ba ô mật khẩu
> đọc bằng `form.elements.X.value` và gửi qua `changePassword(cũ, mới, nhắc lại)` — không có chỗ nào
> dựng HTML từ mật khẩu, và câu lỗi/câu xác nhận đặt bằng `textContent` (`hienLoiTaiKhoan` /
> `hienOkTaiKhoan`) chứ không `innerHTML`; (b) trang KHÔNG in `password` / `password_hash` — chỉ các
> trường `publicUser` trả về, và `tests/unit/tai-khoan-ui.test.js` bơm `<img src=x onerror=alert(1)>`
> vào tên + `"><script>` vào email để chốt, đồng thời khẳng định hai khoá mật khẩu không lọt ra HTML.
> `.thanh-loc` / `.the-tai-khoan` / `.khoi-doc` là CSS thường ở `app.css` (bản tailwind dựng sẵn
> không có `flex-nowrap`, `space-y-4`, `w-32`), không sinh HTML nên không đổi pin.
>
> **Cập nhật 2026-08-28 (phê duyệt ủy quyền — §13.4 mục 17/18/20).** Dòng ủy quyền có thêm hai
> trạng thái («Chờ phê duyệt», «Đã từ chối») và người NHẬN có hai nút «Đồng ý» / «Từ chối». Ba nút
> của bảng (Huỷ/Rút lại, Đồng ý, Từ chối) rút về một hàm dựng `buildUyQuyenNut(lop, mau, icon, nhan,
> id, nguoi)` — thoát `lop|mau|icon|id|nguoi` bằng `escapeHtmlAttr` và `nhan` bằng `escapeHtml`, tức
> **6 chỗ thoát** trong hàm, thay cho **2 chỗ** của nút «Huỷ» viết thẳng trước đây.
> ⇒ **86 chỗ / 597 giá trị** (TC-SEC-17), **+7 giá trị, 0 sink mới**.
>
> Vì sao +7 chứ không phải +4: `tools/dem-xss.mjs` coi mọi hàm tên `^(create|build|render|…)` là hàm
> DỰNG HTML, nên **mỗi lời gọi** `buildUyQuyenNut(...)` trong chuỗi cũng là một "lỗ" nội suy. Ba lời
> gọi + 6 chỗ thoát trong hàm − 2 chỗ thoát bỏ đi = +7. Đếm nhầm chỗ này là dấu hiệu tách hàm dựng
> mà quên rằng bản đếm tính cả biên gọi, không chỉ thân hàm.
>
> Hai điểm đáng nói: (a) `data-nguoi` mang HỌ TÊN người ủy quyền vào thuộc tính rồi đọc lại bằng
> `this.dataset.nguoi` để hỏi `window.confirm` — tên là dữ liệu người dùng nhập nên phải thoát ở lối
> vào thuộc tính, còn lối ra là `confirm` (văn bản thuần, không dựng HTML); (b) năm nhãn trạng thái
> là chuỗi HẰNG chọn theo `row.status`, không nội suy `status` vào HTML — dữ liệu lạ ở cột đó rơi vào
> nhánh mặc định «Chưa/hết hiệu lực» chứ không in ra. `tests/unit/uy-quyen-ui.test.js` (TC-UQ-16)
> chốt cả hai: đúng 5 chỗ thoát cho một dòng `pending` nhận được, và `data-id`/`data-nguoi` phải
> thoát khi tên chứa `"><img src=x onerror=alert(1)>`.

> **Cập nhật 2026-08-28 (ô chọn phòng cho Giám đốc — §13.4 mục 18).** Form «Ủy quyền mới» thêm hàm
> dựng `buildUyQuyenPhamVi()`: một ô `<select name="departmentIds" multiple required>` **chỉ hiện với
> `currentUser.role === "admin"`**, mỗi phòng một `<option>` với `escapeHtmlAttr(id)` +
> `escapeHtml(tên)`, cùng `escapeHtmlAttr` cho `size`.
> ⇒ **86 chỗ / 602 giá trị** (TC-SEC-17), **+5 giá trị, 0 sink mới**: 1 lời gọi
> `buildUyQuyenPhamVi()` trong `createUyQuyenModal`, 1 chỗ `escapeHtmlAttr` cho `size`, 1 lỗ cho cả
> biểu thức `list.map(...)` (bản đếm coi một `.map()` dựng HTML là một lỗ) và 2 chỗ thoát bên trong
> nó (id, tên phòng).
>
> Vì sao chỉ Giám đốc thấy ô này: người thường để phạm vi rỗng thì máy chủ tự suy ra các phòng họ
> đang phụ trách (`department_managers`), nên thêm ô chọn chỉ mời họ đoán RỘNG hơn quyền thật — mà
> máy chủ vẫn chặn (`DELEGATION_SCOPE_TOO_WIDE`), tức đổi một lời từ chối rõ ràng thành một ô nhập
> gây nhầm. Giám đốc thì ngược lại: họ không có dòng `department_managers` nào, nên máy chủ BẮT liệt
> kê phòng (`DELEGATION_ADMIN_SCOPE_REQUIRED`) và không có ô này thì họ không tạo được bản ủy quyền
> nào từ giao diện. Danh sách option là toàn bộ `allDepartments` vì Giám đốc phụ trách mọi phòng;
> phòng nào máy chủ không gửi `ID phòng (DB)` thì bỏ hẳn thay vì sinh `value=""` — cùng cái bẫy COL
> đã gặp ở `buildDeptIdOptions`. `tests/unit/uy-quyen-ui.test.js` (TC-UQ-18, TC-UQ-18b) chốt: vai
> thường không có `name="departmentIds"`; Giám đốc có `multiple` + `required` và option mang id thật;
> tên phòng chứa `<img src=x onerror=alert(1)>` không dựng được thẻ; `taoUyQuyen()` gửi
> `departmentIds` là mảng SỐ, và KHÔNG gửi khoá đó khi form không có ô phòng.

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
  bao, và hai con số 70/481 (474 của việc 4.6 + 5 nhãn vàng của việc 5.6). TC-SEC-18…20 soát
  `tests/fixtures/xss-mau.js` — file có lỗ **đã biết**
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
