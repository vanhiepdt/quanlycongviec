# Nhật ký — MÀN HÌNH DUYỆT «Chờ duyệt» + hiện người duyệt (2026-08-28)

> Nhánh: `vps/quan-ly-nhiem-vu-pgd` · Kết thúc: **1330/1330 test · 78 file** xanh · lint +
> prettier sạch · pin XSS **92 chỗ / 668 giá trị** (`tools/dem-xss.mjs` đo lại, TC-SEC-17 đã bump).
> Buster: `app.js?v=20260828-87` (banner `-87`), `app.css?v=20260828-5`,
> `project-details.js?v=20260828-1`.

## 1. Vấn đề người dùng báo

«Quyết toán chi phí đào tạo quý 3 (CV004) đang chờ duyệt nhưng không biết **ai là người duyệt**,
cũng không biết **màn hình duyệt ở đâu**».

Điều tra: luồng duyệt phía **máy chủ đã đủ từ Phase 5** — `server/src/modules/approvals/` với
`GET /api/v1/approvals/pending` (danh sách theo phạm vi người xem), `/pending-count`,
`POST /approvals/:entity/:id/{submit,approve,reject}` (từ chối bắt buộc lý do ≥ 10 ký tự).
Quyền duyệt: **admin + Phó Giám đốc (chỉ các phòng mình quản lý)** — `can(user,'approve',…)` +
`managedDepartmentIds`. Client thì: chỉ có nhãn vàng «Chờ duyệt» (title cứng «Đang chờ Phó Giám
đốc duyệt», không tên người duyệt), và **không một dòng nào gọi `/approvals/*`** ⇒ có API không
có màn hình ⇒ việc chờ duyệt "treo" mãi mà không ai biết xử ở đâu.

## 2. Đã làm (phía client, server giữ nguyên)

| # | Thay đổi | Vị trí |
|---|---|---|
| 1 | **Panel «Chờ duyệt»** trong tab Quản lý công việc | `web/index.html` dòng ~716: `#approvals-panel` (tiêu đề + đếm + nút Tải lại + `#approvals-list`) |
| 2 | Nạp danh sách + vẽ | `renderChoDuyetPanel()` (app.js ~5538): gọi `GET /api/v1/approvals/pending`; **chỉ hiện panel cho admin / Phó Giám đốc** (`laNguoiDuyetHeThong()` ~5500), người khác giữ nhãn vàng ở danh sách như cũ |
| 3 | Dòng việc chờ duyệt | builder `buildPendingApprovalRowHtml` (~5505): loại (Công việc/CV con) · tên · mã · **người gửi** · nút Duyệt / Từ chối (xổ ô nhập lý do) — mọi giá trị escape |
| 4 | Hành động | `duyetMucChoDuyet` / `tuChoiMucChoDuyet` (~5558/5570): POST approve/reject (lý do < 10 ký tự bị chặn ở client, máy chủ kiểm tra lại); xong tự nạp lại panel + danh sách; listener delegate gắn MỘT lần `goiNutChoDuyetPanel` (~5584) + nút Tải lại |
| 5 | REST POST + CSRF | `restPost()` + `layTokenCsrfChoPost()` (~5452/5469): đọc cookie `_csrf`, chưa có thì `GET /api/csrf`; header `X-CSRF-Token` như cầu RPC |
| 6 | **Hiện ai duyệt** | `pendingApprovalBadge` (~2964): title ghép tên người duyệt từ `COL.P_APPROVER` (do máy chủ map `approver_id` → tên); modal chi tiết thêm khối «Trạng thái duyệt / Người duyệt / Lý do từ chối» qua `buildPhanCongApprovalRowsHtml` (project-details.js ~32, chèn vào lưới chi tiết dòng 247) |
| 7 | Gắn vào tab | `switchSection` (dòng 891) và nhánh đổi-phòng-của-PGĐ (dòng 235): vào tab «Công việc» là nạp panel |
| 8 | Phiên bản | banner `20260828-87` (đã có), buster `app.js 20260828-87`, **`project-details.js?v=20260828-1`** (mới bump) |

«CV004 ai duyệt?» — trả lời bằng chính UI: mở chi tiết CV004 (hoặc rê nhãn vàng) là thấy
**Người duyệt = Phó Giám đốc phụ trách phòng của CV004** (hoặc admin); người đó vào tab
«Quản lý công việc» sẽ thấy panel «Chờ duyệt» có CV004 kèm nút Duyệt/Từ chối.

## 3. Test & pin

- `server/tests/unit/approvals-ui.test.js` (mới, 5 test): builder đủ trường/escape; panel ẩn với
  Nhân viên; bấm Duyệt ⇒ `POST /approvals/work/CV004/approve`; Từ chối lý do < 10 ký tự bị chặn
  ở client, đủ lý do ⇒ POST `/reject` kèm body. eslint thêm global + file vào nhóm jsdom.
- Pin XSS đo lại: **92 chỗ / 668 giá trị** (+2 sink: `#approvals-list`.innerHTML builder-thoát-đủ
  và spinner render; +6 giá trị escape trong builder) — TC-SEC-17 đã bump, xss-guard 11/11.
- Toàn bộ: **1330/1330 test · 78 file** xanh; lint + prettier sạch.
- project-details.js có một **thân hàm từng bị thiếu** (`buildPhanCongApprovalRowsHtml` chỉ có
  lời gọi) — đã bổ sung; nếu thiếu, mở modal chi tiết sẽ crash `ReferenceError`.

## 4. Việc còn lại / lưu ý

- Lỗi `403 /api/rpc/getDataForUser` trong Console là **chuyện khác**: cầu RPC bootstrap bị từ
  chối trên môi trường đang xem (phiên đăng nhập hoặc server cũ) — Gantt/Nhiệm vụ/duyệt đi qua
  REST nên không ảnh hưởng màn hình duyệt; cần theo dõi riêng nếu các khối khác trống dữ liệu.
- Deploy: đồng bộ `web/` + `server/src/` (duyệt đã có sẵn phía server từ Phase 5) và restart.
