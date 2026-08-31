# KE HOẠCH — «BẢNG PHÂN QUYỀN ĐỘNG» (2026-08-29, Vòng 9)

Yêu cầu người dùng: bỏ đối tượng «Quản lý công việc» khỏi bảng; chuyển chú thích ký hiệu xuống
dưới cùng; **admin thay đổi được Phân quyền hệ thống bằng dropdown**.

## 1. Thiết kế đã chốt và TRIỂN KHAI trong session này

| Hạng mục | Quyết định |
|---|---|
| Lưu trữ | Bảng `permission_overrides` (migration **009**): `(vai, entity_type, action) → gia_tri`, PK bộ ba; CHECK giới hạn 3 thực thể nghiệp vụ (work/subwork/task), 5 hành động, 3 giá trị; «chờ duyệt» chỉ cho `create` |
| Giá trị ô | `''`/«mac-dinh» = luật gốc · **cho-phep ✓** được làm ngay (kể cả khi ma trận gốc từ chối) · **cho-duyet ⏳** được làm nhưng dòng mới rơi «Chờ duyệt» (chỉ create) · **tu-choi ✕** tắt hẳn |
| Phạm vi KHÔNG đổi | `inScope()` vẫn xét như quyền thường — ghi đè chỉ bật/tắt ô MA TRẬN, không bao giờ nới phạm vi dữ liệu |
| admin | Không chịu ghi đè (chính người sửa bảng), không cho ghi đè vai admin |
| Đọc ghi đè | `attachSession` nạp `user.ghiDe` (1 truy vấn/request, cùng kiểu với `delegations`) ⇒ `can()` vẫn **thuần, không đọc CSDL**; có hiệu lực NGAY, không cần đăng nhập lại |
| Tạo mới | `trangThaiDuyetKhiTao` đọc ghi đè `create` trước: cho-phep ⇒ «Đã duyệt», cho-duyet ⇒ «Chờ duyệt», không có ⇒ luật gốc |
| REST | `GET /api/v1/permissions` (ma trận gốc + ghi đè) · `PUT /api/v1/permissions` (mảng thay đổi; 'mac-dinh' = xoá) — **chỉ admin**, zod validate, ghi `permissions.update` vào activity_logs |
| Giao diện | Trang Quản lý tài khoản: bảng hiển thị (5 vai, bỏ Quản lý công việc) + khung «Sửa bảng phân quyền» **chỉ admin thấy** — dropdown từng ô (3 nhóm × hành động × vai) + nút Lưu |
| Bảo mật | Máy chủ là rào chặn cuối: kể cả admin tắt/bật gì, UI cũ và API đều qua `can()`; session hỏng đọc ghi đè ⇒ fallback về quyền gốc (không vỡ đăng nhập) |

## 2. Đã triển khai (commit này)

- Migration `009_permission_overrides.sql` (up/down) + `npm run migrate:up` đã chạy trên CSDL dev.
- `modules/permissions/` (repo/service/routes) + mount `/permissions` trong app.js.
- `session.js` gắn `user.ghiDe`; `rbac.js` lớp 4 đọc ghi đè; `approvals/rules.js` tôn trọng ghi đè create.
- Client: bảng hiển thị bỏ cột Quản lý công việc; chú thích ký hiệu xuống dưới cùng; trình sửa
  dropdown cho admin (`buildTrinhSuaPhanQuyenHtml` + `datGiaTriTrinhSua` + `luuPhanQuyen`).
- Test: unit `phan-quyen-ghi-de.test.js` (TC-PQ-10..13), integration `permissions-api.test.js`
  (TC-PQ-01..09), jsdom TC-TKPQ-01..08 cập nhật.

## 3. Còn nợ / ý tưởng tiếp theo (chưa làm)

1. **Ánh xạ ngược xuống 15 chức năng**: bảng hiển thị tĩnh chưa tự đổi theo ghi đè (người dùng
   sửa gì thì hàng tương ứng nên đổi nhãn ⏳/✕) — hiện trình sửa là nguồn chân lý động.
2. **Khôi phục một klik**: nút «Về mặc định tất cả».
3. **Ghi đè theo PHÒNG** (hiện theo vai toàn cục) — cần thêm cột department_id nullable.
4. **Quản lý công việc**: đã ẩn khỏi bảng + trình sửa; vai cũ vẫn hoạt động phía máy chủ cho dữ
   liệu cũ. Nếu bỏ HẲN: cần migration đổi role người dùng hiện có + dọn FORM_ROLE_MAP/DB_ROLES —
   chờ người dùng chốt (§13.4).

## 4. VÒNG 10 (cùng ngày) — dropdown trên BẢNG 15 chức năng + điều kiện phạm vi

Phản hồi người dùng: «Sao vẫn chưa thấy thay đổi» (bảng cũ 3 cột ở tab Cán bộ đã gỡ, bản mới nằm
trong trang «Quản lý tài khoản» — người dùng nhìn nhầm chỗ / chưa Ctrl+Shift+R) · «Sửa lại
dropdown tất cả các chức năng, riêng Phó Giám đốc / Trưởng phòng / Phó phòng thì thêm điều kiện
phòng mình phụ trách hoặc tất cả các phòng».

Triển khai:
| Việc | Chi tiết |
|---|---|
| Migration **010** | `permission_overrides` thêm cột `pham_vi text CHECK IN ('phong','tat-ca')` (mặc định 'phong') |
| Server | `repo`/`service`/`routes`: PUT nhận `phamVi`; **chỉ Phó GĐ/TP/PP được nới 'tat-ca'** (service chặn, 400); `GET /permissions` mở cho mọi vai đăng nhập (bảng không phải dữ liệu mật) — PUT vẫn chỉ admin |
| `can()` | `user.ghiDe` giờ là `{ gia_tri, pham_vi }`; `pham_vi === 'tat-ca'` ⇒ **bỏ qua inScope()** sau khi ma trận/ghi đè cho phép (lớp 4); `trangThaiDuyetKhiTao` đọc object form |
| Client | **Bảng 15 chức năng trở thành trình sửa**: 12 hàng nghiệp vụ × 4 vai là dropdown (Mặc định/✓/⏳/✕) + hàng Phó GĐ/TP/PP có thêm dropdown **phạm vi** (Phòng phụ trách / Phòng mình ⟷ Tất cả các phòng); nút **Lưu bảng phân quyền** dưới bảng; người thường thấy trạng thái hiệu lực (badge + ghi chú «Ghi đè», «TẤT CẢ các phòng»); trình sửa kỹ thuật riêng của Vòng 9 ĐÃ GỠ |
| Whitelist XSS | +5 (màu ký hiệu hằng `MAU_KY_HIEU[cell.s]`, 4 chỗ gọi `o(row.*)` của hàng chỉ hiển thị) −1 (`luaChon` đã xoá); sink `""` 10 → 9 |

Test: TC-PQ-01..10 (mới thêm 10: scope «tat-ca» nới TP sang phòng khác, vai khác bị cản); jsdom
TC-TKPQ-01..08 viết lại cho builder động (48 ô dropdown + 36 ô phạm vi, badge ghi đè, ký hiệu
dưới cùng). **1371 test / 81 file xanh**; lint + format sạch; pin **95/694**; banner
`app.js 20260829-5`, buster `app.js?v=20260829-5`. Deploy: migrate 010 + restart Node + sync web/.

Câu hỏi chờ người dùng (§13.4): «Tất cả các phòng» có nên giới hạn ở các phòng người đó ĐANG
phụ trách tại thời điểm kiểm (giống ủy quyền) hay nới tuyệt đối? Hiện triển khai theo «nới toàn
bộ inScope» — đơn giản, dễ hiểu, ghi dấu trong nhật ký.

## 5. VÒNG 11 (cùng ngày) — theo phản hồi ảnh: 4 chỉnh trên bảng phân quyền

| Yêu cầu | Triển khai |
|---|---|
| Chú thích (khung đỏ) xuống dưới cùng | Khung cha `#account-permission-table` có class `the-tai-khoan` là **grid 2 cột** — bảng và chú thích đứng cạnh nhau (đúng ảnh người dùng gửi). Đổi class khung thành `w-full` + bọc chú thích `col-span-full` ⇒ luôn nằm dưới bảng |
| Bỏ «Mặc định», thay bằng giá trị đang sử dụng | Option đầu của dropdown là **«Đang dùng: ✓ Đang cho phép / ⏳ Đang chờ duyệt / ✕ Đang tắt» + «(ghi đè)»/«(mặc định)»** — suy từ ghi đè ưu tiên, không có thì luật gốc (trangThaiDuyetKhiTao); value rỗng vẫn là «trả về luật gốc» |
| TP/PP thêm ⏳ cho Sửa/Xoá | Migration **011** nới CHECK `po_cho_duyet` (create/update/delete); service chặn luồng cho read/approve và cho vai ngoài PGD/TP/PP. Ý nghĩa chạy: **Tạo** ⇒ dòng mới «Chờ duyệt»; **Sửa** ⇒ `phaiChoDuyetKhiSua` (mới) mở rộng luồng choDuyetLai — vai bị ghi đè sửa mục «Đã duyệt» (mọi cấp) quay về «Chờ duyệt»; **Xoá** ⇒ `xoaDuocKhongKhiChoDuyet` (mới) CHẶN xoá với câu «Quản trị yêu cầu Xoá phải qua duyệt…» — luồng duyệt-yêu-cầu-xoá chưa có (§13.4) |
| Dropdown 1 hàng | Hành động + phạm vi nằm NGANG trong cùng ô (flex gap-1, hai select flex-1) — hết 2 hàng xếp dọc |
| Cán bộ ghi rõ phòng của mình | Cột Cán bộ ở 12 hàng nghiệp vụ là badge **«👁 Phòng của mình»** (không dropdown, không nới được); chú thích thêm câu «Cán bộ chỉ thao tác trong phạm vi phòng của mình» |

Test: TC-PQ-06 viết lại (cho-duyet hợp lệ Tạo/Sửa/Xoá, chặn Xem/Duyệt), TC-PQ-11 (TP sửa công
việc đã duyệt ⇒ về «Chờ duyệt», trả `choDuyetLai`), TC-PQ-12 (xoá bị chặn 403 kèm câu rõ), jsdom
TC-TKPQ viết lại cho builder động. **1373 test / 81 file xanh**; pin **95/696**; banner
`app.js 20260829-6`, buster `app.js?v=20260829-6`. Deploy: migrate 011 + restart Node + sync web/.
Bẫy gặp lần nữa: **quên import** 2 hàm mới vào workItems/service.js ⇒ 37 test 500 INTERNAL khi
chạy full (đơn lẻ vẫn xanh tới khi đụng đúng đường) — thêm hàm vào rules.js phải rà cả hai service.

## 6. VÒNG 12 (cùng ngày) — option đầu dropdown chỉ là TRẠNG THÁI gọn

Người dùng: «Bỏ luôn dòng đang cho phép, đang chờ duyệt, đang tắt… lựa chọn đang như nào thì
hiển thị như thế thôi». Đã bỏ nhãn «Đang dùng:…» và đuôi «(ghi đè)/(mặc định)»; option đầu của
dropdown giờ chỉ là trạng thái hiệu lực hiện tại, gọn: **«✓ Cho phép» / «⏳ Chờ duyệt» /
«✕ Tắt»** (+ «· TẤT CẢ các phòng» nếu ô đang nới phạm vi). Value rỗng vẫn có nghĩa trả về luật
gốc (title «Chọn để trả về luật gốc»). Người thường vẫn thấy badge mô tả đầy đủ («Ghi đè: …»)
bên ngoài dropdown. Banner `app.js 20260829-7`, buster `-7`; pin giữ **95/696**; full suite xanh.

