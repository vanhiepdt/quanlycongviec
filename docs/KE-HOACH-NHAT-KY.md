# Kế hoạch — Nhật ký từng lần chỉnh sửa (3 cấp)

Yêu cầu: mỗi lần chỉnh sửa **công việc** (cấp 1), **công việc con** (cấp 2), **nhiệm vụ** (cấp 3)
đều có nhật ký; công việc cha hiện **tất cả** nhật ký của công việc con và nhiệm vụ dưới nó; nhật ký
nằm ngay trong **tab chỉnh sửa** của cả ba cấp.

## 1. Đã có sẵn (không làm lại)

| Thứ | Ở đâu |
| --- | --- |
| Ghi nhật ký mỗi lần sửa | `res.locals.audit` (route) → `middleware/audit.js` → `activityLogs/repo.writeLog` |
| `{ cột: { from, to } }` từng lần sửa | `diffRows()` trong `utils/origin.js`, service trả về khoá `changes` |
| Đọc nhật ký một đầu việc | `GET /api/v1/works/:ref/history`, `GET /api/v1/work-items/:ref/history` |
| Cột gom cây | `activity_logs.work_id` — create/update/copy/reminders/approvals đều đã điền |

Thiếu: (a) không có cách lấy nhật ký **cả cây** của một công việc; (b) dòng xoá công việc con /
nhiệm vụ không điền `entity_id`, `work_id` và ghi cứng `entity_type='task'` nên không gom được;
(c) **giao diện chưa có chỗ nào** hiện nhật ký.

## 2. Máy chủ

1. `activityLogs/repo.js`:
   - `listForWorkTree({ workId, limit })` — `work_id = $1 OR (entity_type='work' AND entity_id=$1)`.
     Điều kiện thứ hai để không mất dòng nào của chính công việc nếu `work_id` bỏ trống.
   - `listByEntities({ entityTypes, entityIds, limit })` — cho cây của một công việc con.
   - Cả hai `ORDER BY id` (cũ trước) như `listByEntity`, chặn trên 1000 dòng.
2. `?scope=self|tree` cho cả hai route `/:id/history`. **`self` là mặc định** (giữ nguyên hành vi
   cũ cho mọi thứ đang gọi), giao diện luôn xin `tree`.
   - cấp 1 `tree` → cả cây; cấp 2 `tree` → chính nó + các nhiệm vụ con; cấp 3 → `tree` = `self`.
3. `utils/nhatKy.js` — `ganNhanDauViec(entries, danhMuc)`: gắn thêm `ref { kind, level, code, name }`
   vào từng dòng dựa trên `entity_type`/`entity_id`, để giao diện không phải tự tra tên.
4. Sửa lỗ hổng xoá: `workItems/service.remove` trả thêm `deletedId/deletedLevel/deletedWorkId`;
   route `DELETE /work-items/:id` điền `entityType` theo cấp + `entityId` + `workId`.

Giới hạn đã biết: cháu bị xoá cùng cha không còn trong bảng nên nhật ký của nó chỉ gom được qua
`work_id` (cấp 1 thấy, cấp 2 thì các dòng cũ trước bản này không thấy) — chấp nhận, không dựng lại.

## 3. Giao diện (`web/assets/js/app.js`)

- Bảng nhãn tiếng Việt: `NHAT_KY_HANH_DONG` (action → nhãn + icon), `NHAT_KY_COT` (tên cột → nhãn).
- `dinhDangGiaTriNhatKy(cot, giaTri)` — ngày về `dd/mm/yyyy`, rỗng/null → «(trống)», mảng → nối dấu
  phẩy, `*_id` → tên người/phòng nếu tra được.
- `buildNhatKyDong(entry)` / `renderNhatKy(hostId, data)` / `napNhatKy(...)` — gọi `restGet` khi bấm
  tab, mọi giá trị qua `escapeHtml`/`escapeHtmlAttr`.
- Hai tab «Thông tin | Nhật ký» chỉ hiện khi **đang sửa**: `#project-modal` (cấp 1) và `#task-modal`
  (cấp 2 và 3). Đổi tab = bật/tắt `hidden`, không dựng lại modal.

## 4. Kiểm thử

- unit `nhat-ky-refs.test.js` — `ganNhanDauViec` (hàm thuần).
- integration `work-history-tree.test.js` — cấp 1 gom đủ 3 cấp, `scope=self` không đổi, cấp 2 gom
  con, cấp 3 = self, người ngoài phạm vi bị 403, dòng xoá có `entity_id`/`work_id`.
- jsdom `nhat-ky-ui.test.js` — đổi tab, nhãn tiếng Việt, «(trống)», rỗng, thoát HTML tên có thẻ.
