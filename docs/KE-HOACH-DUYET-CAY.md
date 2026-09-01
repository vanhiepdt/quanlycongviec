# KẾ HOẠCH — LUỒNG NHÁP → GỬI DUYỆT CẢ CÂY → DUYỆT CẢ CÂY (Vòng 13, ĐỢT 1/2)

Yêu cầu người dùng (2026-08-31), nguyên văn 6 việc:

1. Thêm phần **duyệt nhiệm vụ (cấp 3)** của cán bộ.
2. Thêm phần **Chờ duyệt cho cán bộ** đối với Xoá công việc cấp 1, cấp 2, nhiệm vụ cấp 3.
3. Phần duyệt thêm **xem chi tiết công việc** (cấp 1, cấp 2, nhiệm vụ): người tạo tạo luôn cả cây,
   màn duyệt có nút xem chi tiết tất cả công việc con + nhiệm vụ bên trong. **Duyệt công việc cha
   là duyệt tất cả** con cháu, không hiển thị chúng ra ngoài nữa.
4. Phần tạo mới công việc cấp 1 thêm **nút Lưu** (lưu thôi, chưa gửi duyệt, chưa được tính là công
   việc), cho sửa chữa, xem lại rồi gửi đi duyệt.
5. Công việc cấp 2 tạo sau khi cấp 1 đã duyệt thì trên màn duyệt hiện là **«Công việc con»**, di
   chuột hiện **tên công việc cấp 1**. Màn xem chi tiết hiện cấp 1 + cấp 2; mục cấp 2 đang chờ
   duyệt hiện **màu khác + chữ «đang chờ duyệt»**; **các màn này không cho sửa**.
6. Tương tự cho nhiệm vụ cấp 3.

Bổ sung giữa session: «cho phép 1 option nữa là chỉnh sửa, còn **từ chối là xóa tất cả** con và
nhiệm vụ».

**Đã chốt tách 2 đợt.** Tài liệu này là ĐỢT 1 (việc 3, 4, 5, 6 + nút Trả lại để sửa).
**ĐỢT 2 (session sau): việc 1 (duyệt cấp 3) và việc 2 (luồng yêu cầu xoá 3 cấp).**

## 1. Bảy quyết định đã hỏi và chốt với người dùng

| # | Câu hỏi | Người dùng chốt |
|---|---|---|
| 1 | Nháp áp cho cấp nào? | **Cả 3 cấp** |
| 2 | Ai thấy bản nháp? | **Chỉ người tạo + admin** |
| 3 | Bấm «Gửi duyệt» gửi những gì? | **Một nút ở cấp 1, gửi CẢ CÂY** ⇒ màn duyệt hiện MỘT dòng |
| 4 | Từ chối công việc cha thì sao? | **XOÁ HẲN cả cha và con cháu** (đã xác nhận rõ là xoá vĩnh viễn) |
| 5 | Nút thứ ba «Chỉnh sửa» làm gì? | **Trả lại cho người tạo sửa** — cả cây về Nháp, không mất dữ liệu |
| 6 | «Xem chi tiết» mở gì? | **Dùng lại modal chi tiết, khoá chỉ-đọc** |
| 7 | Nháp hiện ở đâu? | **Trong tab Công việc, nhãn xám «Nháp»** (không thêm khung mới) |

Hai câu cho ĐỢT 2 cũng đã chốt sẵn: duyệt cấp 3 **thêm một hàng mới vào Bảng phân quyền** (mặc
định ✕ cho TP/PP, admin tự bật); duyệt yêu cầu xoá cũng **thêm hàng riêng** trong bảng đó.

## 2. Trạng thái thứ tư: `Nháp` (migration 012)

`approval_status` từ 3 giá trị lên 4: `Nháp` · `Chờ duyệt` · `Đã duyệt` · `Từ chối`.

| Điều | Chi tiết |
|---|---|
| CHECK | Nới ở **cả** `works` và `work_items`. Tên ràng buộc là tên Postgres tự đặt (`works_approval_status_check`) — đã soi `pg_constraint` để lấy đúng, không đoán |
| Down | **Hạ dữ liệu trước khi siết CHECK**: `UPDATE … SET approval_status='Chờ duyệt' WHERE ='Nháp'`. Không làm thế thì câu `ALTER` nổ và lượt down đứt giữa. Đã thử `migrate:down` + `up` lại, sạch |
| Hai view | `v_countable_works` / `v_countable_items`: `<> 'Chờ duyệt'` → `NOT IN ('Chờ duyệt','Nháp')`, cả ở nhánh cha/ông. **Đây là chỗ DUY NHẤT phải sửa** để nháp không vào bất kỳ con số nào — đúng thiết kế của 004; đi thêm `AND approval_status <> 'Nháp'` ở từng chỗ đếm là quay về cách làm của bản Apps Script (~20 chỗ, không kiểm được là đã đủ) |
| Chỉ mục | `idx_work_items_pending` nới sang cả `'Nháp'` |
| zod | `KHOA_DUYET` (`utils/zodTypes.js`) thêm `'Nháp'` |

**Nháp khác Chờ duyệt ở chỗ AI THẤY**, không phải ở chỗ có đếm hay không:
`Nháp` chỉ người lập + admin thấy, **không** vào hộp chờ duyệt (chưa ai được yêu cầu ký gì);
`Chờ duyệt` cả phòng thấy kèm nhãn vàng, người duyệt thấy trong hộp chờ duyệt.

## 3. Nguồn sự thật mới: `thayDuocNhap` (approvals/rules.js)

Câu «ai thấy nháp» viết **một lần**, và **bốn đường đọc** đều gọi nó sau `can()`:

| Đường | Chỗ gọi |
|---|---|
| `GET /works` | `works/service.list` |
| `GET /works/tree` | `works/tree.getTree` (lọc cả cấp 1 và các dòng con) |
| `GET /work-items` | `workItems/service.list` (chặn cả ở cấp 1 để không nói «có bản nháp tên này») |
| `/bootstrap` + cầu RPC `getDataForUser` | `bootstrap/service.cayChoUser` — đường duy nhất bắt được dòng cấp 2/3 để nháp RIÊNG trong một công việc đã duyệt |
| Đọc thẳng theo mã | `works/service.getOne`, `workItems/service.getOne` — trả **404**, không 403: nói «có bản nháp mà bạn không được xem» đã là tiết lộ |

Bỏ sót một đường là nháp rò ra cho cả phòng — **lỗi im lặng**, không có exception nào, chỉ có dữ
liệu chưa xong hiện ở chỗ không nên hiện. Đó là lý do `nhap-api.test.js` kiểm đủ cả bốn.

Ai SỬA nháp: `coSuaDuocKhiChoDuyet` mở rộng — **chặt hơn** «Chờ duyệt». Phó Giám đốc phụ trách
phòng sửa được mục «Chờ duyệt» nhưng **không** sửa được bản nháp của người khác.

## 4. Ba luồng lan cây (approvals/service.js)

Một helper chung `ghiKhoaDuyetCaCay(target, patch, tuTrangThai, client)`: đổi khoá duyệt cho mục
này + mọi dòng dưới nó, **nhưng chỉ những dòng đang ở một trong `tuTrangThai`**. Nhờ tham số đó mà
ba luồng dùng chung một hàm mà không luồng nào đụng vào dòng nó không nên đụng:

| Hành động | Kéo theo dòng đang | Vì sao |
|---|---|---|
| `submit` (gửi duyệt) | `Nháp`, `Từ chối` | Mục đã duyệt từ trước (công việc con thêm sau, rồi cha bị trả lại) không bị hạ xuống lại |
| `approve` (duyệt) | `Chờ duyệt` | Mục đã duyệt giữ nguyên `approver_id`/`approved_at` của lần ký cũ — không ghi lại tên người duyệt mới |
| `traLaiDeSua` | `Chờ duyệt`, `Đã duyệt`, `Từ chối` | Cả cây phải về tay người tạo; để lại một mục «Đã duyệt» giữa cây nháp thì nó vẫn vào thống kê trong khi cha đã rút khỏi luồng duyệt |

**`reject` = XOÁ HẲN** (`tuChoiVaXoaCay`): thông báo cho người tạo gửi **TRƯỚC** khi xoá — sau khi
xoá không còn dòng nào để đọc `created_by`, và `ref_id` trỏ vào id đã mất là liên kết chết nên
`refType`/`refId` để rỗng. Phần xoá con cháu do `ON DELETE CASCADE` của CSDL lo.

`repo.listPending` **chỉ trả GỐC cây**: dòng cấp 2/3 nào có cha (cấp 1 hoặc công việc con) cũng
đang `Chờ duyệt` thì bị loại — đúng ý «không hiển thị công việc, nhiệm vụ đấy ra bên ngoài nữa».
Badge (`countPending`) **vẫn đếm đủ** mọi dòng: nó trả lời «còn bao nhiêu mục phải xử», khác câu
hỏi của danh sách là «còn bao nhiêu việc phải bấm». Kèm `work_name` cho tooltip của dòng gửi lẻ.

**Luật cũ bị thay:** comment mục 2 ở đầu `approvals/service.js` nói «duyệt KHÔNG lan xuống cây»
(lý lẽ: người duyệt cấp 1 chưa chắc đọc từng mục con nên tự duyệt hộ là ký thay). Nay cả cây được
GỬI cùng một lần và người duyệt có nút «Xem chi tiết» đọc hết trước khi ký, nên một quyết định cho
cả cây mới đúng việc thật. `TC-APR-16` đã viết lại theo luật mới.

## 5. Giao diện

| Chỗ | Việc |
|---|---|
| `laNhap()` + `nhapBadge()` (app.js) | Nhãn **xám** «Nháp» + nút «Gửi duyệt» trên thẻ công việc và dải cấp 1 của tab Nhiệm vụ. Xám ≠ vàng có ý: vàng = «đang chờ ai đó», xám = «chưa gửi cho ai» |
| `isCountableRow()` | Loại nháp y như «Chờ duyệt», ở cả dòng của chính nó và cả nhánh trên — bản đối chiếu client của hai view |
| `buildLuuNhapNutHtml(isEdit)` | Nút «Lưu nháp» cạnh nút chính, **chỉ khi TẠO MỚI**. Form SỬA không có: mục đã gửi đi thì đường về nháp là «Trả lại để sửa» của người duyệt |
| `openModal` | Cả hai nút đều `type="submit"` của CÙNG form nên trình duyệt không nói nút nào; bắt bằng listener `click` đặt cờ `dataset.luuNhap` (jsdom không dựng `event.submitter`) |
| `buildPendingApprovalRowHtml` | Bốn nút: **Xem chi tiết** / Duyệt / **Trả lại để sửa** / Từ chối. Dòng cấp 2/3 mang `title` = tên công việc cấp 1 |
| Từ chối | Có bước **hỏi lại** (`confirm`) nói rõ «XOÁ HẲN … Không thể phục hồi» — xoá không lấy lại được |
| `cheDoDuyetChiDoc` (cờ) | `laCheDoDuyetChiDoc()` / `moChiTietCheDoDuyet()`. Là cờ toàn cục vì modal dựng ở `project-details.js` và gọi xuống nhiều builder con; luồn tham số qua từng tầng phải sửa mọi chữ ký chỉ để trả lời một câu hỏi. **Tự tắt khi modal đóng** — không tắt thì lần mở sau bằng đường thường vẫn mất nút sửa |
| `project-details.js` | `chiDocDuyet()` tắt icon ✎ + hai nút thêm; dải nhắc «Đang xem để DUYỆT — chỉ đọc»; khối CV con **chờ duyệt tô khung VÀNG** + nhãn «đang chờ duyệt», khối **Nháp** khung xám |
| `app.css` | `.status-draft` (xám, viền gạch) ⇒ bump `app.css?v=` |

Banner `app.js 20260831-1`; buster cả ba file (`app.js`, `project-details.js`, `app.css`).
Pin XSS: **96 chỗ / 715 giá trị** (+17, không thêm chỗ ghi HTML nào) — chi tiết ở `docs/XSS-4.6.md`.

## 6. Test

| File | Nội dung |
|---|---|
| `tests/integration/nhap-api.test.js` (**mới**) | TC-NHAP-01..09: bốn đường đọc, nháp không vào `/stats/summary` và `/gantt`, ai sửa/xoá, `saveAsDraft` không phải đường tự đặt khoá duyệt |
| `approvals-api.test.js` | **TC-APR-16 viết lại** (duyệt cha ⇒ cả cây; mục đã duyệt không bị ghi lại người duyệt), TC-APR-09 (từ chối ⇒ cả cây mất khỏi CSDL, thông báo vẫn tới), TC-APR-17..19 (nháp, gửi cả cây ⇒ hộp duyệt một dòng, trả lại để sửa, quyền + 409) |
| `countable-views.test.js` | 4 ca mới: nháp bị loại khỏi cả hai view, kể cả nhiệm vụ cấp 3 «Đã duyệt» nằm dưới cây nháp |
| `approval-pending-lock.test.js` | Ca «bị từ chối vẫn sửa được» đổi sang «được trả lại ⇒ về Nháp, chỉ NGƯỜI LẬP sửa được» |
| `approvals-ui.test.js` | Bước hỏi lại khi Từ chối: bấm OK ⇒ gọi REST, bấm Huỷ ⇒ **không** gọi |
| `project-details-phan-cong.test.js` | TC-DUYET-UI-01..05: chế độ duyệt ⇒ 0 nút sửa/thêm, có dải nhắc, CV con chờ duyệt tô màu khác + chữ, cả cây vẫn hiện, đóng modal thì tắt cờ |
| `bo-loc-cong-viec.test.js` | TC-CV-NHAP-01..04: thẻ nháp có nhãn + nút Gửi duyệt, mục khác không có, nháp không được đếm |

## 8. ĐỢT 2 — ĐÃ XONG (2026-09-01): duyệt nhiệm vụ cấp 3 + luồng yêu cầu xoá

Hai việc «còn nợ» của mục 7 (đã xoá vì làm xong), giữ nguyên 6 quyết định ở mục 1:

| Thành phần | Đã làm |
|---|---|
| Migration `013_delete_request.sql` | `works`/`work_items` thêm 3 cột `xoa_yeu_cau_boi`/`xoa_yeu_cau_luc`/`xoa_ly_do` + 2 chỉ mục một phần `WHERE xoa_yeu_cau_boi IS NOT NULL`; **hai view `v_countable_*` dựng lại trong CÙNG migration** (dựng bằng `SELECT *` nên Postgres đóng băng danh sách cột lúc tạo — thêm cột mà không dựng lại thì view trả thiếu cột); up/down/up sạch trên cả 2 CSDL |
| `approvals/rules.js` | `xoaDuocKhongKhiChoDuyet` → **`xoaPhaiQuaDuyet`** (trả `{ok:false, canXinXoa:true}` — đổi tên vì ý thật là «có phải qua duyệt không»); 3 cột xin xoá vào `COT_KHOA_DUYET` ⇒ PATCH không tự đặt được |
| `assertCoBuocDuyet` | Bỏ chặn cứng cấp 3: nhiệm vụ đi duyệt được khi đang `Chờ duyệt`/`Nháp`/`Từ chối` (đúng khi admin bật ⏳ ô «Tạo Nhiệm vụ»); nhiệm vụ `Đã duyệt` gửi/duyệt vẫn 409 (TC-APR-20) |
| `approvals/service.js` + `routes.js` | `xinXoa`/`duyetXoa`/`tuChoiXoa` + `POST /:entity/:id/{request,approve,reject}-delete` + `GET /pending-deletes`; `countPending` cộng `deletes` vào badge; xin xoá cấp 1 = xin cả cây (đếm `soCon`); thông báo hai chiều (gửi TRƯỚC khi xoá — sau xoá không còn dòng để đọc) |
| `permissions/service.js` | Mở `'cho-duyet'` ở hàng Xoá cho vai `Nhân viên` (lý do chặn ở Vòng 12e — chưa có luồng — đã hết) |
| Giao diện | `buildXinXoaBadge` — nhãn ĐỎ «Đang xin xoá» (đổi tên từ `xinXoaBadge`: helper trả HTML phải mang tiền tố build*); hộp «Yêu cầu xoá» trong panel Chờ duyệt (`buildPendingDeleteRowHtml` — Đồng ý xoá có `confirm`, Từ chối KHÔNG cần lý do); `confirmDelete` đổi sang luồng «Xin xoá» khi server trả lỗi qua-duyệt; Bảng phân quyền thêm **«Duyệt Nhiệm vụ (cấp 3)»** (dropdown task:approve) + **«Duyệt yêu cầu XOÁ (cả 3 cấp)»** (chỉ hiển thị); option ⏳ ở Xoá mở cho Cán bộ |
| Test | TC-APR-20..22 (duyệt cấp 3), `xoa-cho-duyet-api.test.js` TC-XOA-01..10 (14 ca: 3 cột giữ `approval_status`, vẫn hiện + vẫn vào thống kê, cả cây, cổng chặn), TC-PQ-12/13 viết lại, TC-TKPQ-06/13/14 cập nhật + **TC-TKPQ-16**, approvals-ui +4 ca, TC-CV-BL-3 «xin xoá vẫn vào thống kê». **1450 test / 83 file xanh** |

Banner `app.js 20260901-2`; buster `app.js?v=20260901-2`, `app.css?v=20260901-1`. Pin XSS **98 chỗ / 730 giá trị**.
