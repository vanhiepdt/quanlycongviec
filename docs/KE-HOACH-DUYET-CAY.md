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

> ### ⚠️ ĐỢT A (11/09/2026) LẬT hai điều tài liệu này đang nói — đọc trước khi tin bất cứ dòng nào bên dưới
>
> Bảy quyết định ở bảng trên **vẫn đúng nguyên** (chúng nói về Nháp, về gửi cả cây, về từ chối =
> xoá, về trả lại để sửa, về chỗ hiện nhãn). Nhưng **hai câu chốt cho ĐỢT 2 ở ngay trên** và toàn bộ
> mô tả «AI duyệt được» trong tài liệu này thì **không còn đúng**, vì người dùng đã chốt **R1(a)**:
>
> | Điều cũ trong tài liệu này | ĐỢT A đổi thành |
> |---|---|
> | `VAI_TU_DUYET = ['admin','Phó Giám đốc']` ⇒ **admin duyệt được MỌI cây** | **BỎ.** Chỉ người **có tên trong `supervisor_ids`** của mục đó mới duyệt được, **không chừa admin làm dự phòng** (`NOT_APPROVER`, 403). admin vẫn **SỬA** được `supervisor_ids` (quyền `update`, không phải `approve`) để thay người rồi người mới duyệt — admin **không tự duyệt thay** |
> | «duyệt cấp 3 thêm một hàng mới vào Bảng phân quyền, mặc định ✕ cho TP/PP, **admin tự bật**» | Ô đó (`task:approve`) vẫn bật được, nhưng **bật cũng không cho duyệt**: ghi đè cấp **HÀNH ĐỘNG**, còn `supervisor_ids` là **PHẠM VI**. TP/PP vì vậy **không bao giờ** duyệt được cây (TC-APR-22 đã viết lại theo luật này) |
> | Người nhận thông báo duyệt cây = **mọi Phó Giám đốc của phòng** | = **đúng `supervisor_ids` của cấp tương ứng** (D3) |
> | `supervisor_id` là **MỘT** người | `supervisor_ids` là **MẢNG**: cấp 1 chọn nhiều, cấp 2 ⊆ cấp 1, cấp 3 **đúng một** ⊆ cấp 2 (D2) |
> | Gửi duyệt không đòi điều kiện phân công nào | **BẮT BUỘC** `supervisor_ids` khác rỗng mới gửi được (`NO_APPROVER_ASSIGNED`, 409) |
>
> Chi tiết ĐỢT A ở **mục 10** bên dưới. Mọi chỗ trong tài liệu này nói «admin duyệt», «Phó GĐ của
> phòng duyệt», «supervisor» số ít — đọc theo bảng quy đổi trên.

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

## 9. ĐỢT 3 — Phase 8b (2026-09-09): người duyệt SỬA RỒI DUYỆT ngay trên màn chi tiết + báo thay đổi cho người gửi

Yêu cầu người dùng: trên màn xem chi tiết công việc cha / công việc con / nhiệm vụ đang **Chờ duyệt**,
người đi duyệt được **sửa các thông tin**, rồi có nút **phê duyệt cái mình vừa sửa**, **trả để sửa lại**,
**từ chối** ngay trên màn đó. Nếu người duyệt sửa rồi phê duyệt luôn, người gửi mở lại sẽ thấy
**popup những gì đã thay đổi** với hai lựa chọn: **OK** (chỉ đóng lần đó, mở lại vẫn hiện) và
**Đã biết** (ngừng nhắc hẳn). Sáu quyết định của mục 1 và luật «trả lại = cả cây về Nháp, từ chối =
xoá cả cây» **giữ nguyên**.

| Thành phần | Đã làm |
|---|---|
| Migration `023_approval_change_receipts.sql` | `works` + `work_items` thêm `submitted_by` (FK `users`, `ON DELETE SET NULL`) để biết ai là NGƯỜI GỬI cần được nhắc; bảng mới **`approval_changes`** (`work_id` NOT NULL, `item_id` NULL được, `recipient_id`, `editor_id`, `entity_code`, `entity_name`, `changes jsonb` có `CHECK jsonb_typeof = 'array'`, `approved_at`, `acknowledged_at`). **Hai index unique MỘT PHẦN** `WHERE approved_at IS NULL` (một cho `work_id`, một cho `item_id`) ⇒ không thể có hai bản ghi «đang chờ» cho cùng một đầu việc; index `approval_changes_unread` cho truy vấn nhắc. **Hai view `v_countable_*` dựng lại trong CÙNG migration** (bẫy `SELECT *` đóng băng cột — như migration 013) |
| `approvals/changes.js` (MỚI) | `recordReviewerChanges` / `recordReviewerItemChanges` ghi khác biệt **có nhãn tiếng Việt** dạng `[{label, from, to}]`; `startSubmission` nhớ `submitted_by` và tạo bản ghi chờ cho người gửi; `clearPending` huỷ khi bị trả lại/từ chối; `publishChanges` đóng dấu `approved_at` lúc duyệt; `unreadChanges(user, entity, ref)` chỉ trả bản ghi **của chính người gọi**, đã duyệt và chưa xác nhận; `acknowledge(user, id)` ghi `acknowledged_at` — **theo tài khoản**, không theo trình duyệt, nên đổi máy vẫn hết nhắc |
| `approvals/routes.js` + `service.js` | `POST /approvals/:entity/:id/approve` nhận THÊM `edit` trong body (`approveSchema`, các khoá lạ vẫn bị bỏ qua để tương thích). **`service.approve(user, entity, id, edit)` chạy lưu-sửa + đổi-trạng-thái + ghi-bản-ghi-thay-đổi trong MỘT transaction**: lỗi ở bước nào cũng rollback toàn bộ, kể cả khi quyền bị thu hồi giữa chừng ⇒ không bao giờ để lại «đã sửa mà chưa duyệt» hay «đã duyệt bản cũ». Phản hồi chỉ **THÊM** trường `changes` khi có, hình dạng cũ không đổi, không mở RPC mới |
| Ba đường REST | `POST /approvals/:entity/:id/approve` (kèm `edit`) · `GET /approvals/:entity/:id/changes` (bản ghi chưa đọc của chính người gọi) · `POST /approvals/changes/:id/acknowledge`. `submit`/`reject`/`return`/`*-delete` giữ nguyên |
| `web/assets/js/phase8b-review.js` (MỚI) | `ganNutDuyetChiTiet8b` gắn chân nút vào màn **chi tiết chỉ đọc**: «Chỉnh sửa thông tin» + **Phê duyệt / Trả để sửa lại / Từ chối**. `ganTienIchForm8b` gắn vào **form sửa**: **Lưu và phê duyệt / Trả để sửa lại / Từ chối**. `luuSuaVaQuyetDinh8b`: với `approve` thì gửi **MỘT** request kèm `edit`; với `return`/`reject` vẫn lưu nội dung trước rồi gửi quyết định kèm lý do. `xinLyDo8b` bắt **lý do ≥ 10 ký tự**. `hienThayDoiDuyet8b` vẽ popup thay đổi với **OK / Đã biết**, có chốt chống: đổi tài khoản giữa chừng (`currentUser !== nguoi`), host đã rời DOM, và không mở trùng hai popup. **Toàn bộ dựng bằng `textContent`/`createElement`, không đưa dữ liệu vào `innerHTML`** ⇒ pin XSS giữ **106/903** |
| Dữ liệu mới, không phải bộ nhớ phiên | `napDuLieuDauViec8b` / `lamMoiChiTiet8b` / `moSuaMoiNhat8b` nạp lại từ máy chủ TRƯỚC khi mở chi tiết hoặc form sửa, để người gửi không xem bản cũ sau khi bị người duyệt sửa; `lanMoSua8b` chặn hai lượt mở chồng nhau; cờ `receiptsChecked` được chuyển tiếp để popup không mất khi vẽ lại |
| Test | `tests/integration/phase8b-review.test.js` + `tests/unit/phase8b-review-ui.test.js` — đủ ba cấp, lưu-sửa-rồi-duyệt là MỘT request, **rollback** khi lưu lỗi hoặc mất quyền giữa chừng, popup hiện đúng thay đổi, **OK** rồi mở lại vẫn nhắc, **Đã biết** thì hết (kể cả phiên khác), và chỉ gọi duyệt SAU khi lưu thành công |

Banner + buster **`20260909-4`** cho cả `app.js`/`project-details.js`/`phase8b-review.js`/`app.css`.
Full suite **1841 test / 103 file xanh**. Hướng dẫn test tay: `docs/HUONG-DAN-TEST-GIAO-DIEN.md` mục **9b.15** phần G.
**ĐÃ phát hành VPS 12/09/2026** (commit `b17f878` + `3689bc2` + `7929f62`, `pgmigrations` = **029**) **mà
CHƯA nghiệm thu giao diện** — nay bấm thử mục **9b.15** phần G trực tiếp trên `https://ttdt.site`.

## 10. ĐỢT A (2026-09-11): «Ban lãnh đạo kiểm soát» thành BA CẤP, gửi ĐÚNG NGƯỜI

Nguồn quyết định: `docs/BAT-DAU-SESSION.md` — người dùng trả lời **13 câu Q1–Q13** rồi **6 câu
R1–R7**, chốt **tách 2 đợt** (Q13). Tài liệu này chỉ ghi **ĐỢT A** = D2 + D3 + R1(a) + R2 + R7 + Q12.
**ĐỢT B** (gộp hai trục duyệt: Q1+Q2+Q3+Q4, R4+R4'+R4'', R5, R6, thay `trinh-lanh-dao`, gộp
`yeu-cau-sua` vào `tra-ve-cbo`, siết `dungNguoiDuyetFile`) **ĐÃ LÀM XONG ngay sau đó, 11/09/2026 —
xem mục 11**.

### 10.1 Vấn đề gốc

Điểm bất hợp lý số 3 và số 4 trong bản báo cáo 13 điểm: **người duyệt CÂY là mọi Phó Giám đốc của
phòng** (`approvals/service.js` cũ), trong khi **người duyệt FILE là MỘT `supervisor_hieu_luc`**
(`taskFiles/service.js`) — hai trục không biết nhau, nên bấm «Trình Phó giám đốc» thì cả phòng nhận
được còn hàng chờ của đúng người kia thì không ai thấy. Và `supervisor_id` là **một cột đơn** trong
khi nghiệp vụ thật cần **nhiều người ở cấp 1/cấp 2**. Công thức `supervisor_hieu_luc` bị **chép tay ở
4 nơi** (`workItems/repo.js` ×2, `taskFiles/repo.js`, `approvals/changes.js`).

### 10.2 Đã làm

| Thành phần | Nội dung |
|---|---|
| Migration **`028_supervisor_ids.sql`** | `works` + `work_items`: thêm `supervisor_ids bigint[]`, **TỰ ĐỘNG ĐIỀN** theo đúng 6 bước R2 (cấp 1 ← `ARRAY[supervisor_id]`; cấp 2 rỗng ← nguyên mảng của công việc cha; cấp 3 rỗng ← **phần tử ĐẦU** của cấp 2, đúng Q12; cấp 3 không cha ← phần tử đầu của cấp 1; vẫn rỗng ← một `deputy_director` **đang hoạt động** của phòng (`DISTINCT ON`); phòng không có ← một `admin` đang hoạt động; vẫn không ai ← **để rỗng và `RAISE NOTICE` in từng dòng + tổng số**). Rồi `DEFAULT '{}'` + `NOT NULL`, CHECK **`task_supervisor_single`** (`level <> 3 OR cardinality(supervisor_ids) <= 1`), **DROP hai view `v_countable_*` TRƯỚC khi `DROP COLUMN supervisor_id`** (bẫy phụ thuộc — xem 10.4), hai index GIN mới, dựng lại hai view, down migration đầy đủ |
| **Nhân bản khuôn `leader_ids`, không phát minh cơ chế mới** | `assertSupervisor` (bản đơn) **giữ nguyên** → `assertSupervisors` (lặp, khử trùng) → **`nguonBanKiemSoat({level,parentRow,workRow})`** trả `Set\|null` (`null` = không giới hạn) → **`assertSupervisorsByLevel`** (≤1 ở cấp 3 · vai/phòng · ⊆ tập cấp trên, mã lỗi mới `SUPERVISOR_NOT_IN_SOURCE`). Khuôn chép từ `validTaskLeaders`/`assertTaskLeader`/CHECK `task_leader_single` đã chạy ổn định từ 005. **Tập nguồn RỖNG ⇒ `null` chứ không phải tập rỗng** — cha chưa kịp phân công mà bắt con chọn trong «không ai» là khoá cứng cả cây không ai gỡ được |
| **Diệt chỗ chép tay thứ 4** | Một hằng SQL duy nhất `sqlSupervisorHieuLuc(alias)` xuất từ `workItems/repo.js`, dùng ở `findById`, `findByRefWithWork`, `taskFiles/repo.js` (hàng chờ PGĐ) và `approvals/changes.js` (`pendingGuiBld`). **Bốn nơi phải khớp nhau** — lệch là tích bật mà file chạy tới một người, còn hàng chờ của người khác thì không thấy gì |
| **R1(a) — cổng duyệt** | `middleware/rbac.js`: `normalizeRow` đọc `supervisor_ids`; `can()` thêm cổng **sau** nhánh `create` và **TRƯỚC** `inScope`: `action === 'approve'` && entity ∈ {work, subwork, task} && **danh sách KHÁC RỖNG** && người gọi không có tên ⇒ thử `tryDelegations` trước, không ai thì `deny('NOT_APPROVER', …)`. **Đặt như một điều kiện PHẠM VI chứ không sửa `PERMISSIONS.admin`**, nên: áp đều cho MỌI vai kể cả admin · `inScope` giữ nguyên nghĩa · ủy quyền vẫn chạy (PGĐ trong danh sách đi vắng thì người được ủy quyền duyệt thay) · test ma trận 120 phép sinh tự động không phải sửa. **Hệ quả chấp nhận có chủ ý** (TC-APR-22): ghi đè `task:approve = cho-phep` cho TP/PP **vẫn không cho duyệt** — ghi đè cấp HÀNH ĐỘNG, không cấp PHẠM VI |
| **Danh sách RỖNG thì KHÔNG bắt cổng** | Van an toàn **một chiều**: dòng cũ đang `Chờ duyệt` từ trước 028 mà migration không điền được ai (bước 6) thì **không bị tắc vĩnh viễn**. `submit` mới là chỗ làm cho dòng rỗng **không thể sinh ra nữa** |
| **R1(a) — cổng gửi** | `approvals/service.submit`: sau bước kiểm xung đột `Chờ duyệt`, thêm `if ((target.row.supervisor_ids ?? []).length === 0) throw NO_APPROVER_ASSIGNED` (409, `field: 'supervisorIds'`) — «bắt buộc phải chọn thì mới được gửi đi duyệt» |
| **D3 — người nhận thông báo** | `phongCua` + `phoGiamDocPhuTrach` trong `approvals/service.js` **BỊ XOÁ**, thay bằng **`banKiemSoatCua(row, client, actor)`**: đọc `supervisor_ids` của chính dòng đó → `usersRepo.listByIds` → lọc `is_active` và **lọc luôn người vừa bấm** (`actor`) để không tự thông báo cho mình. `submit` và `xinXoa` cùng dùng |
| **R7 — báo khi bị hạ về `Chờ duyệt`** | `baoKhiHaVeChoDuyet(row, user, refType, nhan, client)` mới trong `approvals/changes.js`, gọi ở **cả hai** chỗ `if (phaiDuyetLai)` (`works/service.js` và `workItems/service.js`): «…vừa bị sửa và QUAY LẠI trạng thái chờ bạn duyệt (người sửa: …)». **Cố ý KHÔNG `async`** — hàm trả về promise của `insertMany`, vì eslint `require-await` báo lỗi hàm `async` không có `await` (đúng khuôn `notifyChange` sẵn có trong file) |
| **Ba mã lỗi mới** (`utils/errors.js`) | `SUPERVISOR_NOT_IN_SOURCE: 400` · `NOT_APPROVER: 403` · `NO_APPROVER_ASSIGNED: 409` |
| **Q12 — mặc định của cấp 3** | `resolvePhanCongKhiTao` (workItems): cấp 3 không gửi gì ⇒ **người ĐẦU TIÊN của cấp 2**, không có cấp 2 thì của cấp 1. **Câu báo lỗi cũ «Nhiệm vụ dưới công việc con không có ô Ban lãnh đạo phụ trách» BỊ BỎ HẲN** — luật cấm đó chính là cái D2 lật |
| **REST + cầu RPC** | `zodTypes.idsInput(nhan)` mới (mảng ≤50, `.optional()`); hai file `routes.js` đổi `supervisorId: idInput` → `supervisorIds: idsInput(…)`. **Hình dạng phản hồi RPC KHÔNG ĐỔI**: `[COL.P_SUP]`/`[COL.T_SUP]` vẫn là **một chuỗi tên nối dấu phẩy** (đúng cái `tenTrongDanhSach` của `project-details.js` đang đợi), `supervisorId` vẫn còn = **phần tử đầu**, và **THÊM** `supervisorIds` — thuần tuý bổ sung, theo đúng tiền lệ `leaderIds`. Chiều GỬI lên: `supervisorIdsFromLegacy` nhận **cả** `supervisorIds` (client mới) **và** `supervisorId` (trang đang mở từ trước khi tải bản mới) — nhận khoá cũ là **CHỐNG MẤT DỮ LIỆU**, không phải chiều client |
| **Giao diện** | Cấp 1 + cấp 2: `<select>` một người → **nhóm checkbox** `#project-supervisors-box` / `#task-supervisors-box` + hidden input, theo đúng khuôn ô `leaderIds`. Cấp 3: **vẫn một `<select>`** (đúng luật «chọn ĐÚNG MỘT»). Nhãn thống nhất **«Ban lãnh đạo kiểm soát»** ở cả ba cấp. `listTaskCandidates` nay trả `supervisor_ids` của CÔNG VIỆC CON làm `supervisors` + `defaultSupervisorId` (trước trả `[]`). Hai hàm mới `buildSupervisorCheckboxesHtml` / `capNhatSupervisorInput`. Buster + banner **`20260911-02`** |

### 10.3 Test

| File | Nội dung |
|---|---|
| `approvals-api.test.js` | **Viết lại theo R1(a)**: «admin KHÔNG tự duyệt được khi không có tên trong Ban lãnh đạo kiểm soát — **nhưng sửa được danh sách để gỡ tắc**» (403 `NOT_APPROVER` + cây vẫn `Chờ duyệt`, rồi `PATCH supervisorIds` thêm admin ⇒ duyệt được 200) — **đây là ca chốt cái van thoát hiểm**; **TC-APR-22 đảo ngược**: ghi đè `task:approve` cho TP/PP nay ra **403** chứ không 200; ca thông báo đổi tên thành «gửi cho Ban lãnh đạo kiểm soát của mục (việc 5.7, D3)» |
| `assignments.test.js` | Ca cũ «nhiệm vụ dưới cấp 2 **vẫn không nhận** supervisor riêng» **viết ngược lại** thành «nhận **NẾU** nằm trong tập của cấp 2», kèm ba ca mới: ngoài tập ⇒ `SUPERVISOR_NOT_IN_SOURCE` (kể cả khi người đó là admin hợp lệ theo VAI), hai người ⇒ 400, và ca «chuyển phòng» phải **gửi kèm `supervisorIds`** để hàng rào `ASSIGNEE_LEADER_NO_DEPUTY` thật sự được chạm tới |
| `phase8c-gui-bld.test.js` | **TC-V7-06 viết lại** theo D2 (kế thừa lúc TẠO = ảnh chụp, không phải suy lúc đọc; ⊆ cấp 2; đúng một; bỏ BLĐ cấp 2 khi con đã có ô riêng ⇒ **200** chứ không 400 như trước); **TC-V7-09** đổi tên thành «cấp 3 kế thừa BLĐ của cấp 2 (Q12) nên file vẫn định tuyến đúng người đó» |
| `phase8b-review.test.js` | Ca «rollback khi quyền duyệt mất sau lúc đổi phòng» **tách thành hai nhánh**, vì đợt A làm lỗi ra **sớm hơn và rõ hơn**: (1) đổi phòng ⇒ `assertPhanCong` soi `supervisor_ids` theo phòng MỚI ⇒ **400 VALIDATION_ERROR** (trước 028 ô này NULL nên lọt qua và 403 mới hiện ở bước kiểm lại quyền); (2) **đổi người duyệt ngay trong `edit`** ⇒ tự gạt mình ra khỏi danh sách ⇒ đúng cái **403-sau-edit** ở cuối `duyetCaCay`. Cả hai đều phải **không ghi gì** |
| `gantt-api.test.js` | Fixture đổi sang `supervisor_ids = ARRAY[$2,$3]` với **hai** Phó GĐ, để phân biệt «một tên» với «hai tên nối dấu phẩy» |
| `countable-views.test.js` | Ca giả lập view cũ phải đổi từ **lọc tên cột** sang **cắt tiền tố**: `ALTER TABLE ADD COLUMN` nhét `supervisor_ids` xuống **CUỐI** thứ tự vật lý, nên bốn cột «loại trừ» của test thành **lỗ hổng giữa danh sách** — mà `CREATE OR REPLACE VIEW` chỉ cho thêm cột **ở cuối** |
| Ba file unit | `project-form-phan-cong` (checkbox + hidden input gộp hai id, +1 ca mới), `phase8b-permissions-ui` (nhãn mới; cấp 3 **hiện** ô chứ không ẩn), `project-from-legacy-phong` (`supervisorIds` thắng `supervisorId`, `''` ⇒ **mảng rỗng** chứ không `null`) |
| `xss-guard.test.js` | Pin **99/961 → 100/964** — chi tiết và phép cộng ở `docs/XSS-4.6.md` |

Full suite **1987 test / 111 file xanh**, `npm run lint` exit 0, `format:check` còn đúng **2 nợ cũ**
(`workItems/tyLe.js`, `stats-parity.test.js`), `node --check` sạch cả ba file JS, `tools/dem-xss.mjs`
đo **100/964**, `local-assets-check --live` exit 0.

### 10.4 Bẫy gặp phải (đừng phát hiện lại)

1. **`DROP COLUMN` phải SAU `DROP VIEW`.** Lần chạy 028 đầu tiên chết ngay: `cannot drop column
   supervisor_id of table works because other objects depend on it · detail: view v_countable_works
   depends on column supervisor_id`. Thứ tự đúng đã viết sẵn trong DOWN migration nhưng **quên viết
   trong UP**: `DROP VIEW IF EXISTS v_countable_items; DROP VIEW IF EXISTS v_countable_works;` →
   `DROP COLUMN` → `CREATE OR REPLACE VIEW`.
2. **`ADD COLUMN` nhét cột xuống CUỐI thứ tự vật lý.** Mọi ca test giả lập «view dựng bằng `SELECT *`
   từ thời migration cũ» mà **liệt kê tên cột cần loại** sẽ vỡ: các cột bị loại nằm **giữa** danh sách
   thay vì ở đuôi, mà `CREATE OR REPLACE VIEW` chỉ chấp nhận định nghĩa mới có **K cột đầu khớp tên/
   kiểu/vị trí** và chỉ cho **thêm ở cuối** ⇒ `cannot change name of view column "supervisor_ids" to
   "ty_le"`. Sửa bằng cách **cắt tiền tố** tại cột đầu tiên sinh ra sau mốc.
3. **`require-await` của eslint.** Hàm `async` không có `await` là **lỗi**, không phải cảnh báo. Hai
   hàm mới (`baoKhiHaVeChoDuyet`, `nguonBanKiemSoat`) đều phải bỏ `async` và trả giá trị/promise trần.
4. **Ghi đè quyền KHÔNG vượt được `supervisor_ids`.** Đây là **thiết kế**, không phải lỗi: đặt cổng ở
   tầng phạm vi thì `permission_overrides` (tầng 2) cấp hành động xong vẫn rơi xuống cổng này. Ai muốn
   TP/PP duyệt được cây thì phải **chọn họ vào `supervisor_ids`** — mà họ không phải admin/Phó GĐ nên
   `assertSupervisor` chặn. Đúng ý R1(a).
5. **`decideGuiBld` là trục KHÁC, admin vẫn quyết được.** R1(a) nói «cho việc **duyệt cây**». Đề nghị
   đổi tích Gửi BLĐ (`change_kind='gui-bld'`) có luật riêng từ 023: «admin **hoặc** đúng PGĐ đang kiểm
   soát, và **không phải** người đề nghị», và `proposeGuiBld` **chủ động** gửi thông báo tới MỌI admin
   khi chính supervisor tự đề nghị cho mình. Nếu để `NOT_APPROVER` gạt admin ở đây thì đề nghị đó
   **không ai xử lý được** — đúng cái «tắc vĩnh viễn» mà bản chốt R1(a) dặn phải chừa đường thoát.
   Nên `changes.js` có helper `coTheQuyet(user,row)` chấp admin **chỉ khi** lý do từ chối đúng là
   `NOT_APPROVER`. (TC-V7-10 và TC-V7-15 canh chỗ này.)
6. **Form nhiệm vụ có HAI ô cùng `name="supervisorIds"`.** Chỉ một ô được gửi: ô không dùng phải
   `disabled` (select) hoặc **không có `name`** (hidden input). Cả hai cùng gửi thì `FormData` chỉ giữ
   giá trị cuối — của ô người dùng **không nhìn thấy**. Đúng cái bẫy cặp `leaderIds` cạnh bên đã xử lý.

### 10.5 Còn nợ / chưa làm

- ~~**ĐỢT B** (Q1+Q2+Q3+Q4, R4+R4'+R4'', R5, R6, thay `trinh-lanh-dao`, gộp `yeu-cau-sua`, siết
  `dungNguoiDuyetFile`)~~ — **ĐÃ LÀM XONG 11/09/2026, xem mục 11**.
- ~~**Chưa phát hành VPS.**~~ — **ĐÃ PHÁT HÀNH VPS 12/09/2026** theo lệnh người dùng (ba commit
  `b17f878` + `3689bc2` + `7929f62`, `bash deploy/restart.sh` **exit 0**): VPS **đã áp 022 → 029**,
  `pgmigrations` nay = **029**, backup chụp trước deploy ở `/var/backups/qlcv/qlcv-2026-09-12.dump`
  (029 **không lùi tự động được** — muốn rút phải `restore.sh` bản đó). **Chưa nghiệm thu**: người dùng
  nay bấm mục **9b.23** (và giữ xanh 9b.15 → 9b.22) **trực tiếp trên `https://ttdt.site`**, không phải
  trên PC.

## 11. ĐỢT B (2026-09-11): «gộp hai trục» duyệt cây + duyệt file kết quả

Nguồn quyết định: `docs/BAT-DAU-SESSION.md` — bảng 22 quyết định (Q1–Q13 + R1–R7 + R3/R4'/R4'') ở
mục «VIỆC KẾ TIẾP NGƯỜI DÙNG ĐÃ GIAO». Đợt này làm **D1 + D4 + D5 + D6** sau khi ĐỢT A (mục 10) xanh.
**Hai đề xuất của Claude bị GẠT và đã làm đúng như vậy**: Q11 **giữ** `hoan-thanh` cho nhiệm vụ không
bật tích; Q9 **giữ** cơ chế ghi đè `update = ⏳` khi sửa cây đã duyệt.

### 11.1 Vấn đề gốc

Điểm bất hợp lý **số 1** (hai trục duyệt không biết nhau) là gốc của bốn điểm còn lại: **số 2**
(`trangThaiDuyetKhiTao` cho cấp 3 luôn `Đã duyệt` ⇒ một cây «đã duyệt» mà phần kết quả chưa ai xem),
**số 7** (TP/PP không có hành động «Phê duyệt» ⇒ không lưu được mốc ai duyệt lúc nào), **số 9**
(`yeu-cau-sua` và `tra-ve-cbo` là hai nút cho một việc), **số 11** (tỷ lệ không qua duyệt ở cấp nào),
**số 12** (`dungNguoiDuyetFile` chỉ siết Phó GĐ và chỉ khi bật tích).

### 11.2 Đã làm

| Thành phần | Nội dung |
|---|---|
| Migration **`029_dot_b_gop_hai_truc.sql`** | Bốn việc: (1)+(2) **điểm 9 + điểm 7** — `ALTER TABLE … DROP CONSTRAINT` → hai câu `UPDATE` đổi tên (`yeu-cau-sua` → `tra-ve-cbo`, `trinh-lanh-dao` → `tp-phe-duyet`) → chốt `DO $$ … RAISE EXCEPTION` kể **đích danh** mã verdict lạ còn sót → `ADD CONSTRAINT` với danh sách mới **12 mã** `('nop','gom-y','tp-phe-duyet','tra-ve-tp','tra-ve-cbo','duyet-tu-dong','duyet','hoan-thanh','sua-truc-tuyen','huy-lenh-sua','luu-tam','gui-duyet')` — đúng bằng danh sách 13 mã của 025 bớt hai mã đổi tên rồi cộng `tp-phe-duyet`; `duyet-tu-dong` **vẫn giữ** để lịch sử đọc được dù R6 bỏ hành động đó. **THỨ TỰ `DROP → UPDATE → ADD` LÀ BẮT BUỘC**: bản đầu đặt hai câu `UPDATE` lên trước `DROP` và **đã nổ thật trên UAT ngày 11/09/2026** — xem 11.4 bẫy (2) và (10); (3) thêm **`task_files.tp_duyet_boi`** + **`tp_duyet_luc`**, điền ngược bằng `DISTINCT ON (file_id) … WHERE hanh_dong IN ('tp-phe-duyet','hoan-thanh') ORDER BY file_id, id DESC` (**cố ý KHÔNG lấy `duyet-tu-dong`** — R6 bỏ nó); (4) **R4''** — `approval_changes.file_id` + `change_kind='ty-le'`, hai index pending `DROP` rồi dựng lại thành `UNIQUE (work_id, change_kind) WHERE item_id IS NULL AND approved_at IS NULL` và `UNIQUE (item_id, change_kind, COALESCE(file_id,0)) WHERE item_id IS NOT NULL AND approved_at IS NULL`. **Không có view nào dựng trên `task_files`** nên **KHÔNG phải rebuild `v_countable_*`** — khác hẳn 026/028. **DOWN là `RAISE EXCEPTION`** ⇒ chỉ lùi được bằng phục hồi bản sao lưu |
| **Q1+Q2+Q4 — cấm hẳn nút tải file khi cây chưa duyệt** | `taskFiles/service.js`: cổng `cayDaDuyet(item.id)` ném `409 LOI_CAY_CHUA_DUYET`; trường `cayDaDuyet` trả về client để giao diện **ẩn** nút. Lần gửi đầu chỉ **KHAI BÁO** (tên kết quả · định dạng · **tỷ lệ**) — `web/assets/js/app.js` `buildKhungKhaiKq` thêm ô `oNhapTyLeKhai("task-kq-khai-ty-le", "")` và `docTyLeKhai` (số nguyên 0–100, trống = máy tự chia). OnlyOffice **chỉ** ở chuỗi sau khi đã có bản tải lên; người duyệt cây chỉ sửa **khai báo** |
| **Q3+R5 — Nháp là nháp tất cả** | `approvals/rules.js`: **BỎ** luật «nhiệm vụ cấp 3 LUÔN `Đã duyệt`» (điểm 2). `trangThaiDuyetKhiTao` nay: «Lưu nháp» ⇒ `Nháp` (thắng mọi thứ) → ghi đè `create` ⏳/✓ ⇒ `Chờ duyệt`/`Đã duyệt` → **MỌI trường hợp còn lại ⇒ `Chờ duyệt`**. Nhiệm vụ thêm SAU vào cây đã duyệt ⇒ **`Chờ duyệt` MỘT MÌNH NÓ**, duyệt riêng (R5). `v_countable_items` **không mất số** của phần đã duyệt vì nó chỉ loại đúng dòng `Chờ duyệt`, không loại cả cây |
| **R6 — bỏ tự duyệt** | `taskFiles/service.js apTuDong(user)` **không bao giờ trả `da-duyet`**: `['Trưởng phòng','Phó phòng'].includes(user.role) ? 'cho-lanh-dao' : 'cho-xem'`. **BỎ luôn `VAI_TU_DUYET`** trong `approvals/rules.js` — người duyệt và người tạo phải là **hai người khác nhau, kể cả với Giám đốc**. `file:create = ✓` nay chỉ còn nghĩa «được phép **khai/nộp**». `duyet-tu-dong` **giữ trong CHECK** để lịch sử đọc được, nhưng **không còn là hành động** |
| **Điểm 7 — «TP/PP phê duyệt» có lưu mốc** | `BANG_VERDICT`: hành động đổi tên, thêm cờ **`laMocTpPp`** ⇒ ghi `tp_duyet_boi` + `tp_duyet_luc`. Ba tên trường cho cùng một mốc: `ten_nguoi_tp_duyet` (GET `…/files`), `tp_duyet_ten` (mapper tab Nhiệm vụ), `tenNguoiTpDuyet` (RPC). **`den` vẫn `cho-lanh-dao`, nhưng bản đầu ghi «Q5/Q6 không đổi luồng» là ĐỌC SAI Q6** — hành động này nay chỉ **tồn tại** khi nhiệm vụ **thật sự phải** trình BLĐKS: xem **11.6** |
| **Điểm 9 — gộp `yeu-cau-sua`** | Code còn sống lấy `tu` = **HỢP** của cả hai mã cũ và **`canNoiDung: true`** ⇒ `tra-ve-cbo` nay **BẮT BUỘC lý do ≥ 10 ký tự** |
| **Điểm 12 — siết `dungNguoiDuyetFile`** | Nay bắt cả **Phó Giám đốc LẪN `admin`**, và **KHÔNG đọc tích `gui_bld_phe_duyet`** (cùng luật R1(a)). `supervisorFile(item)` = `supervisor_hieu_luc ?? supervisor_ids[0] ?? null`. **Danh sách RỖNG thì KHÔNG bắt cổng** — van an toàn **một chiều**, không có đường thoát nào khác. TP/PP **không đi qua đây** (họ bị `laLanhDaoPhuTrachNhiemVu` soi theo `leader_ids`). Gọi ở ba chỗ: dòng 877 · 1130 · 1648 |
| **R4+R4'+R4'' — tỷ lệ qua `approval_changes`** | `server/src/modules/approvals/tyLe.js` (mới, 346 dòng): `proposeTyLe(user, dich, valueTo, client)` với `dich = {loai:'file'\|'item', row, item?}` (`item` **bắt buộc** khi `loai:'file'`), trả `{pending, value, id?, nguoiNhan?}` — **`value` là giá trị CÒN hiệu lực sau lời gọi** (bằng giá trị cũ khi pending) nên nơi gọi **không cần đọc lại**. `pendingTyLe` gộp vào `GET /approvals/pending` (`pendingList = [...pendingGuiBld, ...pendingTyLe, ...repo.listPending]`) — **không mở hàng chờ thứ ba** (tiền lệ 026). `decideTyLe(user, id, approve, reason)` có **chốt chống lệch mốc**: giá trị gốc đã đổi ⇒ `409 'Tỷ lệ hiện tại đã thay đổi — hãy từ chối và lập đề nghị mới'`. **Người nhận**: cấp 3 và file của nó ⇒ **ĐÚNG MỘT** (CHECK `task_supervisor_single` của 028 chặn `cardinality(supervisor_ids) <= 1`, `supervisorOf` lùi về phần tử đầu của cấp 2 theo **Q12**); cấp 2 ⇒ **tất cả** người được chọn. **Q7: MỘT người đồng ý là đủ ở MỌI cấp**. Áp dụng giá trị đã duyệt đi qua **ba luật CŨ**: file → `updateFileWeights` · đầu mục (cấp 2, hoặc cấp 3 không cha) → `canLaiTyLeWork` · cấp 3 có cha → `updateChildWeights`. **KHÔNG hạ cây về `Chờ duyệt`** |
| **Quyền của đề nghị tỷ lệ** | Tái dùng **`coTheQuyet`** từ `changes.js` (ĐỢT A), nên admin lọt qua **đúng một khe** (lý do từ chối `NOT_APPROVER`) để gỡ «người kiểm soát tự đề nghị cho chính mình» |
| **R7 (ĐỢT A, giữ nguyên)** | `baoKhiHaVeChoDuyet` vẫn báo tới `supervisor_ids` khi sửa cây bị hạ về `Chờ duyệt` |

### 11.3 Test

| File | Nội dung |
|---|---|
| `tests/integration/phase8d-dot-b.test.js` (mới) | Tám việc của ĐỢT B, mỗi việc một nhóm ca: cổng `cayDaDuyet` · khai tỷ lệ · cấp 3 không tự `Đã duyệt` · R5 thêm sau vào cây đã duyệt · `apTuDong` không bao giờ `da-duyet` · mốc `tp_duyet_boi`/`tp_duyet_luc` · `tra-ve-cbo` bắt lý do · `dungNguoiDuyetFile` siết admin kể cả tích TẮT |
| `tests/integration/approvals-api.test.js` | `VAI_TU_DUYET` bị bỏ ⇒ **TC-APR-03/04 đảo ngược**: admin/Phó GĐ **không** tự duyệt việc mình lập nữa. Ghi đè `create = ✓` vẫn là đường thoát |
| `tests/unit/dom-contract.test.js` | **NGUỒN SINH ID THỨ TƯ** — xem 11.4 bẫy (3) |
| `tests/integration/phase8c-files.test.js` | Cổng Q2 + thông báo 409 nguyên văn |
| `tests/unit/tasks-results-design.test.js` · `phase8c-ui.test.js` | Khung khai có ô tỷ lệ; nút tải **ẩn** khi `cayDaDuyet = false`; nhãn «TP/PP phê duyệt» |
| `tests/integration/xss-guard.test.js` | Pin **100 sink / 964 → 969 nội suy** |
| `tests/integration/migration-replay.test.js` (mới, thêm SAU khi 029 nổ trên UAT) | Replay `022 → 029` trên CSDL RIÊNG có **gieo dữ liệu cũ**, bịt điểm mù «mọi migration chỉ từng được thử trên bảng rỗng» — xem 11.4 bẫy (10). Đã kiểm bằng mutation |
| `tests/integration/phase8d-dot-b.test.js` — **thêm 7 ca** ở bản sửa 11.6 | Nhóm ca «ĐỢT B — Q6/Q11: tích «Gửi BLĐ phê duyệt» quyết định TP/PP có nút nào»: tích TẮT mất nút trình + 409 · tích BẬT mất nút chốt + 403 · tích TẮT mà TP vừa lưu bản cuối **vẫn** chốt được · Q5 TP là `assignee` · ghi đè ⏳ · ghi chú tuỳ chọn · để trống ghi chú |

Full suite **2034 test / 113 file xanh · Duration 244.55s** (ĐỢT A: 1987/111; **+7 của
`migration-replay.test.js`** thêm sau khi 029 nổ trên UAT, **+7 nữa của bản sửa 11.6**), `npm run lint`
exit 0, `format:check` còn đúng **2 nợ cũ** (`workItems/tyLe.js`, `stats-parity.test.js`),
`tools/dem-xss.mjs` đo **100/969**, `local-assets-check --live` exit 0, buster + banner
**`20260911-04`** (trước bản sửa 11.6 là `20260911-03`).

### 11.4 Bẫy gặp phải (đừng phát hiện lại)

1. **029 KHÔNG LÙI TỰ ĐỘNG ĐƯỢC.** `DOWN` là `RAISE EXCEPTION '029 không hỗ trợ down tự động: lịch sử
   verdict đã gộp và đề nghị tỷ lệ phải giữ'`. Gộp `yeu-cau-sua` vào `tra-ve-cbo` và đổi
   `trinh-lanh-dao` thành `tp-phe-duyet` là **viết lại lịch sử** — không suy ngược được. **Sao lưu
   trước** là bắt buộc, không phải khuyến nghị.
2. **`DROP CONSTRAINT` → `UPDATE` → `ADD CONSTRAINT`, ĐÚNG THỨ TỰ ĐÓ.** Câu `UPDATE` đổi tên verdict
   phải nằm **SAU** `DROP` — CHECK cũ (014 → 025) không biết `tp-phe-duyet`, nên chính cái ràng buộc
   chưa bị xoá sẽ chặn câu lệnh sinh ra để thay thế nó — và **TRƯỚC** `ADD`, vì `ADD` soi lại **mọi**
   dòng nên một dòng `yeu-cau-sua` còn sót là chết `23514`. **Bản đầu của 029 chỉ nhớ nửa sau**: đặt
   hai câu `UPDATE` lên trước cả `DROP`, và nổ thật trên UAT ngày 11/09/2026
   (`23514 task_file_flow_hanh_dong_check`, dòng id 6 `trinh-lanh-dao`). Đừng đọc khuôn 015/020/025
   thành «thứ tự không quan trọng»: chúng cũng `DROP` trước `ADD`, chỉ là chúng **NỚI** danh sách chứ
   không đổi tên giá trị nào nên không có câu `UPDATE` chen giữa. Cả ba lệnh nằm trong MỘT transaction
   của node-pg-migrate nên không có lúc nào bảng thiếu ràng buộc mà lộ ra ngoài. Đã thêm chốt
   `DO $$ … RAISE EXCEPTION` kể **đích danh** mã verdict lạ ngay trước `ADD`, vì `ADD` chỉ báo `23514`
   mà không nói mã nào — người vận hành VPS (đang ở 021, dữ liệu khác UAT) sẽ phải đoán.
3. **`dom-contract.test.js` cần NGUỒN SINH ID THỨ TƯ.** Test này canh lớp lỗi «`app.js` đọc một id
   không nơi nào sinh ra» bằng **ba** nguồn literal: `index.html` · chuỗi HTML do `app.js` dựng ·
   `phanTu.id = "..."`. Ô tỷ lệ của Q1 lấy id từ **hàm dùng chung** `oNhapTyLeKhai("task-kq-khai-ty-le", …)`
   — chuỗi ` id="` nằm **trong hàm**, tên id là literal ở **nơi gọi**, nên ba nguồn kia không thấy.
   Nguồn thứ tư: hàm nào nhận tham số **ĐẦU tên `id`** và thân nó **thật sự nối ` id="`** thì mọi
   literal **nguyên khối** truyền vào đối số đầu là id được sinh ra. **Hai chỗ cố ý chặt**: chỉ đối số
   ĐẦU, và literal phải **kết bằng `,` hoặc `)`** — nếu nới ra là bắt nhầm `'ban-'`, `'kq-'`, `'hc-'`
   (mảnh nối của `buildMenuHanhDongKq("ban-" + id)`). Helper sau này đặt id ở chỗ khác thì test **đỏ**
   chứ không âm thầm lọt — đúng hướng an toàn.
4. **`require-await` + `no-return-await` cùng là `error`.** Hàm `async` không có `await` là lỗi, mà
   `return await` cũng là lỗi trừ khi trong `try` có `catch`/`finally`. Sửa bằng cách **bỏ `async`**
   (đã gặp ở `verdict` của `phase8d-dot-b.test.js`, và ở `baoKhiHaVeChoDuyet` / `nguonBanKiemSoat` của
   ĐỢT A).
5. **`chiaKhiSua` ép `[100]` khi chỉ có MỘT đầu mục.** `workItems/tyLe.js` dòng 91:
   `if (so.length === 1) return [TONG]`. Muốn test chia tỷ lệ thì **phải có ≥ 2 anh em**, nếu không mọi
   ca đều ra 100 và test xanh mà không chứng minh gì.
6. **`works` KHÔNG có cột `ty_le`.** Không tồn tại «tỷ lệ công việc cha»; chỉ **đầu mục** (cấp 2, hoặc
   cấp 3 không cha) mới có. `laDauMuc(row)` trong `tyLe.js` là định nghĩa duy nhất.
7. **`duyetCaCay` lan xuống con cháu.** Duyệt một mục là duyệt **mọi** hậu duệ đang `Chờ duyệt`
   (`ghiKhoaDuyetCaCay`, dòng 120). Viết test R5 («thêm sau ⇒ `Chờ duyệt` một mình nó») mà quên điều
   này sẽ tưởng code sai.
8. **Ba tên trường cho MỘT mốc TP/PP.** `ten_nguoi_tp_duyet` (GET `…/files`, `taskFiles/repo.js:27`) ·
   `tp_duyet_ten` (mapper compact tab Nhiệm vụ, `repo.js:519-520`) · `tenNguoiTpDuyet` (RPC). Đổi một
   mà quên hai là cột trống lặng lẽ.
9. **`web/assets/*` KHÔNG nằm trong phạm vi prettier.** `npm run format` chỉ phủ `src/**/*.js` và
   `tests/**/*.js`. **Không bao giờ** chạy `npx prettier --write` lên file web nữa — prettier
   `getPreferredQuote` **có mất mát**, format lại một file trình bày tay là **không đảo ngược được**.
   Sự cố đã xảy ra 11/09/2026 và chỉ cứu được nhờ `~/.claude/file-history/<sessionId>/<hash>@vN`.
10. **MỌI MIGRATION CỦA DỰ ÁN CHỈ TỪNG ĐƯỢC THỬ TRÊN BẢNG RỖNG — đó là lý do bẫy (2) lọt được tới
    UAT.** `tests/global-setup.js` dựng CSDL test từ số không (`DROP SCHEMA public CASCADE` rồi chạy
    hết migration), nên tới lượt 029 thì `task_file_flow` **rỗng**: hai câu `UPDATE` trúng 0 dòng và
    lỗi `23514` không có cách nào lộ ra — 2020 test vẫn xanh, và lỗi chỉ hiện khi người dùng chạy
    `chay-test.bat` trên CSDL UAT có dữ liệu thật. Đây là điểm mù **có hệ thống**, không phải sơ suất
    một chỗ. Bịt bằng `tests/integration/migration-replay.test.js` (7 test): dựng CSDL RIÊNG
    `quanlycongviec_replay_test`, chạy migration `022 → 028` từ một thư mục tạm, **gieo dữ liệu CŨ
    thật sự** (3 dòng `task_file_flow` mang `trinh-lanh-dao`/`nop`/`yeu-cau-sua`, xen `nop` vào giữa
    để chắc mốc TP/PP lấy theo `id DESC`), rồi mới cho 029 lên bằng chính `node-pg-migrate` — cùng
    con đường UAT/VPS đi. Ca (1) khẳng định fixture THẬT SỰ có dữ liệu cũ (`trinhLanhDao===1`,
    `tongVet===3`, `daDuyetTu028===0`) để cả nhóm không **xanh oan**. **Đã kiểm bằng mutation:** trả
    029 về thứ tự sai thì test đỏ đúng lỗi `ExecConstraints` trên `task_file_flow_hanh_dong_check` và
    nổ ở `beforeAll` nên 7 ca bị skip; khôi phục bản đúng thì 7/7 xanh. Luật rút ra: **migration có
    `UPDATE`/`DELETE` dữ liệu cũ thì phải có một ca test chạy nó TRÊN dữ liệu cũ** — «full suite xanh»
    không nói gì về chuyện đó. Bản 029 sửa cũng đã được **dry-run trên BẢN SAO dữ liệu UAT thật**
    (nạp từ `E:/quanlycongviec-backups/uat-20260911-204416` vào CSDL tạm `quanlycongviec_migcheck_tmp`
    rồi drop, không đụng UAT): `pgmigrations 28 → 29`, `task_file_flow` **46 → 46 dòng**,
    `trinh-lanh-dao:3 → tp-phe-duyet:3`, `yeu-cau-sua:2 → tra-ve-cbo:2`, mốc điền ngược **3/16** nhóm
    file. **UAT không phải khôi phục gì:** node-pg-migrate tự `Rolling back attempted migration`, CSDL
    vẫn sạch ở `pgmigrations=28`, constraint cũ còn nguyên và chưa có cột `tp_duyet_*`. Chính bản
    backup mà `chay-test.bat` tự tạo ở bước [2/7] hoá ra là nguồn dữ liệu để chứng minh bản sửa — chốt
    an toàn cũng là công cụ kiểm tra.

### 11.5 Còn nợ / chưa làm

- **UAT ĐÃ LÊN `pgmigrations=029` (chiều 11/09/2026).** Nợ cũ «UAT vẫn ở 28» **hết hiệu lực**: người dùng
  chạy lại `chay-test.bat` và 029 lên thành công (đo thật: `SELECT name FROM pgmigrations ORDER BY name
  DESC LIMIT 1` ⇒ `029_dot_b_gop_hai_truc`). **Nhưng người dùng chọn mode 4 «Seed BỘ VÒNG 14»** — đúng
  cái mode đã được khuyên tránh — nên dữ liệu UAT nay là bộ seed. Hiện trường đo ngày 11/09/2026: **8
  nhiệm vụ cấp 3 đều `Đã duyệt`**, trong đó **4 nhiệm vụ (`CV001-003` → `CV001-006`) để TRỐNG
  `supervisor_ids`**; **7 nhóm file**, mốc điền ngược trúng **3/7** (nhóm 3, 4, 6 — đều `tp_duyet_boi =
  3` = `tp@test.local`). Hệ quả cho buổi test: **(a)** Q1/Q2 **không thử được trên dữ liệu có sẵn** vì
  không còn cây nào `Chờ duyệt` ⇒ phải **tạo nhiệm vụ mới**; **(b)** ĐIỂM 12 và R1(a) **không thử được
  trên 4 nhiệm vụ trống BLĐKS**, và `assertGuiBld` sẽ **`400`** nếu bật tích cho chúng (xem 11.6 bẫy 4);
  **(c)** nhóm file **6** của `CV002-002` chính là **hiện trường lỗi Q6** — tích `f`, trạng thái
  `cho-lanh-dao`, `tp_duyet_boi = 3`.
- **NỢ SEED: không file seed nào điền `supervisor_ids`.** 028 đặt `NOT NULL DEFAULT '{}'` mà cả
  `dev.sql` lẫn `dev-vong14.sql` đều không gán ⇒ seed mới tinh ra **mọi nhiệm vụ cấp 3 với danh sách
  trống**: R1(a) chặn hết duyệt cây (kể cả `admin`/Giám đốc), còn ĐIỂM 12 (`dungNguoiDuyetFile`) cố ý
  bỏ qua khi ô trống nên cũng không thử được. Hiện trường dễ đọc nhầm thành «nút phê duyệt 403 với mọi
  tài khoản». Đã chọn **cảnh báo to trong `chay-test.bat`** thay vì bịa dữ liệu seed, vì chuỗi R2
  (cấp 2 ⊆ cấp 1, cấp 3 ⊆ cấp 2) chỉ được giữ ở **tầng service**, bịa vài cái id «cho đủ» rất dễ tạo
  hành vi khó hiểu. Muốn thử thật: `/giu`, hoặc mở nhiệm vụ và chọn người trong biểu mẫu.
- ~~**Chưa phát hành VPS.**~~ — **ĐÃ PHÁT HÀNH 12/09/2026 mà CHƯA QUA NGHIỆM THU**: người dùng ra lệnh
  «deloy lên vps đi, đảm bảo vps chạy code mới nhất và ko lỗi, restart lại docker cho chắc», lệnh đó
  **thay cho OK RIÊNG ĐỢT NÀY** (OK của ĐỢT A và của các đợt 3/4/5 vẫn không áp dụng). Đã commit bằng
  explicit paths (`b17f878` máy chủ · `3689bc2` giao diện · `7929f62` tài liệu), push `vps/sua-loi-vat`,
  rồi trên VPS `backup.sh` → `git pull --ff-only` → `bash deploy/restart.sh` **exit 0**. **Chốt `DO $$`
  trong 029 KHÔNG nêu mã verdict lạ nào** — migration chạy sạch trên dữ liệu thật (dữ liệu VPS **khác**
  UAT), `pgmigrations` nay = **29**. Việc còn nợ: bấm **9b.23 — gồm cả mục J của bản sửa 11.6** và giữ
  xanh 9b.15 → 9b.22 **ngay trên `https://ttdt.site`**, không phải trên PC.
- **`server/_uat-9b22-20260911-0648/`** (bằng chứng UAT) — **không commit**, chưa xác nhận nguồn gốc.
- **Ba worktree cũ của subagent** ở `.claude/worktrees/agent-*/` — **không đụng tới**, xoá là thao tác
  git phá hoại, phải hỏi người dùng.

### 11.6 Bản sửa chiều 11/09/2026 — Q6/Q11: tích «Gửi BLĐ phê duyệt» quyết định TP/PP có nút nào

**KHÔNG có migration mới.** Chỉ mã máy chủ (`taskFiles/service.js`) + `web/assets/js/app.js`, buster
`20260911-03` → **`20260911-04`**. Người đang test chỉ cần **Ctrl+F5**.

#### 11.6.1 Vấn đề gốc — người dùng bắt được khi test thật

Nguyên văn: «vừa tôi test, nhiệm vụ mà **ko tích** gửi Gửi BLĐ phê duyệt, nhưng khi gửi file **tp duyệt
vẫn đẩy lên cho PGĐ**, CV002». Hiện trường đo trên UAT: `CV002-002` (`work_items.id = 8`, cấp 3,
`gui_bld_phe_duyet = f`, `assignee_id = 5` Lê Thị Nhân/**Nhân viên**, `leader_ids = {3}` Trần Thị
Trưởng/**Trưởng phòng**, `supervisor_ids = {2}` Phó GĐ Phụ trách), nhóm file **6** («Hi»): `nv1`
`gui-duyet` 22:18:42 ⇒ `cho-xem` → `tp` `sua-truc-tuyen` 22:19:45 tạo bản 2 `uploaded_by = 3` → `tp`
`tp-phe-duyet` 22:19:58 ⇒ `cho-lanh-dao`. **HAI nguyên nhân chồng nhau, thiếu một cái là vẫn tái diễn:**

1. **`BANG_VERDICT['tp-phe-duyet'].den` là `cho-lanh-dao` CỐ ĐỊNH, không đọc tích.** Q6 nói «tích BẬT →
   cán bộ → TP/PP → PGĐ; tích TẮT → **TP/PP chốt luôn** (`hoan-thanh`)», nhưng bản đầu của ĐỢT B chỉ
   **đổi tên** hành động chứ không làm nó **phụ thuộc tích** — tức đã đọc Q6 thành «không đổi luồng»
   (đúng chữ từng ghi ở hàng Điểm 7 của 11.2, nay đã sửa). Thành ra nút «TP/PP phê duyệt» **luôn** đẩy
   lên PGĐ, kể cả khi tích TẮT.
2. **Van chống tự duyệt canh SAI người.** Bản cũ chặn `hoan-thanh` khi người bấm là **`uploaded_by` của
   bản cuối** ⇒ TP vừa «Sửa trực tuyến» là **mất nút «Hoàn thành / Duyệt»**. Ghép với (1): TP chỉ còn
   ĐÚNG MỘT nút, và nút đó đẩy lên PGĐ. Cái người dùng thấy là **hệ quả của cả hai**.

#### 11.6.2 Hai lựa chọn người dùng đã chốt

| Câu hỏi | Người dùng chọn | Nghĩa là |
|---|---|---|
| Luồng khi tích TẮT | **«Ẩn nút, chỉ còn «Hoàn thành»»** | Tích TẮT ⇒ TP/PP chỉ thấy **«Hoàn thành / Duyệt»** + **«Đẩy về Cán bộ»**; «TP/PP phê duyệt» chỉ hiện khi tích **BẬT** hoặc khi **không được tự chốt**. Nút chốt nay có ô ghi chú **TUỲ CHỌN** |
| Van chống tự duyệt | **«Nới: chỉ chặn khi là người thực hiện»** | `hoan-thanh` chỉ bị chặn khi tích **BẬT** hoặc khi người bấm là **`assignee`** (Q5). **BỎ** điều kiện «người lưu bản cuối» |

#### 11.6.3 Đã làm

| Thành phần | Nội dung |
|---|---|
| **`phaiTrinhLanhDao(user, item)`** — mới, `taskFiles/service.js:785` | MỘT hàm duy nhất trả lời «nhóm này **có phải** trình BLĐKS không»: `item.gui_bld_phe_duyet === true \|\| sameId(item.assignee_id, user.id) \|\| giaTriHieuLuc(user,'file','approve') !== 'cho-phep'`. **`verdict` và `hanhDongDuocLam` đọc CÙNG hàm này** ⇒ nút hiện ra trên màn hình và luật máy chủ **không bao giờ lệch nhau** |
| **`BANG_VERDICT`** (dòng 822) | `tp-phe-duyet` thêm cờ **`chiKhiTrinh: true`** (dòng 831); `hoan-thanh` nay **`canDuyet: true`** (dòng 845) để ghi đè ⏳ chặn được nó, và bị **ẩn khi phải trình** (`!(ma === 'hoan-thanh' && trinh)` ở `hanhDongDuocLam`, dòng 1201; `(!luat.chiKhiTrinh \|\| trinh)` dòng 1200) |
| **`verdict` — ba guard, đúng thứ tự** | **(5)** dòng 924: `hoan-thanh` + tích BẬT ⇒ **403** «Nhiệm vụ đã bật Gửi BLĐ phê duyệt — phải trình Ban lãnh đạo phụ trách, không Hoàn thành tại TP/PP». **(6)** dòng 927-929: `luat.chiKhiTrinh` + **không** phải trình ⇒ **409** «Nhiệm vụ này KHÔNG bật «Gửi BLĐ phê duyệt» nên TP/PP là chặng cuối — hãy dùng «Hoàn thành / Duyệt» để chốt, hoặc «Đẩy về Cán bộ» nếu cần sửa lại.» **(8)** dòng 942: `canDuyet` + quyền `file:approve` là ⏳ ⇒ **403** «Quản trị đã đặt «⏳ Chờ duyệt» …». **(11)** dòng 972: `hoan-thanh` + người bấm là `assignee` ⇒ **403** «Bạn là người thực hiện nhiệm vụ này nên không được tự chốt kết quả của chính mình — hãy dùng «TP/PP phê duyệt» để trình Ban lãnh đạo kiểm soát.» — **thay hẳn** guard cũ đọc `uploaded_by` bản cuối |
| **`thongBaoVerdict`** | Nhánh `default` nay **nối ghi chú** vào chuông (`Ghi chú: <lý do>`) vì nút chốt đã có ghi chú tuỳ chọn; trước đó ghi chú của `hoan-thanh` bị **nuốt** |
| **Copy trang editor** (`service.js:1864`) | «Bản này bạn không tự Hoàn thành được — phải trình Ban lãnh đạo kiểm soát. Nút «TP/PP phê duyệt» sẽ lưu bản mới rồi trình lên; cần ý kiến ít nhất 10 ký tự.» **Cố ý giữ substring `không tự Hoàn thành`** để hai ca UI đang assert không vỡ. `moEditor` cũng được chú thích lại: lưu ở editor sinh **bản mới đứng tên chính người lưu**, nhưng van nay chỉ canh **NGƯỜI THỰC HIỆN** nên hàng nút tính ở trên **vẫn đúng nguyên sau lần lưu**, khỏi tính lại |
| **`web/assets/js/app.js`** | Hằng **`HANH_DONG_CHOT = Object.freeze(["hoan-thanh","duyet"])`** (dòng 2346); `xuLyVerdictFile` (dòng 3518) thêm nhánh đọc ô `task-y-kien-<fileId>` cho nút chốt, `.slice(0, 2000)`, **không bật `prompt`**; `dsVerdictFile` (dòng 3725) lọc nút chốt theo `giaTriHieuLucFile(role,'approve')` và **cố ý là SUPERSET** (máy chủ vẫn là người quyết). **`xuLyVerdictChoDuyet` (dòng 8886) CỐ Ý KHÔNG ĐỔI** — trang «Hàng chờ phê duyệt» không dựng sẵn ô nhập, nên nút chốt ở đó **không gửi ghi chú** |
| **Buster** | **`20260911-04`** ở **5 chỗ**: `web/index.html` dòng 21, 1230, 1232, 1233 + banner `console.info("[QLCV] app.js 20260911-04")` ở `app.js:9`. `chay-test.bat` chỉ cập nhật **chú thích REM** (dòng 43) vì bước `[7/7]` in buster bằng `findstr`, không so giá trị cứng |

**Luật bảo đảm ĐÚNG MỘT đường chốt trong mọi trường hợp:** TẮT + không phải `assignee` + quyền duyệt ✓ ⇒
chỉ «Hoàn thành / Duyệt»; BẬT ⇒ chỉ «TP/PP phê duyệt»; TẮT + **là** `assignee` ⇒ chỉ «TP/PP phê duyệt»
(Q5); TẮT + quyền duyệt ⏳ ⇒ chỉ «TP/PP phê duyệt». **Không ô nào ra cả hai nút hoặc mất cả hai.**

#### 11.6.4 Bẫy gặp phải (đừng phát hiện lại)

1. **Đọc một quyết định về LUỒNG thành quyết định về TÊN NÚT.** Q6 viết «tích TẮT → TP/PP chốt luôn»;
   bản đầu chỉ đổi `trinh-lanh-dao` → `tp-phe-duyet` rồi ghi chú «Q5/Q6 không đổi luồng». **Đổi tên mà
   không đổi điều kiện tồn tại** là cách dễ nhất để một quyết định «đã làm xong» trên giấy mà sai trên
   máy. Dấu hiệu nhận ra: bảng luật có một ô **cố định** (`den`) trong khi quyết định nói nó **phụ
   thuộc dữ liệu** (`gui_bld_phe_duyet`).
2. **Ẩn nút để chống lạm dụng chỉ an toàn khi CÒN ÍT NHẤT MỘT nút hợp lệ.** Van «người lưu bản cuối
   không được tự chốt» nghe hợp lý, nhưng TP sửa trực tuyến **hộ** cán bộ là chuyện bình thường — van
   đó biến họ thành người **không có đường kết thúc file trong phòng**. **Phải đếm đường ra trước khi
   ẩn nút**, không phải sau khi người dùng kẹt.
3. **Sửa một trong hai nguyên nhân thì hiện trường vẫn tái diễn.** Nếu chỉ làm `chiKhiTrinh` mà giữ van
   cũ: tích TẮT + TP vừa sửa trực tuyến ⇒ **mất cả hai nút** (lỗi còn nặng hơn). Nếu chỉ nới van mà giữ
   `den` cố định: TP vẫn **thấy** nút trình và bấm là lên PGĐ. **Hai chỗ phải đi cùng một bản.**
4. **`assertGuiBld` đòi BLĐKS khi bật tích ⇒ bật tích trong test bằng API thì PHẢI khai
   `supervisorIds` CÙNG LÚC.** `assignments/service.js:487-518`: tích BẬT mà `supervisor_ids` của nhiệm
   vụ **và** của công việc con chứa nó đều trống ⇒ **400** «Nhiệm vụ chưa có Ban lãnh đạo kiểm soát để
   gửi phê duyệt» (field `guiBldPheDuyet`) — **mười ca** của `task-files-api.test.js` đỏ cùng lúc vì
   đúng một chỗ. Sửa bằng conditional spread `...(guiBld ? { supervisorIds: [pgdA.id] } : {})`. **Đặt
   lúc TẠO chứ không `PATCH` về sau**: sửa nhiệm vụ trên cây đã duyệt thì `phaiChoDuyetKhiSua` (Q9) hạ
   cây về `Chờ duyệt` và Q2 **khoá luôn cửa nộp file**. `nguonBanKiemSoat` (dòng 176-187) — cấp 1 →
   `null`; cấp 2 → tập của cấp 1; cấp 3 → tập của cấp 2, không có thì cấp 1; `thanhTap([])` trả `null`
   = **KHÔNG giới hạn** ⇒ cấp 2 để trống thì cấp 3 chọn tự do, nên `pgdA` qua được `assertSupervisor`
   (dòng 122) nhờ có dòng `department_managers` role `deputy_director`.
5. **Hai cách bật tích trong test — chọn theo fixture, KHÔNG đổi lẫn nhau.** `phase8d-dot-b.test.js`
   dùng **SQL thẳng** (`batGuiBld`: `UPDATE work_items SET gui_bld_phe_duyet = true WHERE id = $1`) vì
   fixture tạo sẵn trong `beforeEach`, không đi qua `assertGuiBld`; `task-files-api.test.js` và
   `phase8c-files.test.js` dùng **API lúc tạo** (`guiBldPheDuyet: true` + `supervisorIds`) vì cây dựng
   theo từng test — trung thực hơn và không đụng Q9.
6. **Bốn ca `phase8c-files.test.js` đỏ KHÔNG cùng một lý do.** Ba ca (TC-V4-09, TC-V6-01, TC-V6-05)
   `expected 409 to be 200` do guard `chiKhiTrinh`; riêng **TC-V6-02** `expected false to be true` vì
   với tích TẮT thì `duyetMoi = null` ⇒ trang editor **mất** `id="duyet-moi"` **và mất** dòng chữ «không
   tự Hoàn thành», **đồng thời** `hoan-thanh` **không còn** bị 403. Sửa: chạy cả bốn ca trên
   `taskCreate({ guiBldPheDuyet: true })` — `wordChoDuyet` nay nhận tham số `item`; và **ghi chú rõ** ở
   TC-V6-02 rằng lý do 403 nay là **guard Q6** chứ không phải «vừa lưu bản cuối».
7. **Test «xanh oan» khi lời gọi DỰNG HIỆN TRƯỜNG không được assert.** `tp-phe-duyet` / `tra-ve-tp` /
   `gui-di-duyet` chỉ là bước dọn cảnh trong TF-09, TF-10, `taoLenh`, TC-HCPD-02, TC-V4-09 — không
   `expect(...).toBe(200)` thì ca **vẫn xanh** khi guard mới từ chối chính bước dọn đó, và nó âm thầm đo
   một hiện trường **khác**. **Đã thêm assert cho cả năm chỗ.**
8. **Đổi luật mà quên đổi CÂU CHỮ giải thích luật thì test UI vẫn xanh.** Sau khi nới van, câu «Bạn là
   người lưu bản vừa sửa nên không tự Hoàn thành» **sai hẳn** mà `task-files-editor.test.js` (13/13)
   **không phát hiện**, vì nó chỉ `toContain('không tự Hoàn thành')`. Luật rút ra: mỗi lần đổi điều kiện
   phải **đọc lại mọi câu chữ người dùng nhìn thấy về điều kiện đó** — đừng tin test UI.
9. **`prettier` reflow `phase8d-dot-b.test.js`.** Dòng SQL ~102 ký tự trong `batGuiBld` bị `--check`
   bắt; chạy `npx prettier --write` **đúng file đó** rồi test lại **37/37 xanh**. **Không** format lan
   sang file web — bẫy (9) của 11.4 vẫn còn đó.

#### 11.6.5 Còn nợ

- **Dữ liệu UAT không tự lùi lại.** Nhóm file **6** của `CV002-002` **đang ở `cho-lanh-dao`** — bản sửa
  **không kéo nó về**, mà nút chốt của TP chỉ có ở `cho-xem`/`can-sua`. Muốn nghiệm thu trên đúng hiện
  trường cũ: `pgd@` bấm **«Đẩy về TP»** (`tra-ve-tp` ⇒ `can-sua`) rồi `tp@` sẽ thấy **«Hoàn thành /
  Duyệt»**. Hoặc tạo nhiệm vụ mới cho sạch.
- **`nutVerdictFile` / `buildNutVerdictFile` vẫn là CODE CHẾT** trong `app.js` — chưa dọn vì ngoài phạm
  vi đợt này.
- ~~**Cổng nghiệm thu chưa qua:** người dùng test PC **9b.15 → 9b.23 (gồm mục J)** rồi nói **«OK RIÊNG
  ĐỢT NÀY»**. Trước đó **không commit, không push, không deploy**.~~ — **ĐÃ DEPLOY LÊN VPS 12/09/2026 MÀ
  CHƯA NGHIỆM THU**: lệnh «deloy lên vps đi…» của người dùng thay cho cổng đó, mã đã lên `https://ttdt.site`
  trong ba commit `b17f878` + `3689bc2` + `7929f62`. Nay bấm **9b.15 → 9b.23 (gồm mục J)** trực tiếp trên
  production với **Ctrl+F5**.

## 12. ĐỢT B BỔ SUNG (2026-09-12): «Tình trạng» và «Người thực hiện» ghi Ở TỪNG BẢN · bản đầu chỉ người thực hiện trực tiếp nộp

**KHÔNG có migration** — CSDL giữ nguyên `029`, người đang test **chỉ cần Ctrl+F5**. Chỉ mã máy chủ +
`app.js`, buster **`20260911-04` → `20260912-01`**. Bấm thử: `docs/HUONG-DAN-TEST-GIAO-DIEN.md`
**§9b.24 (bước 46 → 60)**; ảnh hưởng tới bảng «Kết quả» cũ: `docs/KE-HOACH-KET-QUA-FILE.md` mục «Bổ sung
12/09/2026»; pin XSS: `docs/XSS-4.6.md` khối 100/978.

Hai chỉ đạo nghiệp vụ, nguyên văn:

> «Sửa lại, người thực hiện trực tiếp mới được upfile đầu tiên, hiện tại đang cho Tp up file đầu tiên»

> «ở cột Tình trạng fiel kết quả, ghi ở từng bản tình trạng, ví dụ bị trả về hoặc tp/pp sửa trực tiếp,
> PGĐ/GĐ sửa trực tiếp, lưu ý thêm tên vào nhé, phần Người thực hiện sẽ là người duyệt hoặc người sửa đối
> với các bản sau, chỉ hiển thị Người thực hiện trực tiếp nếu trực tiếp sửa lại bản bị trả về hoặc tải lên
> lần đầu...»

### 12.1 Vấn đề gốc

**(a) `duocGhiTheoPhanCong` là quyền «được ghi vào nhóm kết quả», không phải «được LÀM RA kết quả».**
TP/PP có quyền ghi theo phân công nên up được **bản số 1** thay cán bộ. Hệ quả hai tầng: kết quả của một
nhiệm vụ mang chữ của người không làm nó, và cột «Người thực hiện» của bản 1 in tên TP ⇒ bảng không trả
lời được câu hỏi duy nhất mà người đọc cần: **ai làm ra bản này**.

**(b) Bảng «Kết quả» có ô «Tình trạng» nhưng DÒNG BẢN để TRỐNG.** Tình trạng chỉ hiện ở dòng cha (của cả
NHÓM), nên một nhóm 5 bản thì không biết bản nào bị trả về, bản nào TP sửa trực tiếp, bản nào PGĐ duyệt —
mặc dù dữ liệu **đã có sẵn** trong `task_file_flow` theo `version_id` và máy chủ **đã gửi kèm** nhóm
(`n.luong`). Cùng lúc đó cột «Người thực hiện» in `ten_nguoi_nop` cho **mọi** bản, nên bản do TP nộp và
bản do cán bộ nộp trông y hệt nhau — mất khả năng phân biệt đúng chỗ người dùng cần phân biệt.

**(c) Cả hai vấn đề đều là chuyện HIỂN THỊ THEO BẢN, không phải chuyện luồng.** Nên đợt này **không**
thêm migration, **không** thêm hành động, **không** đổi hình dạng phản hồi — chỉ thêm hai cột dữ liệu đã
có và một guard ở đúng một chỗ.

### 12.2 Đã làm

| Thành phần | Nội dung |
|---|---|
| **Guard bản ĐẦU** — `taskFiles/service.js:371` | `assertNguoiNopBanDau(user, item, versionNo, client = null)`: `Number(versionNo) > 1` ⇒ `return` ngay (mọi bản sau theo luật cũ). `item.assignee_id == null` ⇒ **409 CONFLICT** «Nhiệm vụ chưa có «Người thực hiện trực tiếp» — hãy gán người thực hiện ở form nhiệm vụ trước, rồi chính người đó nộp bản kết quả đầu tiên». Không trùng `user.id` ⇒ **403 FORBIDDEN** «Chỉ «Người thực hiện trực tiếp» (<tên tra từ `users`) mới được nộp bản kết quả ĐẦU TIÊN — TP/PP và PGĐ/GĐ chỉ sửa/nộp từ bản thứ hai trở đi». |
| **Hai chỗ gọi guard** | `nopBaoCao` (625) và `nop` (710) — ở `nop` guard chạy **TRƯỚC** `mkdir`/`writeFile` để một lần bị từ chối không để lại thư mục rỗng mồ côi. `luuTuCallback` (OnlyOffice lưu) **không** gác vì luôn sinh bản ≥ 2. |
| **`quyenFile()`** (~1498) | Tra `users` qua `repo.nguoiTheoId(item.assignee_id)` chạy **song song** trong `Promise.all` với `itemsRepo.cayDaDuyet(item.id)`; trả `{ phuTrach, cayDaDuyet, duocNop, tenNguoiThucHien, thieuNguoiThucHien, thieuLanhDao }` với `duocNop = cay && can(user,'create','file',item).ok && duocGhiTheoPhanCong(user,item) && sameId(item.assignee_id, user.id)`. Ba trường mới cho giao diện **ẩn nút và nói trước**, khỏi để người dùng chạm 403. |
| **`taskFiles/repo.js listNhomByItem`** | Thêm `w.assignee_id` và `nv.full_name AS ten_nguoi_thuc_hien` (JOIN `work_items w` + LEFT JOIN `users nv`). **Cố ý KHÔNG nhét vào hằng `NHOM`** — `NHOM` là danh sách dùng chung của các truy vấn đọc theo ID đơn lẻ, chỉ bảng «Kết quả» mới cần hai cột này ⇒ giữ nguyên `NHOM`/`JOIN_NHOM`/`BAN` để **không đổi hình dạng phản hồi** ở mọi đường khác. |
| **Ba bảng hằng `Object.freeze`** trong `app.js` | `NHAN_VAI_NGAN` (2340) ánh xạ vai → chữ ngắn («Trưởng phòng»/«Phó phòng» → `TP/PP`, «Phó Giám đốc» → `PGĐ`, `admin` → `GĐ`, «Nhân viên» → `Cán bộ`); `HANH_DONG_TAO_BAN` (2351) = `["sua-truc-tuyen","nop","luu-tam","gui-duyet"]`; `TINH_TRANG_BAN` (2358) = 7 mã → `{nhan, vai?, mau}`. Cờ `vai: true` nghĩa là nhãn phải đi trước vai viết tắt («TP/PP sửa trực tiếp» chứ không phải «sửa trực tiếp»). |
| **Sáu HÀM TRẢ CHUỖI** (4090–4193) | `vaiNgan(vai)` · `luongCuaBan(n,b)` lọc `String(g.version_id) === String(b.id)` · `banTruocBiTraVe(n,chiSo)` xét `["tra-ve-cbo","tra-ve-tp"]` của bản `chiSo-1` · `nguoiTaoBan(n,b)` lấy phần tử **CUỐI** của danh sách MỚI→CŨ, trả `{ten,vai,suaTrucTiep}` · `tinhTrangMotBan(n,b,chiSo)` trả `{nhan,mau}` · `nguoiThucHienCuaBan(n,b,chiSo)` trả `{nhan,chu,ten}`. **Không hàm nào dựng HTML** — xem 12.4 bẫy (7). |
| **Cột «Tình trạng» của DÒNG BẢN** (`buildDongBanKetQua`, 4194) | Ô 9 từ **TRỐNG** thành badge: dòng luồng có ý nghĩa **mới nhất** của chính bản đó thắng, nhãn = `[vai] + nhan + " — " + ten_nguoi`; bản chưa có dòng luồng thì kể đúng việc vừa xảy ra («Tải lên lần đầu» / «Sửa lại bản bị trả về» / «Nộp lại») + tên, màu xám. `title` = `mau`/nhãn đầy đủ, chữ trong ô đã `escapeHtml`. |
| **Cột «Người thực hiện» của DÒNG BẢN** | Ô 7 từ một mình `b.ten_nguoi_nop` thành **NHÃN + TÊN + `title`**. Nhãn «Người thực hiện trực tiếp» **chỉ** khi `n.assignee_id` trùng `b.uploaded_by` **VÀ** (bản 1 **HOẶC** bản trước bị trả về); `suaTrucTiep` ⇒ «TP/PP sửa trực tiếp» / «PGĐ/GĐ sửa trực tiếp»; dữ liệu cũ ở bản 1 ⇒ «TP/PP nộp thay» + `title` nói rõ đó là dữ liệu cũ; còn lại ⇒ «TP/PP sửa» / «PGĐ/GĐ sửa» với `title` «Người duyệt hoặc người sửa nộp bản này». |
| **Ô 7 của DÒNG CHA** (4402–4403) | Đổi nguồn `ten_nguoi_tao` → `ten_nguoi_thuc_hien`, lùi về `ten_nguoi_tao` khi chưa gán; `title` phân biệt «Người thực hiện trực tiếp của nhiệm vụ» và «Nhiệm vụ chưa gán người thực hiện trực tiếp — đây là người khai báo…». |
| **Dải chú `doiNguoiNop`** (`buildKhoiFile`, 4359 → nối vào ô Hành động 4423) | Khi nhóm **0 bản** + không phải báo cáo + `!coTheNopFile(n, ma)`: in «Bản đầu chỉ «<tên>» nộp được.» (chưa gán ⇒ «người thực hiện trực tiếp»), `title` «Bản kết quả ĐẦU TIÊN phải do chính người thực hiện trực tiếp nộp; TP/PP và PGĐ/GĐ chỉ sửa hoặc nộp từ bản thứ hai trở đi». Cùng ý ở **bảng RỖNG** trong `buildKhungDanhSachKetQua` (3027–3035), có chốt chặn `!taoMoi`. |
| **`gom-y` cố ý KHÔNG phải tình trạng của bản** | Góp ý là chuỗi tự do, không phải mốc luồng; gộp vào thì mỗi lần ai gõ một câu là «tình trạng» của bản đổi theo. Vẫn nằm ở ô «Xem ý kiến» riêng. |

### 12.3 Test

| File | Nội dung |
|---|---|
| `tests/integration/phase8d-ban-dau.test.js` (**mới, 9 ca**) | Hai `describe`: «Bản ĐẦU của nhóm kết quả chỉ người thực hiện trực tiếp nộp được» (7 ca — `tp@`/`pgd@`/`admin@` 403 kèm tên; `nv@` 200; đường «Báo cáo» cũng 403; chưa gán người thực hiện ⇒ 409; bản 2 trở đi TP nộp/sửa bình thường; `khaiKetQua` nhóm 0 bản rồi nộp vẫn là bản 1) và «Cờ cho giao diện ẩn nút «Tải lên» và nói rõ ai nộp được bản đầu» (2 ca — `quyenFile().duocNop` `false` cho TP, `true` cho `nv@`, kèm `tenNguoiThucHien`/`thieuNguoiThucHien`). |
| `tests/integration/phase8c-files.test.js` (**vá 3 ca**) | `TC-V2-04` nay mở đầu bằng `expect((await upload(tpApi)).status).toBe(403)` rồi `nvApi` nộp bản 1, `tpApi` nộp bản 2. `TC-V5-03` ×2 đổi `upload(adminApi, item)` thành `upload(api, item)` với `api` là client của **chính** `who`, giữ `adminApi` ở bước `gui-di-duyet`. |
| `tests/unit/xss-guard.test.js` | Pin **100 sink / 969 → 978 nội suy**; **CAN-THOAT giữ đúng 21 chỗ** (TC-SEC-10/11 xanh không phải sửa). Thêm khối chú thích 2026-09-12 kể từng vùng có nội suy mới. |
| **Focused chạy trước full** | `phase8d-ban-dau` + `phase8c-files` + `phase8d-dot-b` = **78/78**; sáu file liên quan (`task-files-api`, `result-completion`, `cron-overdue`, `export-xlsx`, `stats-api`, `phase8c-gui-bld`) = **139/139**. |

Full suite **2043 test / 114 file xanh · Duration 279.08s · exit 0** (mốc trước: 2034/113 — đúng **+9 ca**
của `phase8d-ban-dau.test.js`), `npm run lint` exit 0, `format:check` còn đúng **2 nợ cũ**
(`workItems/tyLe.js`, `stats-parity.test.js`), `tools/dem-xss.mjs` đo **100/978**,
`tools/local-assets-check.mjs` in `Ban app.js = 20260912-01 (index.html khop).` exit 0.

### 12.4 Bẫy gặp phải (đừng phát hiện lại)

1. **Chỉ ẩn nút ở giao diện thì bằng không.** `POST /api/v1/work-items/<mã>/files` vẫn mở cho bất kỳ ai có
   `file:create`. Guard phải ở TẦNG SERVICE, và ở `nop` phải chạy **TRƯỚC** `mkdir`/`writeFile` — đặt sau
   thì một lần bị 403 cũng kịp để lại một thư mục rỗng mồ côi trên đĩa.
2. **Điều kiện theo «`fileId == null`» là SAI vì Q1 tách KHAI BÁO khỏi NỘP FILE.** `khaiKetQua` tạo nhóm
   **0 bản**; người nộp file đầu tiên vào nhóm đã khai sẵn đó vẫn sinh bản số 1 với `fileId` KHÁC null.
   Luật phải viết theo **SỐ BẢN** (`versionNo === 1`), không theo tham số request.
3. **Hai đường sinh bản 1, một guard.** `nop` (file) và `nopBaoCao` (báo cáo chữ) đều tạo bản số 1 — chỉ
   gác `nop` thì «Báo cáo» thành cửa sau. Ngược lại `luuTuCallback` **luôn** tạo bản ≥ 2 nên **không**
   được gác: gác nó là hỏng hẳn «Sửa trực tuyến» của TP/PP và PGĐ/GĐ.
4. **`item.assignee_name` KHÔNG đáng tin — hai lý do.** Client chỉ gửi `assigneeId` thì nó rỗng
   (`workItems/routes.js:84`); user bị xoá thì FK `ON DELETE SET NULL` để lại tên MỒ CÔI. Cả câu 403 lẫn
   dải chú giao diện đều phải tra `users` thật qua `repo.nguoiTheoId` — đó là lý do `quyenFile()` phải
   thêm một lời gọi chạy song song trong `Promise.all`.
5. **`assignee_id` NULL thì báo 409, KHÔNG phải 403.** Thiếu **dữ kiện** để quyết khác thiếu **quyền**:
   trả 403 thì người dùng đi xin phân quyền — sai bệnh nên không bao giờ khỏi. 409 kèm câu «hãy gán người
   thực hiện ở form nhiệm vụ trước» mới chỉ đúng việc phải làm.
6. **Đổi pin XSS bằng CÁCH SUY RA từ danh sách là tự lừa mình.** Kể tên được 8 khoản nội suy mới mà tổng
   **KHÔNG** khớp +9, vì bộ soát đếm một `.map` ra chuỗi HTML khác một `.map` ra lời gọi hàm dựng. Con số
   chốt phải lấy thẳng từ `node ../tools/dem-xss.mjs` chạy từ `server/` — đúng tiền lệ đợt 4, đợt 5, ĐỢT B.
7. **TÁCH HÀM TRẢ CHUỖI khỏi HÀM DỰNG HTML thì khỏi khai báo CAN-THOAT bằng tay.** Sáu hàm mới chỉ trả
   chuỗi/object nên TC-SEC-10/11 vẫn xanh với đúng 21 chỗ cũ, và mọi nội suy mới đều nằm ở chỗ gọi, đã qua
   `escapeHtml`/`escapeHtmlAttr`. Đây là mặt NGƯỢC của bài học `oNhapTyLeKhai` ở §11.4 (hàm trả sẵn HTML
   ⇒ bị bộ soát xếp vào CAN-THOAT).
8. **Test cũ đỏ KHÔNG có nghĩa guard sai — có nghĩa nó đang dựa đúng cái luật vừa bị bỏ.** `TC-V2-04` và
   `TC-V5-03` ×2 cho TP/admin up bản 1 làm **BƯỚC DỌN CẢNH**; guard mới chặn bước dọn nên ca đỏ, còn phần
   nó muốn đo thì chưa chạy tới. Cách sửa là **đổi người nộp bản 1** trong test, **KHÔNG** nới guard.
9. **Đổi luật thì phải đổi CÂU CHỮ giải thích luật.** Ô «Hành động» của nhóm 0 bản mà trống trơn thì người
   dùng tưởng nút hỏng; phải in «Bản đầu chỉ «Tên» nộp được.» kèm `title`. Lặp lại đúng bẫy (8) của §11.6.4.
10. **Đọc `n.luong` mà không lọc theo `version_id` thì badge sai bản.** Danh sách luồng (`listLuongByFile`)
    là của cả NHÓM, chứa dòng của MỌI bản ⇒ phải lọc `String(g.version_id) === String(b.id)`: so **sai
    kiểu** là lọc ra rỗng, vì một bên có thể là số, bên kia là chuỗi.
11. **Hai danh sách trong cùng một object `n` NGƯỢC CHIỀU NHAU.** `n.luong` về **MỚI→CŨ** theo id nên
    `nguoiTaoBan` phải lấy phần tử **CUỐI** (phần tử ĐẦU là lần duyệt gần nhất); còn `n.bans` về theo
    `version_no` **TĂNG DẦN** nên `chiSo` dùng trực tiếp được. Nhầm chiều là nhãn sai hết.
    `banTruocBiTraVe` chỉ xét `tra-ve-cbo`/`tra-ve-tp` vì migration 029 đã viết lại `yeu-cau-sua` và CHECK
    của `task_file_flow` không còn nhận mã cũ.

### 12.5 Còn nợ

- **Nhãn «TP/PP nộp thay» là chữ cho DỮ LIỆU CŨ, không có đường sửa.** Nhóm có bản 1 do TP nộp từ trước
  12/09 vẫn in nhãn đó vĩnh viễn — **cố ý**: không viết migration sửa ngược `uploaded_by`, vì đó là lịch
  sử thật. Muốn sạch thì tạo nhiệm vụ mới.
- **Không có chỗ nào cho TP/PP «nộp thay khi cán bộ vắng».** Chỉ đạo nói rõ bản đầu phải do người thực hiện
  trực tiếp nộp, nên chưa làm đường ngoại lệ (kể cả ngoại lệ cho `admin`). Nếu nghiệp vụ cần thì phải mở
  một quyết định mới ở `docs/BAT-DAU-SESSION.md`, **không** tự nới guard.
- **Cột «Tình trạng» của DÒNG CHA vẫn là tình trạng của cả NHÓM** — không đổi ở đợt này, vì người dùng chỉ
  yêu cầu ghi «ở từng bản».
- **`nutVerdictFile` / `buildNutVerdictFile` vẫn là CODE CHẾT** trong `app.js` — nợ từ §11.6.5, chưa dọn.
- ~~**Cổng nghiệm thu chưa qua:** người dùng test PC **9b.15 → 9b.24** rồi nói **«OK RIÊNG ĐỢT NÀY»**.
  Trước đó **không commit, không push, không deploy**.~~ — **ĐÃ DEPLOY LÊN VPS 12/09/2026 MÀ CHƯA NGHIỆM
  THU**: lệnh «deloy lên vps đi…» của người dùng thay cho cổng đó. Nay bấm **9b.15 → 9b.24** trực tiếp
  trên `https://ttdt.site` với **Ctrl+F5**.

## 13. ĐỢT B BỔ SUNG LƯỢT 2 (2026-09-12): nhãn «duyệt cái gì» + popup «Xem các thay đổi» · bốn nút duyệt bé lại · mở hai ô phân công khi lập mới cấp 3 · ẩn «Gửi đi duyệt» khi nhiệm vụ không trình BLĐ

**KHÔNG có migration** — CSDL giữ nguyên `029`, người đang test **chỉ cần Ctrl+F5**. Chỉ mã máy chủ +
`app.js` + `app.css`, buster **`20260912-01` → `20260912-02`**. Bấm thử:
`docs/HUONG-DAN-TEST-GIAO-DIEN.md` **§9b.25 (bước 61 → 79)**; ảnh hưởng tới luồng file:
`docs/KE-HOACH-KET-QUA-FILE.md` mục «Bổ sung 12/09/2026 lượt 2»; pin XSS: `docs/XSS-4.6.md` khối
**101/986**. Bẫy gặp phải: **21 bẫy** đã ghi ở `KE-HOACH-VPS.md` **§13.5**, khối «Bổ sung 12/09/2026
(đợt B bổ sung lượt 2 …)» — mục 13.4 bên dưới chỉ kể lại những bẫy **đặc thù của luồng duyệt**.

Bốn chỉ đạo nghiệp vụ, nguyên văn:

> «Sửa hiển thị phê duyệt Công việc / Nhiệm vụ , sẽ thêm cột thông tin về đây là duyệt công việc mới tạo,
> hay sửa chữa/xóa ... công việc cha, công việc con., nhiệm vụ, file kết quả Đối với sửa thông tin
> công việc/nhiệm vụ, thêm nút xem các thay đổi, hiển thị popup các thay đổi, sửa (vẫn giữ logic cũ, sửa
> file kết quả thì duyệt riêng, còn sửa tỷ lệ công việc file kết quả thì là cây duyệt kia)»

> «phần Xem chi tiết / Duyệt / Trả lại để sửa / Từ chối bé lại»

> «Sửa lại, nhân viên khi được phép tạo nhiệm vụ cấp 3, nhưng không chọn được Ban lãnh đạo kiểm soát,
> Người thực hiện trực tiếp hãy sửa lại»

> «Khi trưởng phòng/phó phòng duyệt file kết quả vẫn còn hiển thị gửi đi duyệt đối với file không phải gửi
> lên ban lãnh đạo duyệt, tức là ko tích ô Gửi BLĐ phê duyệt đấy»

### 13.1 Vấn đề gốc

**(a) Ba bảng chờ duyệt in ra một đống dòng GIỐNG HỆT NHAU về hình thức.** Người duyệt chỉ biết «có việc
đang chờ», không biết đây là **công việc mới tạo** hay **một nội dung đã duyệt bị sửa**, cũng không biết
đối tượng là **công việc cha / công việc con / nhiệm vụ / file kết quả**. Với ca «sửa» thì tệ hơn: người
duyệt phải tự mở từng trường ra so với trí nhớ của mình, vì **không có chỗ nào liệt kê cái đã đổi**.
Nguy hiểm nhất là ca sửa **âm thầm**: cây `Đã duyệt` bị hạ về `Chờ duyệt` theo Q9, nhưng dòng chờ in ra
không khác gì một việc mới gửi lần đầu ⇒ duyệt lại mà không biết mình đang duyệt lại cái gì.

**(b) Không có dữ kiện nào trong `works` / `work_items` phân biệt được «mới» và «sửa».** Ba đường đều
cụt: `submitted_by` **CÓ** nhưng ghi ở **MỌI** lần gửi nên vô dụng; **không có** `submitted_at`; còn
`approver_id` / `approved_at` bị **XOÁ TRẮNG** khi hạ về `Chờ duyệt` — chính cái luật Q9 đã xoá mất dấu
vết cần đọc. Mốc duy nhất còn tin được nằm ở **`activity_logs`**, nơi middleware `audit` ghi mọi request
GHI thành công sau `res.on('finish')`.

**(c) Bốn nút quyết định chiếm gần hết chiều ngang của dòng.** `.btn-primary` / `.btn-secondary` đặt
`padding:10px 20px; font-size:14px; min-height:40px; border-radius:12px`, còn `app.css` được nạp **SAU**
`tailwind.min.css` (`web/index.html:12` rồi `:21`) nên `.py-1`/`.px-3`/`.text-xs` của Tailwind **thua
đặc hiệu**. Kết quả: một dòng chờ cao ~40px chỉ riêng phần nút, và trên màn hình hẹp thì nhãn + bốn nút
tràn hai dòng.

**(d) Hai ô phân công bị khoá cứng ở cả lúc LẬP MỚI, trong khi luật cũ chỉ có lý ở lúc SỬA.**
`assertAssignmentActor` chặn mọi vai ngoài bốn vai lãnh đạo đổi `supervisor_ids` / `assignee_id` /
`leader_ids`. Lý do của vế «chỉ được tự nhận nhiệm vụ cho mình» là chống **tự duyệt**: cán bộ tự đặt
mình làm người thực hiện rồi tự nộp, tự duyệt. Nhưng lúc **LẬP MỚI** thì chưa hề có «việc của mình» để
duyệt — chống tự duyệt ở đó là chống nhầm chỗ, và hệ quả người dùng gặp thật là Nhân viên **được phép
tạo nhiệm vụ cấp 3** mà **không chọn được** hai ô bắt buộc ⇒ form không lưu nổi.

**(e) `apTuDong` quyết định chặng kế tiếp CHỈ BẰNG CÁCH NHÌN VAI.** Bản cũ:

```js
// CŨ — sai: TP/PP luôn bị đẩy lên cho-lanh-dao
if (['Trưởng phòng', 'Phó phòng'].includes(user.role)) return 'cho-lanh-dao';
```

Nó bỏ qua hoàn toàn ô **«Gửi BLĐ phê duyệt»** của nhiệm vụ, trái **Q6** (tích TẮT ⇒ TP/PP chốt luôn bằng
`hoan-thanh`) và **Q11** (giữ `hoan-thanh` cho nhiệm vụ không bật tích). Người dùng gặp thật **hai lần**
trên **CV002**: nhiệm vụ không tích mà file vẫn lên PGĐ, và ở chiều ngược lại TP/PP **vẫn thấy nút «Gửi
đi duyệt»** cho một việc mà họ là chặng cuối.

### 13.2 Đã làm

| Thành phần | Nội dung |
|---|---|
| **MỚI-3 · máy chủ** `server/src/modules/approvals/repo.js` | Thêm hai hằng: `DA_XU_LY` (dòng **106**) = đúng **HAI** hành động đã đưa việc ra trước người duyệt (`approvals.approve`, `approvals.return`); `SUA_NOI_DUNG` (**107**) = **bảy** action đổi nội dung làm cây bị hạ về `Chờ duyệt` theo `phaiDuyetLai`. `listPending` (**154**) thêm `LEFT JOIN LATERAL (SELECT min(m.created_at) AS moc_xu_ly …)` (**211**) và trả về hai cột `moc.moc_xu_ly` (**195**) + `EXISTS (…) AS da_sua` (**205**). **`da_sua` = có một lượt `SUA_NOI_DUNG` xảy ra SAU `moc_xu_ly`** — tức là sửa **sau khi** cây ra người duyệt lần cuối. **KHÔNG migration**: chỉ đọc `activity_logs` sẵn có. `listPendingDeletes` (**237**) không cần cờ này vì bản chất nó đã là «Xoá». |
| **MỚI-3 · giao diện** `web/assets/js/app.js` | `NHAN_DUYET` (**8590**) — bảng chữ **đóng băng** ba khoá `moi`/`sua`/`xoa`, mỗi khoá có `nhan`/`mau`/`yNghia`. `nhanDuyetHtml(kieu)` (**8596**) trả chuỗi HTML cho **hai builder chuỗi** (`buildPendingApprovalRowHtml` **8504**, `buildPendingDeleteRowHtml` **8621**); builder **DOM** (`buildChangeApprovalRowHtml` **10787**) tự tạo `<span>` bằng `textContent` nhưng **đọc CHUNG bảng chữ đó** (10799–10801) ⇒ không thể lệch chữ giữa hai đường. Dòng chờ mang `data-da-sua` (**8527**) và `data-moc-xu-ly` (**8529**). Nút `approval-changes` «Xem các thay đổi» (**8551**) **chỉ hiện khi `da_sua === true`**. `goiNutChoDuyetPanel` thêm nhánh `if (nut.classList.contains("approval-changes"))` (**9411–9412**). |
| **MỚI-3 · popup** `moPopupThayDoiChoDuyet` (**8754**) | Gọi `/history` của đúng entity, lọc `entries` theo **ĐÚNG `moc_xu_ly` máy chủ trả** (`HANH_DONG_SUA_NOI_DUNG` **8725** phải trùng khớp `SUA_NOI_DUNG` **107**), rồi dựng thân bằng `…map(buildNhatKyDong).join("")` — **TÁI DỤNG** hàm của tab «Nhật ký», không viết bộ dựng HTML mới. `overlay.id = "thay-doi-cho-duyet-dialog"` (**8802**). **Logic cũ giữ nguyên:** sửa file kết quả duyệt riêng ở bảng «Phê duyệt kết quả»; sửa **tỷ lệ** của file đi cây `approval_changes` (R4/R4'/R4''). |
| **MỚI-4 · CSS** `web/assets/css/app.css` **4309–4332** | `.approval-row button, .approval-delete-row button, .change-row button { padding: 3px 9px; font-size: 11px; min-height: 24px; border-radius: 8px; line-height: 1.4; }` + `… button i { font-size: 10px; }`. **Phủ CẢ BA class dòng** vì ba builder khác nhau. Thắng `.btn-primary` bằng **ĐẶC HIỆU (0,1,1) > (0,1,0)**, **không `!important`** — test pin cả hai vế. |
| **MỚI-3 · CSS nhãn** `app.css` **4334–4356** | `.duyet-nhan { font-size: 11px; line-height: 1.5; font-weight: 500; padding: 1px 8px; border-radius: 999px; white-space: nowrap; }` và `.duyet-nhan + .duyet-nhan { margin-left: -4px; }` — selector **anh-em** để hai nhãn dính nhau mà nhãn đứng một mình không bị thụt. |
| **MỚI-3 · CSS popup** `app.css` **4358–4366** | `#thay-doi-cho-duyet-dialog > section { width: min(760px, 100%); }` — trả lại bề ngang mà `.yk-dialog > section { width: min(620px, 100%) }` (dòng 4300) đã bóp. **Chỉ một luật**: `max-height`/`overflow` do `.qlcv-dialog > section` và `.qlcv-dialog-content` lo sẵn. |
| **MỚI-5** `server/src/modules/assignments/service.js` | Tách hằng `VAI_DUOC_DOI_PHAN_CONG` (**46**) = bốn vai lãnh đạo, dùng chung cho cả hai hàm. `assertAssignmentActor(user, input, current, ctx)` (**53**) nhận thêm `ctx`; `moKhiLapMoiCapBa = ctx?.taoMoi === true && Number(ctx?.level) === 3` thì **bỏ hai vế khoá** `supervisor_ids` và `assignee_id`. `doiLeaders` **cố ý không** phụ thuộc `moKhiLapMoiCapBa` ⇒ `leader_ids` khoá ở **mọi** trường hợp. Thêm hàng rào **MỚI** `assertAssigneeCungPhong(user, assigneeId, client)` (**95**): vai lãnh đạo đi thẳng; còn lại chỉ giao được cho người **cùng phòng**, `is_active`, và **hai người cùng `department_id == null` thì KHÔNG coi là cùng phòng**. |
| **MỚI-5 · chỗ gọi** `server/src/modules/workItems/service.js` **392–412** | `create` truyền `ctx { taoMoi: true, level }` vào `assertAssignmentActor`, rồi gọi **liền sau đó** `assertAssigneeCungPhong(user, assignee.fields.assignee_id ?? input.assignee_id ?? null, client)`. `assertSupervisorsByLevel` **vẫn chạy** nên BLĐKS cấp 3 vẫn phải là MỘT TRONG các BLĐKS của công việc con chứa nó. RBAC `create` của vai Nhân viên (`assigned_in_work`) **không đổi**. |
| **MỚI-6** `server/src/modules/taskFiles/service.js` | `apTuDong` (**410**) nay: nếu không phải TP/PP ⇒ `cho-xem`; ngược lại **đọc lại `ghiDe`** qua `permissionsRepo.listByVai(user.role)` (vì `nguoiNop` là dòng `users` do `repo.nguoiTheoId` lấy ra, **không phải `req.user`**) rồi trả `phaiTrinhLanhDao(nguoiNop, item) ? 'cho-lanh-dao' : 'cho-xem'`. `phaiTrinhLanhDao` (**864**) giữ đúng **ba** lý do: `gui_bld_phe_duyet === true` · người bấm là `assignee` · `file:approve !== 'cho-phep'`. Tách `laChuBanNhom` (**442**) ra khỏi `duocGuiBanLuu` (**433**) để `guiDiDuyet` báo đúng lý do; thêm `tpPpLaChanhCuoi` (**456**). `BANG_VERDICT` mở `hoan-thanh` ở cả `luu-tam` (**922**, **1035**); `quyenFile` theo kịp ở **1280** và **1703**. **R6 vẫn giữ: `apTuDong` KHÔNG BAO GIỜ trả `'da-duyet'`.** |
| **Buster** | `web/index.html` bốn chỗ `20260912-01 → 20260912-02` (dòng **21** `app.css?v=`, **1230** `app.js?v=`, **1232** `project-details.js?v=`, **1233** `phase8b-review.js?v=`) + banner `console.info("[QLCV] app.js 20260912-02");` ở `app.js:9`. `node tools/local-assets-check.mjs` in `Ban app.js = 20260912-02 (index.html khop).` exit 0. |

### 13.3 Test

| File | Nội dung |
|---|---|
| `server/tests/integration/approvals-pending-da-sua.test.js` — **MỚI, 11 ca** | Đi **đường HTTP thật** với CSDL thật: (i) việc gửi lần đầu ⇒ `da_sua === false`, `moc_xu_ly === null`; (ii) duyệt xong rồi sửa một trường nội dung ⇒ dòng chờ kế tiếp `da_sua === true` và `moc_xu_ly` đúng bằng lúc vừa duyệt; (iii) sửa **hai lần** sau một mốc ⇒ vẫn `true`, `moc_xu_ly` **không** trôi theo lần sửa; (iv) trả về rồi sửa ⇒ mốc là lúc **trả về**, không phải lúc duyệt; (v) `create` **không** sinh `da_sua` (vì `create` không nằm trong `SUA_NOI_DUNG`); (vi) vai **không** có ghi đè `cho-duyet` ở `update` thì sửa không hạ cây ⇒ không có dòng chờ mới; (vii) `listPendingDeletes` không mang hai cột này; (viii) hình dạng các trường cũ **không đổi**. Hai ca cần chèn `permission_overrides` (`gia_tri='cho-duyet'`, `action='update'`) vì `cho-duyet` **không** phải mặc định của vai nào — `req.user.ghiDe` nạp lại ở mỗi request nên chèn giữa ca có hiệu lực ngay. |
| `server/tests/unit/approvals-ui.test.js` — **23 ca** (thêm describe «MỚI-3 + MỚI-4 — hình dáng trong app.css», 4 ca) | (1) luật nút bé phủ **cả ba** class dòng, có `font-size: 11px` / `padding: 3px 9px` / `min-height: 24px`, **không** `!important`, icon `10px`; (2) `.duyet-nhan {` có `font-size: 11px`, `Object.keys(window.NHAN_DUYET).length === 3`, mọi `cfg.mau` **không** khớp `/text-\[/` (Tailwind đóng băng không có class tuỳ ý), có `.duyet-nhan + .duyet-nhan { margin-left: -4px; }` và **không** có `.duyet-nhan { margin-right: -4px`; (3) `#thay-doi-cho-duyet-dialog > section { width: min(760px, 100%); }` và **không** có luật `.yk-noi-dung` thừa; (4) **pin class Tailwind** — mọi class màu của nhãn (`bg-emerald-100`/`text-emerald-800`, `bg-blue-100`/`text-blue-700`, `bg-red-100`/`text-red-700`, `bg-gray-100`/`text-gray-600`, `bg-amber-100`/`text-amber-700`) và `whitespace-nowrap` phải **có thật** trong `tailwind.min.css` — đo bằng `readFileSync` + `toContain(".<tên>{")`. **PIN THẲNG VÀO CSS** theo lệ `tasks-results-design.test.js`: MỚI-4 là thay đổi **thuần CSS**, không một dòng JS nào gác được, nếu ai dời bề rộng/cỡ chữ sang class Tailwind chết thì test này đỏ. |
| `server/tests/integration/assignments.test.js` + `phase8c-files.test.js` | Cộng với `approvals-pending-da-sua.test.js` chạy cùng nhau: **84 passed (84)**. `assignments`: cán bộ lập mới cấp 3 đổi được `supervisor_ids`/`assignee_id` nhưng **không** đổi được `leader_ids`; sửa nhiệm vụ có sẵn vẫn **403**; giao khác phòng ⇒ **403 «Cán bộ chỉ được giao nhiệm vụ cho người cùng phòng»**; BLĐKS ngoài danh sách cấp 2 ⇒ bị `assertSupervisorsByLevel` chặn. `phase8c-files`: TC-V8-01b/01c — nhiệm vụ **không** tích thì `apTuDong` trả `cho-xem` và `duocGuiBanLuu === false`; **có** tích thì `cho-lanh-dao`; mọi ca đều khẳng định **không bao giờ** `da-duyet`. |
| `server/tests/unit/xss-guard.test.js` — **11 ca** | Pin đổi `100/978` → **`{ sink: 101, gia_tri: 986 }`**: **+1 sink** (`content.innerHTML = than` trong `moPopupThayDoiChoDuyet`, giá trị đi qua `buildNhatKyDong` đã thoát sẵn), **+2 CAN-THOAT** (hai lời gọi `nhanDuyetHtml(...)` ở builder DOM, danh sách **21 → 23** chỗ), **+8 nội suy** còn lại. `cfg.mau` tuy là hằng đóng băng **vẫn** bọc `escapeHtmlAttr` để khỏi khai ngoại lệ. |
| **Full** `npm test` từ `server/` | **2076/2076 · 115 file · Duration 271.98s · exit 0** (mốc trước 2043/114). `npm run lint` exit 0. `npm run format:check` còn đúng **2 nợ cũ** ngoài phạm vi (`src/modules/workItems/tyLe.js`, `tests/integration/stats-parity.test.js`). |

### 13.4 Bẫy gặp phải (đừng phát hiện lại)

1. **`DA_XU_LY` mà thêm `submit` hoặc `create` là hỏng cả hai chiều.** Thêm `submit` ⇒ mọi việc vừa gửi đã
   có mốc, và một lượt sửa trước đó bị coi là «sau mốc» ⇒ `da_sua` **true giả**. Thêm `create` ⇒ mốc lùi
   về số 0 ⇒ `da_sua` **vĩnh viễn false**. Đúng hai hành động: `approvals.approve` và `approvals.return`
   — tức là đúng hai chỗ **việc đi qua tay người duyệt**.
2. **`da_sua` tính ở giao diện là false positive có hệ thống.** Bản đầu so `created_at` của việc với một
   mốc đoán ở client: sai khi đồng hồ lệch, sai khi `/history` bị cắt trang, và **không thể test**. Chuyển
   về `LEFT JOIN LATERAL` một lần duy nhất, rồi **trả kèm `moc_xu_ly` trong dòng** để popup lọc lại đúng
   chính mốc đó — hai nơi phải dùng **cùng một con số**, không phải cùng một **công thức**.
3. **Hai bảng chữ ở hai tầng phải trùng khớp từng phần tử.** `HANH_DONG_SUA_NOI_DUNG` (app.js) lệch
   `SUA_NOI_DUNG` (repo.js) một action thì popup hiện thiếu/thừa một loại lượt đổi mà **không có lỗi nào
   báo**. Muốn chắc thì pin bằng test: đọc cả hai nguồn rồi **so tập hợp**, không so thứ tự.
4. **Popup PHẢI tái dụng `buildNhatKyDong`.** Tự dựng HTML cho popup là thêm một sink XSS phải khai ngoại
   lệ, là lặp lại đúng phần «Nhật ký» mà người dùng đã nghiệm thu, và là hai chỗ phải sửa mỗi khi đổi cách
   in một lượt thay đổi. Tái dụng thì sink mới vẫn là `innerHTML` **một** lần, giá trị đã thoát sẵn.
5. **Nhãn «Mới/Sửa/Xoá» là CHỮ CỦA LUẬT, không phải trang trí.** Ba builder (hai trả chuỗi, một dựng DOM)
   mà mỗi nơi tự viết chữ thì sớm muộn cũng lệch. Giải pháp: **một** bảng `NHAN_DUYET` đóng băng, hàm
   `nhanDuyetHtml` cho đường chuỗi, và đường DOM **đọc lại đúng bảng đó** qua `textContent`.
6. **`tailwind.min.css` là artifact đóng băng nên không có class tuỳ ý.** `text-[11px]` **không tồn tại**
   trong 39780 byte đó ⇒ nút **không** bé đi và **không** có lỗi nào báo. Cỡ chữ lạ phải viết luật trong
   `app.css`; còn class màu thì phải **pin ngược** (đọc file min, `toContain(".<tên>{")`) để biết chắc
   class mình dùng có thật.
7. **Đừng pin «cả file app.js không có `text-[11px]`».** app.js còn **11** chỗ nợ cũ dùng đúng class đó,
   ngoài phạm vi đợt này. Pin phải thu hẹp vào đúng thứ đợt này sinh ra: `Object.values(NHAN_DUYET)` và
   `APP_SRC.match(/duyet-nhan[^"'`]*/g)`.
8. **`.duyet-nhan { margin-right: -4px }` thụt cả nhãn đứng một mình.** Hai nhãn cần dính nhau thì dùng
   selector anh-em `.duyet-nhan + .duyet-nhan { margin-left: -4px; }` — chỉ phần tử **thứ hai** bị kéo.
9. **Mở hai ô phân công mà không bó phòng thì cán bộ giao việc RỘNG HƠN Trưởng phòng.** RBAC `create` của
   vai Nhân viên (`assigned_in_work`) chỉ xét phòng của **CÔNG VIỆC**, không xét phòng của **NGƯỜI ĐƯỢC
   GIAO** ⇒ bắt buộc thêm `assertAssigneeCungPhong`. Và: **hai người cùng không có phòng thì không được
   coi là cùng phòng** — `null === null` không phải là một phòng.
10. **So hai mảng id phải chuẩn hoá trước khi so.** `JSON.stringify((v ?? []).map(Number).sort((a,b) =>
    a-b))` — so trực tiếp thì `[3,7]` ≠ `[7,3]`, và mọi lần lưu **không đổi gì** cũng bị coi là «đã đổi
    Ban lãnh đạo» ⇒ **403 oan**, người dùng tưởng form hỏng.
11. **`leader_ids` cố ý KHÔNG mở, kể cả khi lập mới cấp 3.** Chỉ đạo chỉ nói tới «Ban lãnh đạo kiểm soát»
    và «Người thực hiện trực tiếp». Mở luôn ô thứ ba là **nới quyền ngoài phạm vi được giao** — và
    `leader_ids` là ô quyết định **ai duyệt cây**, tức là đúng chỗ chống tự duyệt còn có nghĩa.
12. **`apTuDong` phải ĐỌC LẠI `ghiDe`, không được dùng `req.user`.** `nguoiNop` được dựng từ dòng `users`
    do `repo.nguoiTheoId` lấy ra để giả lập «người nộp là TP/PP đó» — dòng đó **không có** `ghiDe`, nên
    nếu chuyển `user` thẳng vào `phaiTrinhLanhDao` thì `giaTriHieuLuc(user, 'file', 'approve')` luôn trả
    mặc định ⇒ nhánh thứ ba của nó **luôn đúng** ⇒ lại đẩy lên `cho-lanh-dao` y như lỗi cũ, chỉ khác lý do.
13. **Tách `laChuBanNhom` khỏi `duocGuiBanLuu` để phân biệt 403 và 409.** Người bấm **mất quyền** (không
    phải chủ bản / không cùng phòng) là **403**; người bấm **có quyền nhưng không còn ai để gửi** là
    **409**. Gộp hai điều kiện vào một hàm thì `guiDiDuyet` chỉ còn biết «không gửi được» và chọn bừa một
    mã — đã trả giá một lần khi **TC-V4-02** nhận 409 thay vì 403.
14. **Ẩn nút mà không mở lối ra là tạo thế kẹt.** Nếu TP/PP mất «Gửi đi duyệt» mà `hoan-thanh` **không**
    mở ở `luu-tam` thì họ không còn cách nào chốt việc. Người dùng đã chọn phương án **«Ẩn nút, chỉ còn
    «Hoàn thành»»** ⇒ phải mở `BANG_VERDICT` cho `hoan-thanh` ở `luu-tam` (**cùng một đợt**), và giữ Q1:
    nhóm **chưa có bản nào** thì vẫn **không** hiện nút chốt, vì chưa có gì để chốt.
15. **R6 không bị nới theo.** Sửa `apTuDong` rất dễ trượt thành «TP/PP là chặng cuối ⇒ cho `da-duyet`
    luôn». **Không**: chặng cuối nghĩa là họ bấm **`hoan-thanh`** bằng tay, có lưu mốc người duyệt và lúc
    duyệt — đúng điểm bất hợp lý số 7 của đợt B. `apTuDong` chỉ chọn giữa `cho-xem` và `cho-lanh-dao`.

### 13.5 Còn nợ

- **Nhãn «Mới/Sửa/Xoá» chưa có cột lọc.** Ba bảng chờ duyệt nay **nói rõ** duyệt cái gì nhưng chưa cho
  **lọc theo** nhãn (ví dụ «chỉ xem các ca Sửa»). Người dùng chưa yêu cầu; nếu cần thì thêm một bộ lọc
  client-side trên `data-da-sua` sẵn có, **không** mở RPC mới.
- **Popup «Xem các thay đổi» chưa so sánh được GIỮA HAI LẦN duyệt.** Nó chỉ liệt kê các lượt **sau mốc
  gần nhất**; muốn xem «lần duyệt trước đó người ta đã sửa gì» thì phải mở rộng `/history` theo khoảng
  thời gian — ngoài phạm vi đợt này.
- **`approval_changes` chưa có nhãn «Mới/Sửa».** Bảng đề nghị đổi tỷ lệ vẫn dùng nhãn riêng («Đổi tỷ lệ» /
  «Gửi BLĐ») vì bản chất nó **luôn là** một đề nghị sửa tỷ lệ; thêm nhãn «Sửa» vào đó là thừa chữ.
- **`nutVerdictFile` / `buildNutVerdictFile` vẫn là CODE CHẾT** trong `app.js` — nợ từ §11.6.5, chưa dọn.
- **Mười một chỗ `text-[11px]` nợ cũ trong `app.js`** vẫn còn (class không tồn tại trong Tailwind đóng
  băng) — ngoài phạm vi, **cố ý không sửa** để không đụng màn khác.
- ~~**Cổng nghiệm thu chưa qua:** người dùng test PC **9b.15 → 9b.25** rồi nói **«OK RIÊNG ĐỢT NÀY»**.
  Trước đó **không commit, không push, không deploy**.~~ — **ĐÃ DEPLOY LÊN VPS 12/09/2026 MÀ CHƯA NGHIỆM
  THU**: người dùng ra lệnh «deloy lên vps đi, đảm bảo vps chạy code mới nhất và ko lỗi, restart lại docker
  cho chắc», lệnh đó thay cho cổng nghiệm thu. Ba commit `b17f878` (máy chủ) + `3689bc2` (giao diện) +
  `7929f62` (tài liệu) đã push lên `vps/sua-loi-vat`; trên VPS `backup.sh` → `git pull --ff-only` →
  `bash deploy/restart.sh` **exit 0**, `pgmigrations` = **29**, buster qua nginx = **`20260912-02`**, log
  app 0 lỗi. **Việc còn nợ duy nhất: bấm 9b.15 → 9b.25 ngay trên `https://ttdt.site`** với **Ctrl+F5** —
  đây là dữ liệu thật, đừng tạo nhiệm vụ thử bừa; nếu bắt được lỗi thì ghi nguyên văn câu thông báo,
  **không tự sửa mã trên VPS**.
