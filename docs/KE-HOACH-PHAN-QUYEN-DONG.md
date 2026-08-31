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

## 7. VÒNG 13 (cùng ngày) — NÚT LƯU TỪNG BIẾN MẤT + dropdown lặp option (2 lỗi thật)

Phản hồi người dùng: «Không có nút lưu lại gì thay đổi à» + «dropdown hiển thị lựa chọn đang
dùng ở đầu nhưng sau đó vẫn bị thêm 1 dòng lựa chọn hiện tại nữa».

Kiểm tra ra **2 lỗi thật**:
1. **Nút Lưu biến mất từ Vòng 10**: khi thay toàn bộ khối Bảng phân quyền, trình sửa cũ bị xoá
   nhưng nút «Lưu bảng phân quyền» KHÔNG được render lại — `veBangPhanQuyen` chỉ gắn listener cho
   `#pq-save-btn` mà không có ai dựng nút ⇒ admin chỉnh xong không có cách lưu. Đã sửa:
   `veBangPhanQuyen` tự `insertAdjacentHTML` nút Lưu sau bảng rồi mới gắn listener (chỉ admin).
2. **Dropdown lặp option đang chọn**: option đầu (trạng thái hiệu lực) rồi lại theo sau bởi
   3 option tĩnh gồm chính nó. Đã viết lại: option đầu = trạng thái hiện tại (giá trị rỗng = về
   luật gốc), các option sau **loại trừ** trạng thái đó.

Test mới: TC-TKPQ-09 (nút Lưu render cho admin — fetch giả), TC-TKPQ-10 (mỗi select giá trị
duy nhất + option đầu là option được chọn). **1375 test / 81 file xanh**; lint + format sạch;
pin **96/698** (+1 sink nút Lưu); banner `app.js 20260829-8`, buster `-8`. Bẫy: thay cả một khối
lớn trong app.js phải rà lại MỌI id/hàm mà khối cũ liên quan tới (nút Lưu bị rơi là bằng chứng).

## 8. VÒNG 12c — TP/PP bị khoá nhầm sau khi có bảng phân quyền (3 lỗi thật)

Phản hồi người dùng: «1. CV con không cho TP/PP sửa (không thấy icon sửa) · 2. TP/PP không xem
được nhiệm vụ tab Quản lý Nhiệm vụ dù đã cho phép · 3. Bảng phân quyền trên user khác admin
hiển thị không đúng, không cập nhật».

Kiểm tra ra **3 lỗi thật**:
1. `coQuyenSuaCongViecCon` (project-details.js) viết từ vòng phân công ba lớp — chỉ cho admin +
   người nằm trong phân công của CV con. TP/PP không nằm trong phân công ⇒ không thấy icon dù
   ma trận §6 cho `subwork:update` theo phòng. Đã sửa: mở icon cho Phó GĐ + TP/PP (máy chủ
   `inScope` vẫn là rào chặn phạm vi); NV ngoài cuộc vẫn không thấy.
2. `dsNhiemVuToiDuocThay` (app.js) lọc nhiệm vụ chỉ theo: được giao · quản lý công việc ·
   phòng trong `dsPhongToiPhuTrach` (chỉ PGD). TP/PP rơi hụt ⇒ tab nhiệm vụ trống. Đã sửa: thêm
   nhánh TP/PP nhận nhiệm vụ theo phòng của công việc cha (`laLanhDaoPhong` + `tenPhongTaiKhoan`).
3. `oPhanQuyenHieuLuc` mô tả trạng thái gốc bằng 3 cột tĩnh `g/tp/pp/nv` (không có Giám đốc) và
   **không đọc ma trận server** ⇒ bảng sai và đứng im khi admin lưu ghi đè mới. Đã sửa: hàm nhận
   thêm `macDinh` (ma trận `PERMISSIONS` do `GET /api/v1/permissions` trả về) — ô gốc lấy từ
   ma trận server nên user khác F5 là thấy đúng ngay.

Test cập nhật: `project-details-phan-cong.test.js` 2 test icon (PGD/TP/PP thấy MỌI CV con,
NV ngoài cuộc 0). **1375 test / 81 file xanh**; lint + format sạch; pin giữ **96/698** (chỉ thêm
chuỗi tĩnh); banner `app.js 20260829-10`, buster `app.js?v=-10`, `project-details.js?v=-2`.
Bẫy mới (§13.5): **bảng quyền vẽ client phải lấy trạng thái gốc TỪ SERVER** (`GET /permissions`
trả ma trận) — đoán bằng cột tĩnh sẽ lệch vĩnh viễn với server.

## 9. VÒNG 12d — «Quản lý nhiệm vụ của Trưởng phòng không thấy» (race còn sót)

Tab Nhiệm vụ không hề bị ẩn theo vai — nó **trống**. Nguyên nhân: đúng bẫy race đã vá cho Phó GĐ
ngày 2026-08-28 nhưng chỉ vá một nửa — `loadDepartmentContext` chỉ vẽ lại khi `isDeputyDirector`
đổi trạng thái; TP/PP lần vẽ đầu chạy lúc `myDepartment` còn rỗng (bối cảnh phòng về sau) rồi
**không bao giờ được vẽ lại**. Đã sửa: điều kiện vẽ lại thêm `isDepartmentHeadUser || truocLaHead`.

Test: TC-TASKUI-17 viết lại theo luật mới (TP thấy nhiệm vụ phòng mình qua `myDepartment`, KHÔNG
dùng `visibleDepartments` của PGD), thêm TC-TASKUI-19 (bối cảnh rỗng ⇒ trống; bối cảnh về ⇒ thấy).
**1376 test / 81 file xanh**; banner `app.js 20260829-11`, buster `-11`.

## 10. VÒNG 12e — 3 lỗi người dùng báo + SOÁT TOÀN BỘ hiển thị theo vai

Phản hồi người dùng: «1. Phòng Quản lý Đào tạo có 4 công việc nhưng PHÓ PHÒNG chỉ thấy công việc
tháng 12, nhiệm vụ không thấy tháng nào · 2. Đang không sửa được chức năng nào của CÁN BỘ ·
3. Soát lại toàn bộ hiển thị theo đối tượng». Bổ sung giữa session: «riêng cán bộ thì thêm option
tạo, sửa thêm mới duyệt».

**Máy chủ KHÔNG sai** — đo trước khi sửa: `bootstrap.getBundle()` cho `pp01@test.local` (Phó phòng
PH01) trả **đủ 4 công việc** + 11 nhiệm vụ cấp 3; `departmentContext` trả
`myDepartment = 'Quản lý Đào tạo'`, `isDepartmentHead = true`. Toàn bộ mất mát ở trình duyệt.

| Lỗi | Nguyên nhân ĐO ĐƯỢC | Bản sửa |
|---|---|---|
| A1 — PP chỉ thấy 1 công việc | `getUserAllowedProjects()` có nhánh admin, Phó GĐ (`visibleDepartments`), `isManager()`, rồi rơi xuống luật cuối «việc mình đứng tên quản lý hoặc được giao» — **TP/PP không có nhánh nào**. Chạy app.js thật trong jsdom với dữ liệu PH01: trả `["CV008"]` thay vì cả 4. CV008 là công việc duy nhất PP đứng tên, chạy 01/12→31/12 ⇒ đúng cảm nhận «chỉ thấy tháng 12». **Trùng hợp dữ liệu, KHÔNG phải lỗi lọc tháng** (`workMatchesMonth` đã đúng luật giao khoảng) | Thêm nhánh TP/PP thấy công việc **phòng mình**, phòng lấy từ `tenPhongTaiKhoan()` — KHÔNG dùng `visibleDepartments` (kênh của Phó GĐ, bẫy §13.5). Tên phòng rỗng ⇒ giữ luật cũ |
| A2 — «nhiệm vụ không thấy tháng nào» | `dsNhiemVuToiDuocThay()` **chạy đúng** (Vòng 12c) — đo được cả 5 nhiệm vụ; lọc tháng cũng đúng: T6→1, T7→1, T8→3, T9→1, **T12→0**. Dữ liệu PH01 không có nhiệm vụ tháng 12, mà ô Tháng tab Nhiệm vụ **không có «Tất cả tháng»** (chỉ 1..12, mặc định tháng hiện tại) ⇒ mở tab ra đúng tháng trống | Thêm option «Tất cả tháng» (value 0) vào `dongBoOThangNamTasks`, nới `handleTasksMonthChange` xuống `so >= 0`. **Mặc định vẫn là tháng hiện tại**. Luật lọc không đổi |
| A3 — (chưa ai báo) 4 thẻ đếm nhiệm vụ = 0 | `renderTaskStats()` có bộ lọc RIÊNG hẹp hơn (chỉ việc của mình + công việc mình quản lý) ⇒ PGĐ/TP/PP thấy danh sách có nhiệm vụ mà 4 thẻ trên đầu hiện 0 | Dùng lại `dsNhiemVuToiDuocThay()` — một nguồn sự thật cho cả tab |
| B — «không sửa được chức năng nào của Cán bộ» | KHÔNG phải thiếu dropdown (Vòng 12b đã có 12 select `data-vai="Nhân viên"`). Lỗi thật: `buildBangPhanQuyenHtml` tra `ghiDe`/`macDinh` bằng **NHÃN cột** `'Cán bộ'` còn máy chủ khoá bằng **vai CSDL** `'Nhân viên'`. Đo được: hàng «Xem Công việc» hiện «✕ Tắt» dù ma trận cho `Nhân viên: work:read`; đặt ghi đè `work:update = cho-phep` vai `Nhân viên` thì ô đó **vẫn** «✕ Tắt». Nặng nhất: option đầu mang `value=""` ⇒ bấm Lưu gửi `'mac-dinh'` = **XOÁ SẠCH ghi đè vừa đặt** | Toàn bộ tra cứu đổi sang `vaiCot.vai`; `vaiCot.ten` chỉ còn để in `<th>`. `oPhanQuyenHieuLuc` nhận vai CSDL, bỏ nhánh chặn `=== 'Cán bộ'`; badge người thường giờ đọc ma trận + ghi đè thật (hàng Xem của Cán bộ là `👁 Phòng của mình` vì §6 cho họ đọc cả phòng) |
| B2 — Cán bộ cần ⏳ | Người dùng chốt giữa session | Server `permissions/service.js`: vai `Nhân viên` được `cho-duyet` ở **create + update**. **KHÔNG mở delete** — `'cho-duyet'` ở delete nghĩa là CHẶN xoá (`xoaDuocKhongKhiChoDuyet`) mà luồng duyệt-yêu-cầu-xoá chưa có, với vai chỉ xoá được nhiệm vụ của mình thì thành khoá cứng không có đường ra. Client: cột Cán bộ có ⏳ ở hàng Tạo/Sửa, không có ở Xoá. Không cần migration — CHECK `po_cho_duyet` (011) đã cho create/update/delete |
| C — ô lệch client↔server | Máy chủ cho TP/PP `update` **và** `delete` trên cả 3 cấp trong phòng mình (`PERMISSIONS` + `inScope` case `'Trưởng phòng'/'Phó phòng'`), nhưng thẻ công việc + Gantt chỉ hiện ✎/⧉/🗑 cho `laQuanTriTrongPhamVi()` hoặc người đứng tên, và `canUserDeleteResource` **không có nhánh TP/PP nào** | Thêm `laLanhDaoPhong()` vào `canUserDeleteResource` (project/subwork/task) và vào 3 điều kiện nút của `createProjectCard` + cụm Gantt. Máy chủ `inScope` vẫn bó phạm vi ⇒ ngoài phạm vi thì 403, đúng thiết kế đã ghi ở app.js «mở nút, không cấp quyền» |

### 10.1 MA TRẬN CHÂN LÝ 5 vai — client PHẢI khớp server

Nguồn sự thật: `PERMISSIONS` + `inScope()` (`server/src/middleware/rbac.js`) và ghi đè
(`modules/permissions`). Không ô nào của client được rộng hơn server.

| | tab Công việc thấy gì | tab Nhiệm vụ thấy gì | nút ✎/🗑 thẻ CV | icon ✎ CV con (modal) | Bảng phân quyền | TC chốt |
|---|---|---|---|---|---|---|
| **admin (Giám đốc)** | TẤT CẢ | TẤT CẢ | có | có | dropdown + nút Lưu; **không** tự ghi đè mình được | TC-TKPQ-06/09, TC-TASKUI-17, TC-PQ-07 |
| **Phó Giám đốc** | công việc các phòng mình phụ trách (`visibleDepartments`) | nhiệm vụ các phòng đó, kể cả giao người khác | có | có | badge trạng thái hiệu lực (đọc `GET /permissions`) | TC-PGD-UI-03, TC-TASKUI-14/15/16, TC-TKPQ-07 |
| **Trưởng phòng** | công việc **phòng mình** | nhiệm vụ phòng mình | có (Vòng 12e) | có (Vòng 12c) | badge | TC-TP-CV-01..05, TC-TASKUI-17, TC-TKPQ-15 |
| **Phó phòng** | như Trưởng phòng (§6 Quyết định 5) | như Trưởng phòng | có (Vòng 12e) | có | badge | TC-TP-CV-01..05 |
| **Cán bộ (`Nhân viên`)** | chỉ việc mình đứng tên / được giao nhiệm vụ | nhiệm vụ của mình | **không** | **không** | badge; ô Xem là `👁 Phòng của mình`, task:create/update/delete là ✓ | TC-TP-CV-04, TC-TKPQ-15, `project-details-phan-cong` |

Ô «Bảng phân quyền» cho admin: 12 hàng × 4 cột đều là dropdown mang **vai CSDL**; ô phạm vi
(«Tất cả phòng») chỉ có ở Phó GĐ/TP/PP — server chặn `phamVi: 'tat-ca'` cho `Nhân viên`
(TC-PQ-10, TC-TKPQ-14). ⏳ có ở: Tạo (mọi vai), Sửa (TP/PP + Cán bộ), Xoá (chỉ TP/PP) —
TC-TKPQ-13, TC-PQ-06, TC-PQ-13.

### 10.2 Hai bộ lọc THÁNG — cùng luật giao khoảng

| | tab Công việc | tab Nhiệm vụ |
|---|---|---|
| Hàm lọc | `workMatchesMonth(project, thang)` | `taskMatchesDateFilter(task)` |
| «Tất cả tháng» | có (value 0, **mặc định**) | có từ Vòng 12e (value 0; mặc định vẫn là tháng hiện tại) |
| Nằm trọn tháng | hiện | hiện |
| Vắt biên tháng | hiện (bắt đầu ≤ cuối tháng và kết thúc ≥ đầu tháng) | hiện |
| Không có ngày nào | **ẩn** khi đang lọc tháng | **ẩn** khi đang lọc tháng |

Cách so ngày khác nhau nhưng cùng kết quả: tab Công việc so chuỗi `'yyyy-mm-dd'`, tab Nhiệm vụ so
**số thứ tự ngày** (`soThuTuNgay`) — cả hai đều tránh bẫy `'yyyy-mm-dd'` = 00:00 UTC = 07:00 ICT
(§13.5). Chốt bằng TC-TASKUI-01..04 và TC-CV-BL.

Test: TC-TKPQ-11..15 (cột Cán bộ đọc vai CSDL, option đầu giữ giá trị ghi đè, ⏳ Tạo/Sửa không
Xoá, không có ô phạm vi, badge người thường), TC-TP-CV-01..05 (PP/TP thấy đủ 4 công việc phòng
mình, bối cảnh rỗng không nới, không dùng `visibleDepartments`, TP/PP sửa+xoá cả 3 cấp),
TC-PQ-13 (server cho Cán bộ `cho-duyet` ở create/update, chặn delete và chặn vai «Quản lý công
việc»), TC-TASKUI-12 (ô Tháng 13 option, mặc định vẫn tháng đang xem).
**1386 test / 81 file xanh**; lint + format sạch; pin XSS giữ **96/698** (chỉ đổi biểu thức
điều kiện, không thêm chỗ ghi HTML); banner `app.js 20260829-12`, buster `-12`;
`project-details.js` KHÔNG đổi nên không bump.

Bẫy mới (§13.5): **bảng phân quyền phải khoá bằng VAI CSDL** (`users.role`), nhãn hiển thị chỉ
để in. Tra bằng nhãn thì bảng vừa hiện sai vừa **âm thầm xoá ghi đè** khi bấm Lưu — không có
thông báo lỗi nào, vì `giaTri: 'mac-dinh'` là một lệnh hợp lệ.


