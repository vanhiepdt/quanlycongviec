# Nhật ký — Sơ đồ Gantt chuyển sang XEM THEO THÁNG + tooltip thẻ cho tên dòng

> Ngày: **2026-08-26** · Nhánh: `vps/tinh-nang-phan-cong`
> Commit: `3604e34` (server) · `ada4699` (giao diện + test + pin)
> Kết quả: **938/938 test · 56 file** xanh · lint + prettier sạch · pin XSS **80 chỗ / 566 giá trị**.
> Số của **ngày 2026-08-26**, giữ nguyên làm mốc lịch sử. Về sau Phase 7 (2026-08-27) bỏ 1 chỗ ghi
> HTML hằng trong `loadChatMessagesAsync` ⇒ pin hiện tại là **79 chỗ / 566 giá trị**, và test tổng
> là **1085 trong 64 file** — xem `docs/XSS-4.6.md` và `KE-HOACH-VPS.md` §13.2.

## 1. Yêu cầu người dùng (nguyên văn đã chốt)

- Bỏ «Xem 1/2/3 tháng» và «Từ ngày – Đến ngày»; thay bằng chọn **Tháng + Năm**. Chỉ hiện công
  việc có thời gian giao với tháng chọn; vắt sang tháng sau cũng chỉ vẽ tới hết tháng.
- Cùng một cấp thì tên thẳng hàng từ chỗ icon; mũi tên thu gọn của công việc con nằm NGOÀI.
- Rê chuột lên TÊN công việc/CV con/nhiệm vụ → thẻ tooltip tự vẽ (người dùng đã chốt kiểu này):
  công việc = tên đầy đủ · Ban lãnh đạo kiểm soát · Lãnh đạo phòng phụ trách · Cán bộ thực hiện ·
  tiến độ; nhiệm vụ = thêm **Kết quả đầu ra**; đồng thời BỎ chữ cán bộ đứng cạnh tên nhiệm vụ.
- Thanh thời gian dày hơn; ngày/thứ to ra chiếm full màn hình.
- Icon công việc con = giống icon công việc cha nhưng MÀU ĐỎ.

## 2. Server — cây Gantt mang theo dữ liệu phân công (`3604e34`)

| File | Thay đổi |
|---|---|
| `server/src/modules/stats/repo.js` | Hai câu SELECT thêm `w.supervisor_id, w.leader_ids` và `i.leader_ids, i.output` — view `v_countable_*` sau migration 005 đã mở các cột này (SELECT *), KHÔNG đụng schema/view |
| `server/src/modules/gantt/service.js` | Đổi id→tên MỘT lượt qua `users/repo.listByIds` rồi gắn `supervisor_name`/`leader_names` lên dòng; `nutItem` trả thêm `output`, `leaderNames`; `nutWork` trả thêm `supervisorName`, `leaderNames`. Phạm vi/quyền/lọc giao nhau giữ nguyên luật thống kê |

Test mới trong `gantt-api.test.js`: cây phải trả đúng tên Ban kiểm soát/leaders + `output`.

## 3. Giao diện (`ada4699`)

| Yêu cầu | Vị trí |
|---|---|
| Bộ chọn Tháng/Năm | `web/index.html` khối điều khiển Gantt: 2 select `#gantt-month-select` / `#gantt-year-select`; option nạp bằng `dongBoOThangNamGantt()` (tháng 1–12; năm hiện tại −2…+3, luôn chèn năm đang xem) |
| Khoảng = đầu→cuối tháng | `datKhoangGanttTheoThang(tháng, năm)` — thay `datKhoangThangGantt(n×30−1)`; thanh màu tính bằng % nên cắt hai đầu tự đúng (TC-STAT-13 giữ nguyên); server lọc giao nhau `from/to` như cũ nên việc ngoài tháng biến mất khỏi cây |
| Ngày/thứ full màn hình | CSS override cuối `app.css`: `.gantt-day{flex:1 1 0}`, bỏ khoá `min-width:2160px`, số ngày to 15px/đậm, thứ 12px |
| Thanh dày hơn | `.gantt-bar{height:26px; top:50%; translateY(-50%)}` |
| Căn đầu dòng từ icon | Hàng nào cũng mở đầu bằng `<span class="gantt-toggle-slot">` (20px) chứa nút thu gọn HOẶC rỗng ⇒ icon/tên cùng cấp thẳng cột; mũi tên CV con nằm ngoài khối icon+tên đúng yêu cầu. Indent theo cấp đặt trên container: group 0 / work 12px / subwork 36px / task 60px; xoá padding-lệch cũ trong label |
| Icon CV con | `fas fa-folder text-red-500` (trước là `fa-code-branch` xanh) |
| Bỏ chữ cán bộ cạnh tên nhiệm vụ | `createGanttTaskRowHtml`: bỏ span «— assignee»; thông tin chuyển vào tooltip |
| Tooltip thẻ tự vẽ | Builder `buildGanttHoverCardHtml` (escape trực tiếp từng trường) + `duLieuHoverGantt` chuẩn hoá dữ liệu (công việc gom cán bộ DUY NHẤT qua `gomCanBoThucHienGantt`); JSON nhúng vào thuộc tính `data-hover-json` đã qua `escapeHtmlAttr`; listener delegate gắn MỘT lần lên `#gantt-items` (`goiNutHoverGantt`, chống double-bind bằng dataset) |
| Dấu phiên bản | banner `[QLCV] app.js 20260826-70` (app.js dòng 9) + cache-buster `app.js?v=20260826-70` |

Không đụng: schema/migration, view, luật nguồn `assignments`, RPC bridge, Phase 7.

## 4. Test & pin

- `tests/unit/gantt-ui.test.js` viết lại: giữ TC-STAT-13/14/15; thêm khoảng tháng (29/02/2028 nhuận,
  31/01/2026, sai tháng/năm không đổi khoảng), nạp option 2 ô chọn, icon đỏ, slot trước icon,
  rời chữ cán bộ khỏi tên nhiệm vụ (JSON tooltip vẫn mang đủ), tooltip đủ trường & escape.
- `tests/integration/gantt-api.test.js` +1 test khoá enrichment server.
- Pin XSS đo lại `tools/dem-xss.mjs`: **sink 80 / giá trị 566** (tc TC-SEC-17 đã bump kèm lý do;
  `docs/XSS-4.6.md` ghi mục cập nhật). Lý do tăng: +1 sink innerHTML của tooltip (builder thoát
  đủ), +1 sink xoá rỗng option Năm, 3 giá trị JSON "trong-the", các nhãn thẻ escape trực tiếp.
- dom-contract về sạch: bản Legacy Gantt không còn đọc 2 id ô ngày đã bỏ.

## 5. Bẫy gặp trong vòng này (đã ghi thêm §13.5 KE-HOACH-VPS.md)

| Bẫy | Xử lý |
|---|---|
| **Editor truncate `new_text` giữa chừng** khi chèn khối dài: diff hiển thị dòng cuối bị cụt (`.setH`) mà tưởng chỉ là hiển thị ⇒ file vỡ cú pháp ngay tại chỗ chèn | SAU MỖI lần sửa app.js/subwork lớn phải `node --check` NGAY trước khi sang việc khác; chèn khối dài thì tách nhiều lần nhỏ (<60 dòng/lần) như bài học cũ, đừng tin diff thoáng qua |
| Helper tự viết chứa escape bên trong (vd `hang()`, `hoverJsonAttr()`) khiến bộ soát XSS coi mọi gọi là CHƯA thoát (nó chỉ nhận diện `escapeHtml*`/`safeUrl` chuẩn) | Đừng bọc logic escape vào hàm lạ khi dựng HTML: escape TRỰC TIẾP tại call-site hoặc tính ra biến đã-thoát có tên rõ nghĩa rồi ghép chuỗi |
| id bị xoá khỏi index.html nhưng code LEGACY còn `getElementById` đọc ⇒ dom-contract đỏ dù listener đã gỡ sạch | Khi bỏ element, grep lại TOÀN bộ app.js cả vùng dead-code để xoá luôn chỗ đọc id |
