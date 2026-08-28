# Tên theo tháng cho đầu việc dài hơn một tháng

Yêu cầu gốc (2026-08-28, nguyên văn của người dùng):

> Các công việc, nhiệm vụ mà thời gian nhiều hơn 1 tháng thì có chức năng sửa tên của công việc
> trong các tháng tiếp theo, khi xem thông tin công việc theo tháng nào thì sẽ hiển thị tên đã sửa
> của công việc, nhiệm vụ theo tháng đấy kể cả trên sơ đồ Gantt, nếu ko sửa thì mặc định vẫn tên
> vậy (cái này áp dụng cho công việc cha và công việc con và cả nhiệm vụ) nhưng tháng sau khi được
> đổi tên thì khi di chuột vào công việc đấy sẽ hiển thị tên cũ.

## 1. Tách yêu cầu thành luật kiểm được

| Mã  | Luật                                                                                              |
| --- | ------------------------------------------------------------------------------------------------- |
| R1  | Chỉ đầu việc **dài hơn một tháng** (tháng bắt đầu ≠ tháng kết thúc) mới có chức năng này.          |
| R2  | Sửa tên theo **từng tháng SAU**. Tháng ĐẦU không có ô sửa — tên tháng đầu chính là tên gốc.        |
| R3  | Xem tháng nào thì hiện tên của tháng đó, **kể cả trên Sơ đồ Gantt**.                               |
| R4  | Tháng không đặt tên riêng ⇒ dùng tên gốc (và «Tất cả tháng» cũng luôn dùng tên gốc).               |
| R5  | Áp dụng cho cả 3 cấp: công việc (cấp 1), công việc con (cấp 2), nhiệm vụ (cấp 3).                  |
| R6  | Tháng đã đổi tên ⇒ **di chuột vào hiện TÊN CŨ** (tên gốc).                                         |

Ba mặt màn hình có «đang xem một tháng» nên phải đổi tên theo tháng: tab «Quản lý công việc», tab
«Quản lý Nhiệm vụ», và Sơ đồ Gantt.

Cố ý KHÔNG đổi: Tổng quan, thống kê, biểu đồ, xuất Excel, tìm kiếm, và ô «Tên» của form Sửa. Những
chỗ này không có một tháng nào đang xem, đổi tên ở đó là đổi mất mốc nhận dạng của đầu việc. Riêng ô
«Tên» của form Sửa phải giữ TÊN GỐC, vì form điền sẵn rồi bấm Lưu — nhét tên tháng vào đó là một lần
bấm Lưu thành đổi tên gốc.

## 2. Vì sao một BẢNG RIÊNG chứ không phải cột jsonb

1. Gantt đọc qua `stats/repo.js QUERIES.works|items` — hai chuỗi cột đã bị `countable-views.test.js`
   ghim bằng EXPLAIN, thêm cột vào bảng gốc là phải sửa hai chuỗi đó.
2. Cấp 1 nằm ở `works`, cấp 2/3 nằm ở `work_items` ⇒ hai khoá ngoài rỗng-được + CHECK «đúng một
   đích» cho CASCADE thật khi xoá đầu việc.
3. Đặt tên một tháng là một UPDATE một dòng, không phải đọc-sửa-ghi cả khối jsonb (tránh đua ghi).

## 3. Việc đã làm

### Vòng 1 — nền (commit `1e48a23`)

| Việc | Nơi                                                                                       |
| ---- | ----------------------------------------------------------------------------------------- |
| A1   | `server/src/db/migrations/008_work_month_names.sql` — bảng `work_month_names`, 2 chỉ mục duy nhất RIÊNG PHẦN (NULL của Postgres là phân biệt nên một UNIQUE 3 cột không chặn được trùng), CHECK dạng tháng + tên không rỗng, trigger `set_updated_at`. |
| A2   | `server/tests/helpers/db.js` — thêm `work_month_names` vào `BUSINESS_TABLES` (schema.test.js ghim `length + 1`). |
| A3   | `server/src/utils/monthNames.js` — tiện ích THUẦN: `thangCua`, `thangCuaKhoang` (chặn 240 tháng), `nhieuThangHonMot`, `thangSuaDuoc`, `khoaThang`, `banDoTenThang`, `ganTenThang`, `tenTheoThang`, `tenGocNeuDaDoi`. |
| A4   | `server/src/modules/workMonthNames/repo.js` — `listForWorks/listForItems/findOne/upsert/remove`; `ON CONFLICT` phải gọi tên chỉ mục riêng phần. |
| A5   | `server/tests/unit/ten-thang.test.js` — TC-TENTHANG-01…12. |

### Vòng 2 — API + ba đường đọc (commit `abf93df`)

| Việc | Nơi                                                                                       |
| ---- | ----------------------------------------------------------------------------------------- |
| A6   | `utils/errors.js` — `MONTH_OUT_OF_RANGE`, `MONTH_IS_FIRST` (cùng 400).                     |
| A7   | `modules/workMonthNames/service.js` — `thangTuDuongDan`, `assertThangDatDuoc`, `khoangCuaDong`, `thangDatDuocCuaDong`. Dùng CHUNG cho cả 3 cấp: luật tháng giống nhau, chỉ luật quyền là khác. |
| A8   | `works/service.js` + `routes.js` — `PUT/DELETE /api/v1/works/:id/month-names/:month`; quyền đúng bằng quyền SỬA công việc, không thêm quyền mới. |
| A9   | `workItems/service.js` + `routes.js` — cặp endpoint tương ứng cho cấp 2/3. |
| A10  | `bootstrap/service.js`, `gantt/service.js`, `rpc/legacyFields.js` — gắn `monthNames` vào ba đường đọc; `COL.P_NAME`/`COL.T_NAME` vẫn là TÊN GỐC. |
| A11  | `tests/integration/ten-thang-api.test.js` — TC-TENTHANG-13…24. |

### Vòng 3 — trình duyệt (commit này)

| Việc | Nơi                                                                                       |
| ---- | ----------------------------------------------------------------------------------------- |
| B11  | `app.js` — tiện ích thuần `thangCuaNgay`, `cacThangCuaDauViec`, `thangSuaDuocCuaDauViec`, `tenTheoThangCuaDong`, `tenGocNeuDaDoiCuaDong`. |
| B12  | Tab thứ ba «Tên theo tháng» trong modal Sửa (cả 3 cấp): `buildBangTenThang` + `luuTenThang`/`xoaTenThang` qua `restGhi`. |
| B13  | Tên theo tháng ở tab Công việc (`createProjectCard`, dải phân cách) và tab Nhiệm vụ (`createTaskTableRowSimple`, đầu khối cấp 2). |
| B14  | Tên theo tháng trên Gantt: 3 hàm dựng hàng + nhãn thanh; `duLieuHoverGantt(dong, thang)` thêm `tenGoc`, thẻ tooltip in dòng «Tên gốc». |
| B15  | Nhãn nhật ký: `works.setMonthName`/`clearMonthName`, `workItems.setMonthName`/`clearMonthName`. |
| C18  | `server/tests/unit/ten-thang-ui.test.js` (jsdom) — TC-TENTHANG-25… |

## 4. Chỗ dễ sai đã ghi lại

- Hai tab nạp dữ liệu MỘT lần (`allProjects`/`allTasks`) rồi lọc tháng ở trình duyệt, không gọi lại
  API ⇒ bản đồ tên tháng phải đi KÈM từng dòng (`monthNames`), không thể hỏi máy chủ theo tháng.
- Gantt không đi qua `works.list` (nó đọc `v_countable_*` qua `taiDuLieuDem`) nên `gantt/service.js`
  phải tự truy vấn tên tháng.
- Máy chủ KHÔNG tự chọn tên tháng thay trình duyệt: một lần gọi `/api/v1/gantt` có thể trải nhiều
  tháng (`from`/`to`), chỉ màn hình mới biết đang xem tháng nào.
- `escapeHtml`/`escapeHtmlAttr`/`escapeForInlineHandler` viết THẲNG tại lỗ nội suy (TC-SEC-18 không
  nhận biến trung gian).
