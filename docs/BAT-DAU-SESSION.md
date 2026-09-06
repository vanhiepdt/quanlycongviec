# Bắt đầu một session mới — dán prompt, chạy, không phải nhớ gì

File này để **mở một session AI mới** mà không mất thời gian dò lại dự án đang ở đâu. Nguồn sự
thật về tiến độ vẫn là **§13 của `KE-HOACH-VPS.md`**; file này chỉ là bàn đạp.

Thứ tự dùng: đọc mục 1 (đang ở đâu) → copy prompt ở mục 2 hoặc 3 → dán vào session mới.

---

## 1. Đang ở đâu (cập nhật mỗi khi xong một phase)

| | |
|---|---|
| Nhánh đang làm | `vps/phase-8-hatang` — **PHASE 8: hạ tầng VPS — việc 1–4 + 7 ĐÃ XONG (2026-09-06)**: `https://ttdt.site` chạy thật (mã Zalo 43 test · Dockerfile + compose · deploy `/opt/qlcv` · nginx HTTPS + HSTS · hardening + sao lưu cron 02:00 + drill khôi phục ~2 giây + `deploy/runbook.md`). **Chờ người dùng**: việc 5 (DNS A `office.ttdt.site` → 157.10.199.148 ⇒ certbot + e2e `.docx`) · việc 6 (XOAY token Zalo ⇒ dán vào `deploy/.env` ⇒ `zalo:kiem` + `zalo:webhook`). Nhánh trước: `vps/ket-qua-thiet-ke-lai` (tách từ `vps/ket-qua-file`) — **KẾT QUẢ NHIỆM VỤ LÀ FILE, thiết kế lại theo `docs/moi.xlsx`, đợt 1 + đợt 2 ĐÃ XONG** (014 + 015 + **016**): hai bảng **8 cột**, dòng cha 1. 2. 3. + dòng bản 1.1/1.2 thu gọn sau ▸, một menu ⋯, khai kết quả **trước** khi có file («Chưa có»), «Báo cáo» là bản **không có file**, form **TẠO nhiệm vụ** hiện bảng ngay. Test tay ở `docs/HUONG-DAN-TEST-GIAO-DIEN.md` mục **9b**–**9b.10**. Nhánh trước: `vps/ket-qua-file` (tách từ `vps/quan-ly-nhiem-vu-pgd` HEAD `3a36adc`) — session 2026-09-01 làm **KẾT QUẢ NHIỆM VỤ LÀ FILE** (014): khối «Kết quả» ở tab THÔNG TIN của nhiệm vụ (thay ô «Link kết quả»): mỗi file 1 dòng + lịch sử bản + ý kiến, nộp Word/PDF → góp ý → duyệt theo Bảng phân quyền động (`file:create`/`file:approve`, ✓ = phê duyệt luôn «Tự động»), TP chốt = `hoan-thanh`, PGD/GĐ «Duyệt» = `da-duyet`; kế hoạch + § ĐÁP Nextcloud/OnlyOffice ở `docs/KE-HOACH-KET-QUA-FILE.md`. Việc ngoài kế hoạch đã xong: tab «Quản lý Nhiệm vụ», Phó Giám đốc thấy tab «Quản lý công việc», **ủy quyền có thời hạn**, bộ lọc một dòng + Tháng/Năm cho «Quản lý công việc», trang «Quản lý tài khoản», **siết ủy quyền theo §13.4 mục 17/18/20** (thứ bậc + cùng phòng + phê duyệt của người được ủy quyền), **ô «Người nhận» của form ủy quyền là Ô CHỌN NGƯỜI** (danh sách đúng luật máy chủ), **Phó Giám đốc thấy hết nhiệm vụ của CÁC phòng mình phụ trách** trong tab «Quản lý Nhiệm vụ», **NHẬT KÝ TỪNG LẦN CHỈNH SỬA — tab «Nhật ký» trong modal sửa của cả 3 cấp, công việc cha thấy hết của con và cháu** (`docs/KE-HOACH-NHAT-KY.md`), và **TÊN RIÊNG THEO TỪNG THÁNG cho đầu việc dài hơn một tháng** (`docs/KE-HOACH-TEN-THEO-THANG.md`), và **PGĐ thấy công việc/nhiệm vụ NGAY lần vẽ đầu sau khi đăng nhập** (vá race condition `loadDepartmentContext`, `5a17fab`), và **«HOẠT ĐỘNG GẦN ĐÂY» ở Tổng quan đọc được** — hết rác `rpc.*`/`bootstrap.get`, nhãn tiếng Việt, bỏ mã trong mô tả tên theo tháng (2026-08-29, `docs/NHAT-KY-HOAT-DONG-GAN-DAY.md`), và **VÒNG 7: bỏ nốt mã khỏi tên công việc/CV con/nhiệm vụ · «Tạo mới» hết nhảy đầu trang · TP/PP/PGD thêm được công việc** (`docs/NHAT-KY-GANTT-THEO-THANG.md` mục Vòng 7), và **BẢNG PHÂN QUYỀN HỆ THỐNG 15×6 vào trang Quản lý tài khoản** (Vòng 8), và **VÒNG 9: BẢNG PHÂN QUYỀN ĐỘNG — admin sửa bằng dropdown, bỏ đối tượng Quản lý công việc** (`docs/KE-HOACH-PHAN-QUYEN-DONG.md`), và **VÒNG 10: dropdown ngay trên bảng 15 chức năng + điều kiện phạm vi (phòng mình ⟷ Tất cả các phòng) cho PGD/TP/PP**, và **VÒNG 11→12c: 4 chỉnh bảng theo ảnh · nút Lưu bị mất đã khôi phục · Lưu im lặng do cột Cán bộ gửi nhãn thay vì vai · TP/PP bị khoá nhầm 3 chỗ (icon sửa CV con, tab nhiệm vụ trống, bảng quyền đứng im — nay bảng quyền đọc ma trận server)** (`docs/KE-HOACH-PHAN-QUYEN-DONG.md` §5–§8), và **VÒNG 12d: TP/PP thấy nhiệm vụ phòng mình — vá nốt race vẽ lại (bối cảnh phòng về sau giờ có vẽ lại cho TP/PP)** (`docs/KE-HOACH-PHAN-QUYEN-DONG.md` §9), và **VÒNG 12e: soát TOÀN BỘ hiển thị theo vai — TP/PP thấy công việc PHÒNG MÌNH (`getUserAllowedProjects` thiếu nhánh, chỉ thấy việc mình đứng tên) · tab Nhiệm vụ có «Tất cả tháng» · 4 thẻ đếm nhiệm vụ dùng chung phạm vi với danh sách · bảng phân quyền khoá bằng VAI CSDL nên cột Cán bộ sửa được thật (trước đó bấm Lưu là XOÁ ghi đè) · Cán bộ có ⏳ ở Tạo/Sửa · TP/PP sửa+xoá cả 3 cấp; kèm MA TRẬN CHÂN LÝ 5 vai ở §10** (`docs/KE-HOACH-PHAN-QUYEN-DONG.md` §10), và **VÒNG 13 ĐỢT 1/2: LUỒNG NHÁP → GỬI DUYỆT CẢ CÂY → DUYỆT CẢ CÂY** — migration **012** thêm trạng thái `Nháp` (chỉ người lập + admin thấy, không vào thống kê/Gantt/hộp duyệt), nút «Lưu nháp» ở form tạo, một nút «Gửi duyệt» ở cấp 1 gửi cả cây (hộp duyệt hiện MỘT dòng), **duyệt cha = duyệt cả cây** (thay luật cũ của TC-APR-16), **từ chối = XOÁ HẲN cả cây**, nút mới **«Trả lại để sửa»** đưa cả cây về nháp, màn duyệt có **«Xem chi tiết»** mở modal chi tiết ở chế độ **CHỈ-ĐỌC** (CV con chờ duyệt tô vàng + chữ «đang chờ duyệt»). **ĐỢT 2 ĐÃ XONG: duyệt nhiệm vụ cấp 3 + LUỒNG XIN XOÁ/DUYỆT XOÁ cả 3 cấp** — migration **013** (3 cột yêu cầu xoá, `approval_status` không đổi, mục xin xoá vẫn hiện + vẫn vào thống kê), hộp «Yêu cầu xoá» trong panel Chờ duyệt, +2 hàng bảng phân quyền, CSDL test cổng 5434 + global-setup retry mỗi lần một client (`docs/KE-HOACH-DUYET-CAY.md` mục 8). Nhánh trước: `vps/phase-7-misc` dừng ở `82e6958`, `vps/tinh-nang-phan-cong` ở `5cb6360`, `vps/phase-6-stats` ở `b2e65f1`, `vps/phase-5-approval` ở `5e89293` |
| Phase đã xong | **0**–**7** (Phase 7: đề nghị CRUD, quản lý App, chat REST + hỏi lại 10 giây, cron dọn chat >90 ngày, xuất Excel 3 mẫu, quyền xuất theo phạm vi — **cầu RPC 37/37 chạy thật, hết `pending()`**) **+ tính năng ngoài kế hoạch**: phân công ba lớp — migration `005_phan_cong.sql` (`works`/`work_items` thêm `supervisor_id`, `leader_ids`, CHECK `task_leader_single`), module `assignments/service.js`, endpoint `GET /departments/assignment-options`, giao diện form/modal; **Sơ đồ Gantt xem theo THÁNG** (2026-08-26, chi tiết `docs/NHAT-KY-GANTT-THEO-THANG.md`); **tab «Quản lý Nhiệm vụ»** (lọc Tháng/Năm/Cán bộ/Phòng + gom khối theo công việc con); **Phó Giám đốc** thấy tab «Quản lý công việc» (client `laQuanTriTrongPhamVi()`, máy chủ không nới quyền — `inScope()` đã bó theo `managedDepartmentIds`); **ỦY QUYỀN CÓ THỜI HẠN** — migration `006_delegations.sql` (`EXCLUDE USING gist` + `btree_gist` chặn trùng khoảng ngày cùng cặp người), **lớp 3 của `can()`** (quyền mượn khi `current_date` ∈ [from,to], `inScopeMuon()`, `viaDelegationId` ghi vào `activity_logs.details`), REST `/api/v1/delegations`, modal «Ủy quyền của tôi» + nhãn «đang được ủy quyền» (kế hoạch `docs/KE-HOACH-UY-QUYEN.md`); **PHÊ DUYỆT ỦY QUYỀN + thứ bậc + cùng phòng** (2026-08-28, §13.4 mục 17/18/20) — migration `007_delegations_approval.sql` (`status` DEFAULT `'pending'`, `accepted_at`/`declined_at`, EXCLUDE nới sang `('pending','active')`), `BAC_VAI` chặn ủy quyền lên cấp trên (`DELEGATION_RANK_UP`), bắt cùng phòng trừ 3 cặp ngoại lệ (`DELEGATION_DIFFERENT_DEPARTMENT`), `POST /:id/accept` · `/:id/decline` chỉ người nhận bấm được (admin **không** thay được), thông báo hai chiều trong bảng `notifications`, và ô chọn phòng hiện **riêng cho Giám đốc** ở form ủy quyền (`buildUyQuyenPhamVi()`); **trang «Quản lý tài khoản»** + bộ lọc một dòng của tab «Quản lý nhiệm vụ» + ô Tháng/Năm cho tab «Quản lý công việc»; **NHẬT KÝ TỪNG LẦN CHỈNH SỬA** (2026-08-28) — `?scope=self\|tree` cho `GET /:id/history`, `listForWorkTree` gom theo `work_id`, `utils/historyRefs.attachRefs`, vá lỗ hổng audit của `DELETE /work-items/:id`, tab «Thông tin \| Nhật ký» trong modal sửa công việc và nhiệm vụ (kế hoạch `docs/KE-HOACH-NHAT-KY.md`); **TÊN RIÊNG THEO TỪNG THÁNG** (2026-08-28) — migration `008_work_month_names.sql` (bảng rời, hai FK `work_id`/`item_id` + `CHECK` đúng một cái, unique **bộ phận** `ux_wmn_work`/`ux_wmn_item`), `PUT`/`DELETE /works/:id/month-names/:month` và `/work-items/:id/…`, bản đồ `monthNames` gắn vào 3 đường đọc, trình duyệt chọn tên theo tháng đang xem ở 2 tab + Gantt (kế hoạch `docs/KE-HOACH-TEN-THEO-THANG.md`) |
| Test đang xanh | **1670** trong 93 file, lint + `format:check` sạch — chạy lại trọn bộ ngày **2026-09-06**. Bốn vòng trong ngày: Vòng 14续13 vá giao diện (1588 → 1596, +8 test) rồi **THÔNG BÁO việc A** (1596 → 1625, +29 test: `thong-bao-ui.test.js` mới 18 test TC-TBUI-01..06 + `notifications-api.test.js` 23 → 34) rồi **PHASE 8 việc 1 — mã Zalo** (1625 → 1668, +43 test TC-ZL-01..14 trong 4 file: `zalo-service.test.js`, `zalo-push.test.js`, `zalo-webhook.test.js`, `zalo-lien-ket-ui.test.js`) rồi **VÁ BẢO MẬT LOG** (1668 → 1670, +2 test `logger-redact.test.js`: che header chữ ký webhook + mật khẩu lồng nhau — phát hiện secret webhook lọt TRẦN vào `docker logs`, đã vá redact `2aeebd3` + XOAY secret ngay trên VPS). Trước đó (2026-09-04, Vòng 14续11 — **ĐỢT 2 XONG**: migration **016** (`task_files.ten_ket_qua`/`dinh_dang`, `task_file_versions.noi_dung` + CHECK XOR file↔chữ ≥ 10); form **TẠO NHIỆM VỤ** hiện bảng 8 cột + dòng khai tạm **1.** (sửa «khi tạo mới không thấy bảng kết quả»); ＋ thêm dòng 2. 3. tại chỗ, gửi `POST /results` hoặc `/reports` sau khi có `taskId`; «Chưa có» = nhóm 0 bản; «Báo cáo» = bản không file. Test TC-KQ2-01..09 + TCKQ-34..40. Trước đó Vòng 14续10 — **3 việc người dùng báo sau khi xem bảng thật**: cột «Tên kết quả làm được» ở hàng chờ nay có **icon định dạng + «N bản»** ở dòng 1 và **tên file bản mới nhất** ở dòng 2 (`buildIconDinhDang`; repo trả thêm `ban_cuoi_ten`); **menu ⋯ dời ra `<body>`** khi mở nên không còn bị `.glass-card`/`.modal-content` cắt — CSS không sửa được vì hai thẻ đó có `backdrop-filter`, thứ biến chúng thành khối chứa của cả `position: fixed`; **khai bù 8 lớp Tailwind** mà bản cắt sẵn 39 KB không có (`bg-rose-600` … ⇒ badge số trên tab hàng chờ là chữ trắng trên nền trắng, badge «Chờ TP/PP xem» và «Đã duyệt» cũng mất nền); thêm **TCKQ-31/32/33**, TC-HCPD-01 kiểm `ban_cuoi_ten`. Trước đó Vòng 14续9 — **THIẾT KẾ LẠI hai bảng kết quả theo file `docs/moi.xlsx` của người dùng, đợt 1 chỉ HÌNH DÁNG, chưa migration**: khối «Kết quả» trong modal thành **bảng 8 cột** (Thời gian · Kết quả làm được · Định dạng · File đã tải lên · Người thực hiện · Ghi ý kiến · Tình trạng · Hành động) với dòng cha **1., 2., 3.** và dòng bản **1.1, 1.2 «Sửa lần N»** thu gọn mặc định; «Hàng chờ phê duyệt → Phê duyệt kết quả» thành **bảng phẳng 8 cột** (ba cấp cây thành ba CỘT, **gỡ `buildHangCayChoDuyet`**); mọi hành động gộp vào **MỘT menu ⋯**; «Định dạng» suy từ đuôi (`dinhDangCuaTen`), «Tình trạng» là **câu kể** kèm «Bị trả lại lần N» (`cauTinhTrangFile`, bản riêng `cauTinhTrangHangCho` cho hàng chờ vì REST đó không trả bảng luồng); thêm **TCKQ-23..30**, sửa TCKQ-16/20/21/22. Trước đó Vòng 14续8 — **mở PowerPoint / Excel / ẢNH cho kết quả nhiệm vụ + nới 20 → 50 MB**: whitelist 3 → **12 đuôi** (`.doc .docx .pdf .xls .xlsx .ppt .pptx .jpg .jpeg .png .gif .webp`), `.svg` **chặn có ý** (XSS lưu trữ), ảnh mở inline như PDF còn Excel/PPT luôn `attachment`, ONLYOFFICE ✎ thêm `cell`/`slide` và bỏ fallback `'word'`; thêm TC-TF-14b/14c/16b + TCKQ-05b/13b/13c/17b; Vòng 14续7 thêm **TC-NAV-01..07 «mục Hàng chờ phê duyệt mở cho MỌI vai có cửa duyệt»** sau lỗi «Giám đốc/Phó Giám đốc không thấy hàng chờ phê duyệt»; Vòng 14续6 thêm TCKQ-20..22 «bảng cây hàng chờ» + TC-HCPD-04 «lãnh đạo phụ trách nhận thông báo» + TC-PDPC-04..06 «khối phân công thu gọn / cây tách nhánh»). Pin XSS **106 chỗ / 903 giá trị** (`docs/XSS-4.6.md`). Banner + buster hiện tại: `app.js 20260906-1`, `app.css 20260905-1`, `project-details.js 20260902-1`. Form nhiệm vụ dùng lưới 1/3–2/3, bỏ ô link nhiều dòng; TP/PP chọn được Cán bộ trực tiếp. **Sau Vòng 14续7 phải `npm run seed:v14` lại** — data cũ để `leader_ids` rỗng nên hàng chờ của TP/PP trống và nộp file bị 403 «không phải lãnh đạo phòng phụ trách». **`deploy/.env` phải có 3 biến `ONLYOFFICE_URL` / `ONLYOFFICE_JWT_SECRET` / `ONLYOFFICE_CALLBACK_BASE`** — thiếu là nút ✎ sửa trực tuyến ẩn hẳn (không lỗi, chỉ mất tính năng); `vitest.config.js` đặt sẵn 3 biến giả nên **test xanh không chứng minh được ONLYOFFICE chạy** (cả một lớp lỗi CSP/callback từng lọt qua cổng 1519 ca). Trước đây mỗi lượt đỏ 1–4 ca *đổi chỗ*: gốc là `middleware/audit.js` ghi nhật ký ở `res.on('finish')` nên lượt ghi sống lâu hơn request; nay `flushAudit()` chờ đúng những lượt ghi đang bay, `resetTables()` gọi nó **trước** `TRUNCATE` — thấy đỏ ở test nhật ký thì **đừng** cho là đỏ giả nữa. Thư viện mới của Phase 7: `exceljs@4.4.0` (đã ghi §3.3) — cũng là thứ dùng để đọc `docs/moi.xlsx` khi ảnh thiết kế không mở được. Test jsdom chạy app.js thật đã có: `dept-select` (thêm `buildStaffEmailDatalist`), `project-form-phan-cong`, `task-form-candidate`, `project-details-phan-cong`, `gantt-ui`, `approvals-ui` (màn hình «Chờ duyệt» — 2026-08-28), `task-files-ui` (thêm **TCKQ-16..19 trang «Hàng chờ phê duyệt» 2 tab con**, **TCKQ-23..33 bảng «Kết quả» 8 cột / icon / menu ⋯**, và **TCKQ-34..40 form tạo hiện bảng + khai tạm**), `nav-cho-duyet` (**TC-NAV-01..07** — mục trên thanh điều hướng), `tasks-nhiem-vu-ui` (thêm TC-TASKUI-14..18 **phạm vi xem của PGĐ**, TC-TASKUI-19 **hết mã**), `pho-giam-doc-ui` (thêm TC-TP-UI **TP/PP thêm được công việc**, **TC-TP-CV-01..05 TP/PP thấy công việc phòng mình + sửa/xoá cả 3 cấp**), `uy-quyen-ui` (TC-UQ-15/16/18/18b/**19/19b**), `bo-loc-cong-viec` (thêm TC-CV-BL-2 **thẻ hết mã**, TC-CV-BL-3 **xin xoá vẫn vào thống kê**), `tai-khoan-ui` (TC-TKPQ-01..10 **bảng Phân quyền ĐỘNG + nút Lưu + dropdown không lặp**, **TC-TKPQ-11..16 (16: hàng «Duyệt Nhiệm vụ (cấp 3)» + hàng «Duyệt yêu cầu XOÁ» chỉ hiển thị) cột Cán bộ khoá bằng VAI CSDL**), `phan-quyen-ghi-de` (TC-PQ-10..13 **`can()` đọc ghi đè**), `nhat-ky-ui` (TC-NKUI-01..10), `ten-thang-ui` (TC-TENTHANG-25..38), `hoat-dong-ui` (TC-HD-01..06 «Hoạt động gần đây» — 2026-08-29) — thêm file jsdom mới thì **phải** khai vào danh sách `files` ở `server/eslint.config.js` |
| ⚠ Phạm vi xem của Phó Giám đốc ở trình duyệt | `visibleDepartments` là **TÊN** các phòng PGĐ phụ trách (bản sao đọc-only của `managedDepartmentIds`), có thể **nhiều phòng**. Chỗ nào lọc danh sách theo người đăng nhập thì phải có nhánh này, nếu không PGĐ thấy **trắng** (đã xảy ra ở `renderTasks()` ngày 2026-08-28): dùng `dsPhongToiPhuTrach()` / `dsNhiemVuToiDuocThay()` thay vì tự viết lại. Vai khác hoặc `visibleDepartments` rỗng ⇒ **không nới** — máy chủ (`inScope()`) vẫn là rào chặn cuối, và công việc chung (không phòng) thì máy chủ cũng không cho. **Bẫy thứ tự (2026-08-29)**: `handleSuccessfulLogin` vẽ **đồng bộ ngay**, còn `visibleDepartments` chỉ về **sau** bằng `getDepartmentContext()` bất đồng bộ ⇒ lần vẽ đầu chạy với `[]`, PGĐ thấy **trắng**, mà đổi tab lại thấy nên rất dễ chẩn đoán sai thành lỗi phân quyền máy chủ (đã mất một lượt điều tra: đo API thật cho **cả hai** tài khoản mới loại trừ được). Nay `loadDepartmentContext` **vẽ lại** 6 khung + Gantt khi `isDeputyDirector` bật hoặc vừa tắt; thêm chỗ nào lọc theo `visibleDepartments` thì **phải** đưa vào danh sách vẽ lại đó, và luôn kiểm bằng lần vẽ ĐẦU chứ không phải sau khi đã bấm qua lại |
| ⚠ Bẫy cột «Đối tượng» | Dữ liệu thật/seed ghi `users.object_type` = **`'Nội bộ'`**; chữ `'Người dùng'` chỉ có ở người tạo qua giao diện/REST. Lọc người thật **chỉ được** loại `'Nhà cung cấp'` (`!== "Nhà cung cấp"`), **đừng** viết `=== "Người dùng"` — đã làm ô chọn người nhận ủy quyền và `<datalist>` gợi ý email rỗng sạch ngày 2026-08-28. Khuôn test cũng phải mặc định `'Nội bộ'`, nếu không test xanh mà giao diện rỗng |
| ⚠ Nhật ký từng lần chỉnh sửa (3 cấp) | Đường đọc là `GET /works/:id/history` và `GET /work-items/:id/history`, mặc định `?scope=self` (**giữ nguyên hợp đồng cũ**); muốn xem cả cây thì thêm `?scope=tree` — cấp 1 gom theo **`work_id`** (nên **con đã bị xoá vẫn còn dấu**), cấp 2 gom nó + các cấp 3 của nó, cấp 3 luôn trả `self`. Máy chủ tự gắn `ref {kind, level, code, name, deleted}` cho từng dòng (`server/src/utils/historyRefs.js`) nên trình duyệt **không** phải gọi thêm cây; tên trong `activity_logs.details` là **dữ liệu cũ**, luôn phải đi qua `escapeHtml` khi vẽ. Thêm hành động ghi nhật ký mới thì khai nhãn vào `NHAT_KY_HANH_DONG` trong `app.js`, thêm cột mới thì khai vào `NHAT_KY_COT` — thiếu thì giao diện hiện thẳng tên hành động/cột của CSDL. Giới hạn đã biết: **cháu bị xoá cùng cha cấp 2** chỉ tra lại được ở nhật ký **cấp 1** |
| ⚠ Tên riêng theo từng tháng | Bảng `work_month_names` (migration **008**) giữ tên của **từng tháng SAU**; **tháng đầu luôn dùng tên gốc** (`MONTH_IS_FIRST`), tháng ngoài khoảng bị chặn (`MONTH_OUT_OF_RANGE`), PUT tên trắng = **bỏ** tên riêng. `ON CONFLICT` phải nêu **tên unique bộ phận** (`ux_wmn_work`/`ux_wmn_item`), không viết `(work_id, month)`. Máy chủ **không** chọn tên: `COL.P_NAME`/`COL.T_NAME` giữ **tên gốc**, chỉ gửi thêm bản đồ `monthNames` (REST trả `month_names`) — vì hai tab nạp một lần rồi lọc tháng tại trình duyệt và một lượt `/gantt` có thể trải nhiều tháng. Ở trình duyệt dùng `tenTheoThangCuaDong(dong, tenGoc, thang)` + `tenGocNeuDaDoiCuaDong(...)`, tháng lấy bằng `thangLocCongViec()` / `thangLocNhiemVu()` / `thangLocGantt()`; **đừng** đổi `data-name`/`data-project-name` hay ô «Tên» của form sang tên tháng (hộp thoại Xoá/Nhân bản/Cập nhật không có tháng nào trong tầm nhìn). Chỗ nào **không** có một tháng cụ thể — Tổng quan, thống kê, biểu đồ, xuất Excel, tìm kiếm — thì giữ tên gốc |
| Phase kế tiếp | **Phase 8b — SỬA LỖI VẶT** (prompt dán ở **mục 3b**): sửa trên PC, test xanh, push nhánh `vps/sua-loi-vat` rồi deploy VPS theo runbook; người dùng sẽ BỔ SUNG thêm lỗi vào danh sách trong prompt. Xong 8b mới tới **Phase 9**: bước 0 tạo admin đầu **ĐÃ XONG** 2026-09-06 (tài khoản `TTDT001`, psql + hash trong container), còn e2e OnlyOffice `.docx` + e2e Zalo `LIENKET`/đẩy duyệt (tạm gác để sửa lỗi vặt) rồi 9.1–9.7 trên `main` (§7.11) |
| Còn treo | **VIỆC B của THÔNG BÁO — đẩy sang Zalo: HẠ TẦNG CHẠY THẬT (2026-09-06)** — token MỚI hợp lệ (`zalo:kiem`), webhook `https://ttdt.site/api/zalo-bot/webhook` Zalo tự kiểm 200, sai chữ ký 403, lịch đẩy `*/2 * * * *` bật; secret XOAY hai lần vì bản đầu lọt `docker logs` ⇒ vá redact `logger.js` (`2aeebd3`, +2 test, suite **1670**). **Chỉ còn e2e với tài khoản thật** (`LIENKET` + đẩy duyệt) — chuyển **bước 0 của Phase 9** vì CSDL production chưa có tài khoản nào (đúng thiết kế). §13.4 mục 25 **đã trả lời 2026-09-06** — chấp nhận cả 4 câu ( ai giữ Bot Token · mỗi cán bộ tự nhắn `LIENKET <mã 6 số>` cho bot một lần vì Zalo **không** cho tra `chat_id` từ số điện thoại/email · đẩy loại nào — đề xuất chỉ `approval_pending`/`approval_rejected`/`overdue` · webhook đòi **domain công khai + HTTPS** nên tự liên kết chỉ chạy được từ Phase 8, trước đó gán tay). Kế hoạch đầy đủ + tài liệu Zalo đã tra: `docs/KE-HOACH-THONG-BAO.md`. **Test tay CHUÔNG THÔNG BÁO — mục 9b.12** (`app.js 20260906-1`, 6 bước): badge đúng số ngay khi đăng nhập và ẩn hẳn khi 0 · gửi duyệt ở tab khác thì badge tăng trong 1 phút **không** cần F5 · bấm dòng mở **đúng** công việc rồi dòng hết đậm · «đọc hết» xoá badge nhưng **không** xoá dòng · `fetch('/api/v1/notifications?userId=1')` **không** đọc hộ được của người khác (kể cả admin) · tab để trong nền **không** sinh request `unread-count`. **Test tay banner `20260905-2` — `docs/HUONG-DAN-TEST-GIAO-DIEN.md` mục 9b.11, 6 bước**: «Xem chi tiết» ở hàng chờ có khối «Thông tin công việc» dữ liệu thật · tạo xong công việc cha thì modal chi tiết cha tự mở để tạo tiếp con/nhiệm vụ · chân form TẠO dính đáy chỉ có «Hủy»/«Lưu tạm»/«Gửi đi duyệt», thanh tiêu đề **không còn** nút lưu · «Chờ duyệt» hiện ngay không F5, và nhiệm vụ cấp 3 **không** bị gán «Chờ duyệt» theo cha (đối chiếu `approval_status` bằng SQL) · ô «Báo cáo» bung thành hàng riêng hết chiều ngang bảng, xoá dòng thì xoá cả cặp và đánh số lại · menu ⋯ nổi **trên** modal, kể cả dòng sát đáy. **Test tay đợt 2 với banner `20260905-1` + migration 016; test form nhiệm vụ TP/PP và bố cục mới** (`docs/HUONG-DAN-TEST-GIAO-DIEN.md` mục **9b.10**, 6 bước): form «Tạo nhiệm vụ mới» phải thấy bảng 8 cột + dòng khai tạm **1.** ngay khi mở · ＋ thêm dòng 2. 3. tại chỗ, **không** mở hộp chọn file · form **công việc con (cấp 2) không** có bảng · lưu nhiệm vụ xong mở lại phải thấy dòng cha có tên đã khai và cột 4 «Chưa có» · nộp file đầu tiên thành **1.1**, lần sau **1.2** · định dạng «Báo cáo» là ô chữ ≥ 10 ký tự · hàng chờ lấy **tên khai** ở dòng 1 và nhóm chưa có bản **không** vào hàng chờ. **Test tay PGĐ với banner `20260828-87`**: đăng nhập *PGĐ Một* → **ngay lần vẽ đầu**, chưa đổi tab, chưa bấm gì, hai tab «Quản lý công việc» và «Quản lý Nhiệm vụ» phải có dữ liệu của `PH01`+`PH02`; *PGĐ Hai* tương tự với `PH03`+`PH04`; vào bằng vai khác thì **không** được nới thêm gì (đây là lỗi *chập chờn* — thấy trắng ở lần vẽ đầu rồi đổi tab lại thấy, nên phải soát đúng lần đầu). **D3–D8 UI**: máy chủ REST `/approvals/.../{submit,approve,reject}` + `pending-count` có từ Phase 5; `app.js` chưa có nút trên cây — **không** tự làm trừ khi người dùng yêu cầu. **Thông báo chưa có đường ĐỌC**: bảng `notifications` đã có dòng thật (ủy quyền ghi hai chiều) nhưng vẫn thiếu `GET /notifications` + chuông trên giao diện (§13.4 **mục 16** — câu đang chờ người dùng), nên người nhận thấy đề nghị ở chính trang «Ủy quyền của tôi». **Ủy quyền còn thiếu**: nhắc "sắp hết hạn" (chưa làm) và §13.4 **mục 19** (số người ủy quyền cùng lúc — vẫn để không giới hạn). **Test tay ủy quyền**: 8 bước của §12 `docs/KE-HOACH-UY-QUYEN.md` đã **kiểm chứng bằng REST 2026-08-28** trên CSDL nháp riêng (đã xoá) — còn phần **mắt người** (§10 + nhãn màu, hai nút Đồng ý/Từ chối, ô chọn phòng của Giám đốc, **ô CHỌN người nhận** — mở form ủy quyền bằng từng vai, xem danh sách hiện đúng ai) chưa chạy trên trình duyệt UAT. **Test tay tab «Quản lý Nhiệm vụ» với Phó Giám đốc**: banner phải là `20260828-84`, đăng nhập *PGĐ Một* (phụ trách `PH01`+`PH02`) — tab phải liệt kê nhiệm vụ của **cả hai** phòng kể cả việc giao người khác, ô lọc Phòng chỉ có hai phòng đó; *PGĐ Hai* (`PH03`+`PH04`) tương tự. **Test tay tab «Nhật ký»**: banner phải là `20260828-85` — mở modal **sửa** một công việc có sẵn công việc con và nhiệm vụ (`CV001`), bấm tab «Nhật ký» → phải thấy dòng của **cả 3 cấp**, mới nhất trước, mỗi dòng có nhãn cấp + mã + tên và câu `cột: cũ → mới`; sửa một nhiệm vụ rồi mở lại (đóng modal để nạp lại) → phải có dòng mới; xoá một nhiệm vụ → nhật ký **công việc cha** vẫn còn dòng xoá đó với nhãn *(đã xoá)*; mở modal sửa công việc con và nhiệm vụ → cũng phải có tab «Nhật ký», nút Lưu vẫn thấy. **Test tay tab «Tên theo tháng»**: banner phải là `20260828-86` — mở modal **sửa** một công việc dài hơn một tháng → tab thứ 3 «Tên theo tháng» liệt kê tháng 2..N (**không** có tháng đầu), lưu tên cho một tháng rồi xem tab «Quản lý công việc», tab «Quản lý Nhiệm vụ» và **Gantt** của đúng tháng đó → phải hiện tên mới, **di chuột** hiện tên cũ; chọn tháng khác hoặc «Tất cả tháng» → tên gốc; đầu việc gói trong một tháng thì **không** có tab ở cả 3 cấp; bấm «Bỏ» → về lại tên gốc ngay không cần tải lại trang. **Nợ nhỏ Phase 6**: modal «bấm số mở danh sách» lọc tháng/phòng **ở trình duyệt**; Gantt nhóm `assignee` hiện toàn cây con. **UAT M1** (mở 3 file `.xlsx` bằng Excel thật) chỉ máy kiểm được chữ ký `PK` + content-type, còn cần người ký |
| Đang chờ người dùng | **Không còn việc hạ tầng nào chờ người dùng** — DNS `office.ttdt.site` và token Zalo mới đều XONG 2026-09-06. Việc kế (tạo tài khoản ĐẦU + e2e người thật: sửa `.docx`, `LIENKET`, đẩy duyệt) là **bước 0 của Phase 9**, làm trong session — không chờ ai. **§13.4 mục 19** — một người được nhận ủy quyền từ mấy người cùng lúc (đang **không giới hạn**) — vẫn treo. Mục **16/17/18/20 đã trả lời** — xem §13.4. |
| Dữ liệu để làm việc | **Hai bộ, chọn theo việc.** (a) `npm run seed:v14` → **bộ Vòng 14 theo LUỒNG KẾT QUẢ LÀ FILE** (`server/src/db/seeds/dev-vong14.sql`): TRUNCATE sạch rồi dựng 2 phòng · 7 người `gd/pgd/tp/pp/nv1/nv2/nvb@test.local` (mật khẩu `Test@12345`, **không** bắt đổi) · 1 công việc → 1 CV con → **5 nhiệm vụ, mỗi cái một trạng thái file**: NV-01 chưa có file (bấm «Tải file lên» để chạy luồng thật, kể cả sửa trực tuyến), NV-02 `cho-xem`, NV-03 `can-sua`, NV-04 `cho-lanh-dao`, NV-05 `da-duyet` (khoá) · 8 thông báo mẫu. Bản/ý kiến/luồng có sẵn nhưng **file vật lý của NV-02..05 không tồn tại** trên đĩa (tải về báo «File trên máy chủ đã bị mất» — đúng thiết kế). (b) `npm run seed:dev` → **dữ liệu mẫu §8.3** (bộ cũ, giữ nguyên cho Phase 0–13): 5 phòng (`PH05` rỗng hoàn toàn), 13 người, 9 công việc, 13 công việc con, 17 nhiệm vụ, 7 nhắc việc, 5 đề nghị, 4 app, 12 tin nhắn, 6 thông báo, 20 dòng nhật ký. **Cố ý có dữ liệu bẩn** (email chữ hoa, trùng họ tên, nhiệm vụ mồ côi, link thiếu `http`, ngày 29/02) — đừng "sửa cho sạch". Hai bộ **loại trừ nhau**: bộ nào chạy sau thì xoá bộ trước |
| ⚠ CSDL dev đang bị chặn seed | CSDL `quanlycongviec` (dev) còn **5 dòng tay** từ lúc thử tay (`CV001` "Việc gốc"…) trùng `code` nhưng khác `level` ⇒ `npm run seed:dev` nổ `PARENT_NOT_SUBWORK` ở đó. Cách chữa: xoá 5 dòng đó rồi seed lại, hoặc seed sang CSDL khác (`DATABASE_URL=…/quanlycongviec_uat npm run seed:dev` — `loadEnvFile()` không ghi đè biến dòng lệnh) |
| ⚠ CSDL khói UAT dễ thiếu migration | `quanlycongviec_uat` **không** tự `migrate:up` khi dev có migration mới. Mỗi lần thêm migration: `DATABASE_URL=…/quanlycongviec_uat npm run migrate:up`. **Không còn nợ migration nào** (soát 2026-08-29): `008_work_month_names` đã có dòng `pgmigrations` **và** 2 dòng dữ liệu trong `work_month_names` trên `quanlycongviec_uat` — dòng "đang nợ 008" ghi trước đây là **sai**. Cách tự kiểm: `docker exec qlcv-dev-db psql -U qlcv -d quanlycongviec_uat -c "SELECT name, run_on FROM pgmigrations ORDER BY id DESC LIMIT 3;"`. `007_delegations_approval.sql` đã lên ngày 2026-08-28 (đã xác nhận có `status`/`accepted_at`/`declined_at` + dòng `pgmigrations`) |
| Tài khoản thử tay | **Bộ Vòng 14** (sau `npm run seed:v14`): `gd@test.local` (Giám đốc/admin) · `pgd@test.local` (Phó Giám đốc, phụ trách PH01+PH02) · `tp@test.local` (Trưởng phòng PH01) · `pp@test.local` (Phó phòng PH01) · `nv1@test.local` (Cán bộ — chủ 5 nhiệm vụ mẫu) · `nv2@test.local` (Cán bộ cùng phòng) · `nvb@test.local` (Cán bộ PH02 — **ngoài phòng**, mọi đường file phải 403). Mật khẩu chung `Test@12345`, **không** bắt đổi lần đầu. **Bộ cũ §8.3** (sau `npm run seed:dev`): `TEST001..TEST013` (§13.7), cùng mật khẩu, tất cả **bị bắt đổi** ở lần đăng nhập đầu, có đủ **6 vai trò** |
| Tự tay test giao diện | `docs/HUONG-DAN-TEST-GIAO-DIEN.md`. **Dựng môi trường: `chay-test.bat`** (mục 1.0) — nó dựng cả stack rồi tự kiểm 8 điểm ở bước `[7/7]`: bản `app.js` khớp `index.html`, migration mới nhất, `8099 /healthz`, **máy chủ đang nối CSDL nào** (đếm `pg_stat_activity` — bằng 0 là đang nối CSDL khác, đăng nhập sẽ trượt 401 dù mật khẩu đúng), Nginx phục vụ đúng bản, `ONLYOFFICE` bật/tắt + Document Server sống, và số bản file **có file thật trên đĩa**. Chọn bộ seed ngay ở menu: **2** = bộ cũ §8.3, **4** = bộ Vòng 14 (`/v14 /f` nếu chạy từ Git Bash). `chay.bat` = luôn xoá sạch + seed lại, thêm `/v14` để lấy bộ Vòng 14. **Luồng kết quả là file → mục 9b** (7 tài khoản, nộp file tên tiếng Việt, sửa trực tuyến + «Lưu thành bản mới», trang «Hàng chờ phê duyệt» hai tab). Tổng quan/Gantt giờ uống REST mới (`/stats/*`, `/gantt`) — mở mục Tổng quan là thấy 6 biểu đồ có số thật |
| Chạy lại lượt khói | `"C:\Program Files\Git\bin\bash.exe" tools/smoke-8.5.sh` (`bash` trần trùng WSL!) — **chạy từ gốc repo**, không từ `server/`. Cần một Nginx trỏ về máy chủ (xem mục 4) hoặc đặt `BASE=http://127.0.0.1:3000`. Script tự dọn dòng nó tạo (công việc / nhiệm vụ / đề nghị / app / thông báo `LIKE 'KHÓI 8.5%'`) và in số dòng còn lại để đối chiếu với seed (**sau seed: 14 / 36**). Đã có sẵn T5–T10 `/stats/*`, R1–R7 `/gantt`, R8–R10 đề nghị/chat, R11 CRUD app, R12 ba file `.xlsx`, R12b so phạm vi admin ↔ Nhân viên, R13 đếm cầu RPC |
| Dữ liệu thật (chỉ để đối chiếu) | Số liệu ở §13.8 (snapshot JSON **đã bỏ** — §13.4 mục 11). 28 dòng thật **nhập tay qua giao diện web** ở **Phase 9** (§13.4 mục 12) |

Nếu bảng này khác `KE-HOACH-VPS.md` §13.2 thì **§13.2 đúng** — sửa lại bảng này.

---

## 2. Prompt mẫu — thay `<PHASE>` rồi dán

```text
Dự án e:\quanlycongviec — chuyển hệ quản lý công việc từ Google Apps Script + Google Sheets
sang VPS (Node 24 + Express 5 + PostgreSQL 16 + Docker). Kế hoạch đầy đủ ở KE-HOACH-VPS.md.

TRƯỚC KHI LÀM BẤT CỨ VIỆC GÌ:
1. Đọc §13 của KE-HOACH-VPS.md — đó là nguồn sự thật về việc đang làm đến đâu.
2. Làm theo §13.1 (quy tắc làm việc qua nhiều session).
3. Xem §13.2 để biết phase hiện tại, rồi đọc ĐÚNG phase đó ở §7 và ĐÚNG module test
   tương ứng ở §8.4. Không đọc cả §7, không đọc cả §8.

KHÔNG đọc tràn Code.gs.moi (3645 dòng) và js.clean.html (3653 dòng) — chỉ Grep tên hàm cần
port. Đọc tràn hai file này là nguyên nhân cháy ngữ cảnh phổ biến nhất của dự án này.
Chỉ đọc thêm §2/§4/§5/§6 khi phase hiện tại thực sự cần.

CUỐI SESSION, bắt buộc trước khi tổng kết: cập nhật §13.2, thêm 1 dòng vào §13.3 (không sửa
dòng cũ), bổ sung §13.4 nếu có câu cần tôi trả lời, bổ sung §13.5 nếu phát hiện bẫy mới.
Nếu thiết kế đổi thì sửa luôn mục gốc (§4/§5/§6), không chỉ ghi ở §13. Cập nhật mục 1 của
docs/BAT-DAU-SESSION.md. Commit theo từng việc nhỏ, thông điệp có mã phase.

Trả lời tiếng Việt.

VIỆC CỦA SESSION NÀY: <PHASE>
```

---
---

## 3. Prompt cho session tiếp theo — Phase 9 (nghiệm thu, chạy song song, cắt chuyển), dán nguyên khối

```text
Dự án e:\quanlycongviec — chuyển hệ thống quản lý công việc nội bộ từ Google Apps Script + Sheets sang VPS (Node 24 + Express 5 + PostgreSQL 16 + Docker), tên miền ttdt.site. Session này làm PHASE 9: nghiệm thu, chạy song song, cắt chuyển (§7 Phase 9).

TRƯỚC KHI LÀM BẤT CỨ VIỆC GÌ:
1. Đọc §13 (nhật ký tiến độ) của KE-HOACH-VPS.md: §13.2 bảng trạng thái, §13.3 nhật ký, §13.4 câu hỏi treo, §13.5 bẫy (gồm khối bẫy HẠ TẦNG PHASE 8 ngày 2026-09-06), §13.8 số liệu thật. File này RẤT LỚN — chỉ đọc từng đoạn nhỏ quanh §13, KHÔNG đọc cả file.
2. Đọc §0.1 từ vựng và §13.1 luật làm việc (quy ước commit, KHÔNG git add ., không dán bí mật vào chat…).
3. Đọc §7 Phase 9 (mục 9.1–9.7 + «Xong khi») và §7.11 (Phase 9 làm trên nhánh `main`).
4. Đọc docs/UAT.md (bộ test theo vai cho mục 9.2) và deploy/runbook.md (cách vận hành trên VPS ở /opt/qlcv).
5. Đọc §4.3 (bảng đối chiếu hệ cũ → hệ mới) và §13.8 (28 dòng dữ liệu thật) — căn cứ nhập tay của mục 9.1.
6. Đọc docs/BAT-DAU-SESSION.md §1 để biết trạng thái hiện tại (nhánh, số test, việc còn treo).

KHÔNG đọc TRỌN hai file này: server/src/Code.gs.moi (~3645 dòng) và web/assets/js/app.js (~4300 dòng) — chỉ grep hoặc đọc từng đoạn khi cần.

TRẠNG THÁI (tính đến 2026-09-06):
- Phase 8 việc 1–7 ĐỀU XONG trên nhánh vps/phase-8-hatang: https://ttdt.site SỐNG (HTTPS + HSTS) · https://office.ttdt.site SỐNG (certbot cert riêng, OnlyOffice /healthcheck=true, api.js 200 qua HTTP/2) · Docker /opt/qlcv + 17 migration · sao lưu cron 02:00 + drill khôi phục THẬT ~2 giây + deploy/runbook.md · hardening (UFW/fail2ban/SSH chỉ khoá/.env 600) · Zalo: Bot Token MỚI hợp lệ, webhook https://ttdt.site/api/zalo-bot/webhook đã đăng ký (Zalo tự kiểm 200, sai chữ ký 403), lịch đẩy */2 phút. Suite 1670/1670, pin XSS 106/903.
- PHẦN «NGƯỜI THẬT» CỦA VIỆC 5 + 6 CHƯA CHẠY ĐƯỢC: e2e sửa .docx, liên kết Zalo (LIENKET), đẩy duyệt thật — vì CSDL production chưa có TÀI KHOẢN nào (đúng thiết kế: tài khoản tạo ở 9.1/9.1b), và UI không tự tạo được tài khoản ĐẦU TIÊN (muốn tạo tài khoản phải có admin đăng nhập trước). Nên việc ĐẦU TIÊN của Phase 9 là tạo admin đầu thẳng bằng psql — xem bước 0.
- BÀI HỌC PHẢI NHỚ trƯỚC KHI ĐỘNG VÀO LOG/SECRET: bí mật webhook từng lọt docker logs vì pino-http log nguyên header — đã vá redact + XOAY secret (2aeebd3, test logger-redact.test.js chốt). Đọc khối bẫy HẠ TẦNG PHASE 8 trong §13.5 trước khi làm.

VIỆC:

0. Chốt phần «NGƯỜI THẬT» của Phase 8 TRƯỚC khi vào 9.1 (mọi thứ hạ tầng đã xong, chỉ thiếu tài khoản):
   a. Tạo tài khoản ADMIN ĐẦU cho người dùng THẲNG BẰNG psql trên VPS: hash bcrypt sinh TRONG container app (node -e, KHÔNG dán mật khẩu vào chat), mã + họ tên + email thật do người dùng đọc tại chỗ, must_change_password=true, mật khẩu tạm giao TRỰC TIẾP. Đăng nhập bằng tài khoản đó để kiểm tra luồng «bắt đổi mật khẩu lần đầu» chạy thật.
   b. E2E OnlyOffice (phần còn lại của việc 5): dùng tài khoản vừa tạo — tạo một nhiệm vụ có kết quả, upload file .docx, mở lên SỬA và LƯU qua OnlyOffice từ đầu đến cuối; bản mới phải hiện trong khối «Kết quả».
   c. E2E Zalo (phần còn lại của việc 6): lấy mã liên kết 6 số từ giao diện → người dùng nhắn LIENKET <mã> cho bot → kiểm tra users.zalo_chat_id đã gắn → tạo một đề nghị cần duyệt và xác nhận người liên kết NHẬN TIN ĐẨY từ bot.
   d. Ba e2e trên xanh hết → Phase 8 đóng hẳn → gộp vps/phase-8-hatang vào main (§7.11: Phase 9 làm trên main).

9.1 Dựng dữ liệu bản cuối: NHẬP TAY 28 dòng thật của Sheets vào CSDL production QUA GIAO DIỆN WEB theo bảng đối chiếu §4.3, đối chiếu §13.8 và Sheets thật. Production KHÔNG chạy seed:dev/seed:v14. Nhập xong đối chiếu lại một lượt: số lượng, mã, người phụ trách, hạn.

9.1b Mật khẩu cho ~20 người thật: mật khẩu cũ ở Sheets là VĂN BẢN THUẦN — KHÔNG mang sang. Mỗi người một mật khẩu tạm riêng + must_change_password=true, giao TRỰC TIẾP từng người (không đăng vào chat nhóm).

9.2 UAT theo vai (docs/UAT.md): 5 vai (Giám đốc, Phó Giám đốc, Trưởng phòng, Phó phòng, Cán bộ), ~90 mã test. Đạt → tích + ghi chú; lỗi chặn → sửa trong 24h. Đủ xanh thì từng người KÝ NHẬN.

9.3 Chạy song song 1 tuần: VPS là CHÍNH cho việc thật; Sheets chuyển CHỈ ĐỌC (xem, không nhập liệu mới). Mỗi ngày đối chiếu dữ liệu mới giữa hai bên.

9.4 Đào tạo: buổi 60 phút + tài liệu 2 trang (đăng nhập, tạo/giao việc, báo cáo kết quả, xem thông báo, liên kết Zalo).

9.5 Theo dõi HẰNG NGÀY: log lỗi (docker logs qlcv-app), thời gian phản hồi, số phiên đăng nhập; lỗi chặn xử lý trong 24h.

9.6 Kế hoạch lùi (chuẩn bị sẵn, hy vọng không dùng): giữ Sheets + Apps Script thêm 30 ngày; vỡ nặng thì mở ghi Sheets trở lại, nhập tay phần đã tạo trên VPS trong thời gian song song.

9.7 Đóng sau 30 ngày (session riêng): xoá Apps Script, Sheets chuyển làm lưu trữ, ghi chú vào docs/HUONG-DAN-BAO-TRI.md.

KHÔNG LÀM:
- Không chạy seed:dev / seed:v14 vào CSDL production.
- Không mang mật khẩu VĂN BẢN THUẦN cũ ở Sheets sang hệ mới.
- Không dán bí mật (token, mật khẩu CSDL, khoá) vào chat, log, tài liệu hay commit. Không dùng lại token Zalo cũ đã lộ.
- Không git add . — commit nêu rõ đường dẫn từng file; prefix chủ đề (tai-lieu:/may-chu:/giao-dien:…), tiếng Việt KHÔNG dấu, trailer Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>.
- Không nới quyền §6, không đổi hình dạng phản hồi cầu RPC, không thêm thư viện mới khi chưa hỏi ở §13.4.
- Không phá chuông thông báo (việc A) đang chạy; không động vào tài khoản LE của certbot (không có email).

XONG KHI:
- UAT tích đủ theo vai, 0 lỗi chặn, có người KÝ NHẬN.
- Sao lưu tự động chạy ĐỦ 7 NGÀY LIÊN TIẾP (xem /var/backups/qlcv/backup.log trên VPS).
- deploy/runbook.md được NGƯỜI KHÁC (không phải người viết) làm thử thành công ít nhất một mục.
- §13.2/13.3/13.4/13.5 và mục 1 + mục 3 của docs/BAT-DAU-SESSION.md được cập nhật.

CUỐI SESSION: cập nhật §13.2 (trạng thái), §13.3 (thêm dòng MỚI — không sửa dòng cũ), §13.4 (câu hỏi mới nếu có), §13.5 (bẫy mới nếu có); cập nhật mục 1 và mục 3 của docs/BAT-DAU-SESSION.md — mục 3 lần sau là prompt cho session ĐÓNG (việc 9.7, sau 30 ngày chạy song song).

Trả lời tiếng Việt.
```

---

## 3b. Prompt cho session SỬA LỖI VẶT (Phase 8b) — dán nguyên khối

```text
Bạn tiếp tục dự án quản lý công việc bản VPS tại e:\quanlycongviec — trả lời bằng TIẾNG VIỆT.

PHASE MỚI: 8b — SỬA LỖI VẶT. Nguyên tắc: sửa trên PC, test xanh trên PC, rồi mới push lên VPS. Người dùng sẽ BỔ SUNG thêm lỗi vào danh sách — mỗi lần thêm, xử lý lỗi mới theo đúng quy trình dưới.

TRƯỚC KHI LÀM BẤT CỨ VIỆC GÌ, đọc theo thứ tự:
1. §13 KE-HOACH-VPS.md (quy tắc §13.1, bẫy §13.5) — file rất lớn, chỉ sed/cut từng đoạn, KHÔNG Read cả file.
2. §0.1 từ vựng trong KE-HOACH-VPS.md.
3. Mục 1 + mục 4 của docs/BAT-DAU-SESSION.md, và deploy/runbook.md.
KHÔNG đọc TRỌN: server/src/Code.gs.moi (~3645 dòng) và web/assets/js/app.js (~4300 dòng) — chỉ grep hoặc đọc đoạn.

NHÁNH LÀM VIỆC: git checkout -b vps/sua-loi-vat vps/phase-8-hatang — cắt từ HEAD 81d9fb9 (VPS đang chạy đúng bản này).

QUY TẮC CỨNG (kế thừa §13.1):
- Không thêm thư viện mới; không đổi hình dạng phản hồi cầu RPC; không mở tên RPC mới khi REST đủ; không nới quyền §6.
- Không phá chuông thông báo (việc A) và đẩy Zalo đang chạy; pin XSS 106/903 giữ nguyên.
- Không commit deploy/.env, server/storage/, data/*. KHÔNG git add . — nêu đường dẫn rõ ràng. Token Zalo và JWT secret KHÔNG xuất hiện trong code, log, tài liệu hay commit.
- Động web/assets/* → tăng cache buster tương ứng trong web/index.html và ghi số mới vào tài liệu.

QUY TRÌNH MỖI LỖI:
1. Sửa code.
2. Chạy npm test từ server/ — phải XANH toàn bộ (1670 test / 93 file).
3. Test tay trên PC theo mục 4 (bật docker compose, mở trình duyệt, kiểm tra đúng hiện tượng đã hết).
4. Commit riêng từng lỗi: tiền tố giao-dien:/may-chu:, thông điệp ASCII không dấu, explicit paths, cuối thông điệp có dòng Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>.

KHI HẾT LỖI:
- Push nhánh vps/sua-loi-vat lên origin.
- VPS: ssh root@157.10.199.148, cd /opt/qlcv, git fetch + git checkout vps/sua-loi-vat + git pull --ff-only. Có đổi server/ → rebuild theo deploy/runbook.md; chỉ đổi web/ → KHÔNG cần build (nginx phục vụ tĩnh), chỉ kiểm tra buster đã tăng.

CUỐI SESSION: thêm dòng MỚI vào §13.3 (không sửa dòng cũ), cập nhật dòng 8b ở bảng §13.2, cập nhật mục 1 và dòng «Phase kế tiếp» của docs/BAT-DAU-SESSION.md.

DANH SÁCH LỖI (người dùng bổ sung tiếp — xử lý lần lượt):

1. Menu «+ Tạo mới» KÉO DÀI khung đầu trang thay vì phủ lên nội dung bên dưới.
   - Hiện tượng: trang «Quản lý tài khoản», bấm «+ Tạo mới» thì khung trắng chứa tiêu đề TỰ CAO THÊM để đựng menu 5 mục. Yêu cầu: menu NỔI đè xuống phần dưới, khung giữ nguyên chiều cao.
   - Đã biết: menu là div absolute right-0 mt-2 w-48 glass-card shadow-xl z-20 đặt trong bọc .relative (web/index.html ~386–417); menu «Xuất Excel» (~361–384, w-64) cùng khuôn — sửa thì CẢ HAI phải đúng; menu ⋯ đã dời <body> nên KHÔNG đụng.
   - Chưa kết luận được nguyên nhân khi đọc tĩnh: tailwind.min.css có đủ .absolute/.relative; app.css tải SAU tailwind nhưng không khai utility vị trí riêng; .glass-card có backdrop-filter, không có position. Vào session hãy mở DevTools (Inspect menu + khung đầu trang khi menu đang mở) tìm nguyên nhân thật rồi sửa tối thiểu. Hướng nghi: app.css đè thuộc tính sau tailwind; hoặc tổ tiên của menu có transform/backdrop-filter biến nó thành containing block khiến absolute sai gốc; hoặc menu thực tế rơi vào dòng chảy vì thiếu position.
2. …(chờ người dùng bổ sung)

Trả lời tiếng Việt.
```

---

## 4. Lệnh chạy môi trường dev — chạy đúng thứ tự này

Lần đầu trên một máy mới:

```bash
cp deploy/.env.example deploy/.env     # rồi SỬA mật khẩu và SESSION_SECRET trong deploy/.env
cd server && npm install               # tools/ có node_modules riêng: cd tools && npm install
```

Mỗi lần bắt đầu làm việc:

```bash
# 1. Bật CSDL (db 5432, db-test 5434, adminer http://127.0.0.1:8080)
docker compose -f deploy/docker-compose.dev.yml up -d
docker compose -f deploy/docker-compose.dev.yml ps      # cả 3 phải "healthy"/"running"

# 2. Tạo/cập nhật bảng
cd server && npm run migrate:up

# 3. Kiểm mọi thứ còn xanh TRƯỚC KHI sửa gì — LUÔN chạy từ trong server/, không từ gốc repo
cd server && npm test    # phải 835/835 xanh trong 44 file (hết Phase 0–5)
npm run lint && npm run format:check

# 4. Chạy máy chủ khi cần thử tay
npm run dev       # http://127.0.0.1:3000/healthz

# 5. Nạp dữ liệu mẫu §8.3 — CHỈ vào CSDL dev, chạy lại nhiều lần không nhân đôi
npm run seed:dev  # 13 tài khoản TEST001..TEST013, mật khẩu Test@12345, đều bị bắt đổi lần đầu
```

Lệnh hay cần:

```bash
npm run migrate:down          # lùi 1 migration
npm run migrate:redo          # lùi rồi chạy lại migration cuối
npm run test:watch            # chạy test liên tục khi đang viết
npm run coverage              # ngưỡng 70%
MSYS_NO_PATHCONV=1 docker run --rm -v "$PWD/deploy/nginx/app.conf:/etc/nginx/conf.d/app.conf:ro" \
  -v "$PWD/deploy/nginx/security-headers.conf:/etc/nginx/snippets/security-headers.conf:ro" \
  nginx:1.27-alpine nginx -t                               # kiểm cú pháp Nginx (§7 việc 4.8)
docker compose -f deploy/docker-compose.dev.yml down       # tắt, GIỮ dữ liệu dev
docker compose -f deploy/docker-compose.dev.yml down -v    # tắt và XOÁ SẠCH dữ liệu dev
```

Dựng Nginx thật để chạy lượt khói §8.5 (đã dùng ở Phase 4, cổng 8099):

```bash
# 0. Máy chủ Node chạy trên máy thật (cổng 3000), CSDL riêng để không chạm dữ liệu dev:
docker exec -i qlcv-dev-db psql -U qlcv -d postgres -c 'CREATE DATABASE quanlycongviec_uat'
cd server && DATABASE_URL=postgres://qlcv:<mk>@127.0.0.1:5432/quanlycongviec_uat npm run migrate:up
cd server && DATABASE_URL=postgres://qlcv:<mk>@127.0.0.1:5432/quanlycongviec_uat npm run seed:dev
cd server && DATABASE_URL=postgres://qlcv:<mk>@127.0.0.1:5432/quanlycongviec_uat npm run dev

# 1. Mạng riêng + CẦU tới máy thật. Nginx dùng resolver Docker nên nó BỎ QUA /etc/hosts:
#    --add-host app:host-gateway KHÔNG có tác dụng, phải có một container TÊN là app.
docker network create qlcv-uat
docker run -d --name app --network qlcv-uat alpine/socat \
  tcp-listen:3000,fork,reuseaddr tcp-connect:host.docker.internal:3000

# 2. Nginx phục vụ web/ và chuyển /api sang container app.
#    MSYS_NO_PATHCONV=1 là BẮT BUỘC trên Git Bash: không có nó, Git Bash đổi "/etc/nginx/..."
#    thành "C:/Program Files/Git/etc/nginx/..." nên app.conf KHÔNG được nạp — nginx chạy bằng
#    default.conf của image, / trả 200 nhưng /api/* và /assets/vendor/* đều 404.
#    Đích của web/ phải là /srv/web — đúng dòng `root` trong deploy/nginx/app.conf.
MSYS_NO_PATHCONV=1 docker run -d --name qlcv-uat-nginx --network qlcv-uat -p 127.0.0.1:8099:80 \
  -v "$PWD/deploy/nginx/app.conf:/etc/nginx/conf.d/app.conf:ro" \
  -v "$PWD/deploy/nginx/security-headers.conf:/etc/nginx/snippets/security-headers.conf:ro" \
  -v "$PWD/web:/srv/web:ro" nginx:1.27-alpine

# 2b. Kiểm nhanh là app.conf ĐÃ được nạp (thiếu bước này thì bước 3 báo lỗi rất khó hiểu)
MSYS_NO_PATHCONV=1 docker exec qlcv-uat-nginx ls /etc/nginx/conf.d/   # phải thấy app.conf
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8099/api/csrf   # phải 200, không phải 404

# 3. Chạy lượt khói (in mã HTTP từng điểm, tự dọn dòng nó tạo)
bash tools/smoke-8.5.sh            # hoặc BASE=http://127.0.0.1:3000 bash tools/smoke-8.5.sh

# 4. Dọn
docker rm -f qlcv-uat-nginx app && docker network rm qlcv-uat
```

`down -v` xoá volume `db-data` — mất toàn bộ dữ liệu dev. Chỉ dùng khi thật sự muốn làm lại từ đầu.

---

## 5. Lưu ý bắt buộc — đọc trước khi viết dòng code đầu tiên

**Về ngữ cảnh AI** (tiết kiệm được cả session):

- Không đọc tràn `Code.gs.moi` và `js.clean.html`. Chỉ `Grep` đúng tên hàm cần port.
- Làm **một phase một lần**. Đang dở phase thì không nhảy sang phase khác.
- Viết file dài theo khối ≤ 50 dòng. Chạy test ngay sau mỗi hàm, không dồn đến cuối.
- Việc quét rộng (tìm mọi chỗ gọi một hàm) thì giao subagent, chỉ nhận kết luận.

**Về bảo mật — không được commit:**

- `deploy/.env` (mật khẩu thật) và `data/*` (snapshot chứa tên, email, **mật khẩu văn bản
  thuần** của người dùng thật). `.gitignore` đã chặn; đừng dùng `git add .`, hãy `git add`
  từng file. Kiểm nhanh: `git check-ignore -v deploy/.env data/snapshot-x.json`.
- Test **không** được đọc snapshot thật — dùng dữ liệu mẫu `dev.sql` hoặc fixture riêng ở
  `server/tests/fixtures/`. Không log mật khẩu, kể cả mật khẩu mẫu.
- Nhánh `main` không commit trực tiếp. Mỗi phase một nhánh `vps/phase-N-<tên>`.
- Trong repo còn `Code.gs.moi`, `HUONG-DAN-BAO-TRI.md`, `KE-HOACH-PHAT-TRIEN.md`,
  `tools/test-tasks-gd2.js`, `file tai xuong tu google sheet.xlsx` đang sửa dở / chưa theo dõi
  từ trước — **đừng stage kèm**. Riêng `web/` **đã là thư mục thật của frontend** từ Phase 4
  (`index.html`, `assets/js/{app.js,api-bridge.js}`, `assets/css/app.css`, `assets/vendor/**`);
  vẫn `git add` từng file — đừng `git add web/` khi trong đó có bản tải về của
  thư viện ngoài chưa kiểm.

**Bẫy riêng của máy này** (đã mất thời gian một lần, xem §13.5 của kế hoạch):

| Hiện tượng | Nguyên nhân thật | Cách làm đúng |
|---|---|---|
| `spawnSync npx.cmd EINVAL` | Node ≥20 trên Windows chặn spawn file `.cmd` | gọi `process.execPath` + `node_modules/<pkg>/bin/*.js` |
| Gói cài "thành công" nhưng thiếu file `.node` | npm ở máy này chặn install script (`allowScripts`) | dùng gói có sẵn bản biên dịch, ví dụ `@node-rs/bcrypt` thay `bcrypt` |
| `docker compose up` báo "port is already allocated" | cổng 5433 đã bị Postgres của dự án khác chiếm | CSDL test dùng **5434**, khai qua biến trong `deploy/.env` |
| Cả bộ test chết bằng `process.exit(1)` không nói lý do | `env.js` từ chối một biến mà `vitest.config.js` truyền vào | đọc stderr của worker; giữ enum trong `env.js` khớp với `vitest.config.js` |
| Test xoá mất dữ liệu dev | tưởng `process.loadEnvFile()` ghi đè `process.env` — **không** ghi đè | đã có 2 lớp chặn: `vitest.config.js` dừng nếu `DATABASE_URL === TEST_DATABASE_URL`; `global-setup.js` chỉ xoá CSDL có hậu tố `_test` |
| ~~`dump-sheets.js` báo "thiếu sheet Dự án/Nhiệm vụ"~~ (công cụ đã bỏ 2026-08-25) | `.xlsx` cấm dấu `/` trong tên sheet ⇒ bản tải về bị đổi thành `Dự ánNhiệm vụ` | vẫn đúng khi **mở tay** file `.xlsx`: đừng tìm sheet có dấu `/` |
| Tạo công việc đầu tiên bằng API đổ vì trùng `UNIQUE` trên `code` | dữ liệu mẫu chèn bằng mã **viết cứng** nên 6 sequence vẫn ở 1 | `dev.sql` kết thúc bằng 6 câu `setval(seq, GREATEST(last_value, n))`; thêm dòng mới vào seed thì **nhớ nâng số** |
| `seed:dev` chạy lần 2 làm số liệu phồng lên | 4 bảng không có cột `code` (`reminders`, `chat_messages`, `notifications`, `activity_logs`) nên `ON CONFLICT` không dùng được | dùng `INSERT … SELECT … WHERE NOT EXISTS` với khoá tự chọn — xem cuối `dev.sql` |
| Test một chốt an toàn làm **cả vitest thoát** giữa lúc chạy | chốt kết thúc bằng `process.exit(1)`, gọi trong tiến trình test là giết luôn runner | chạy bằng `spawnSync(process.execPath, [run.js])` như `tests/integration/seed-guard.test.js` |
| Seed hoặc test đỏ ở chỗ trông như lỗi SQL sau khi sửa `001_init.sql` | CSDL dev vẫn giữ lược đồ cũ | `npm run migrate:redo` mỗi khi đụng vào migration |
| Test so mốc thời gian đỏ ngẫu nhiên (`15.000016…` > 15) | mốc lấy từ `now()` của Postgres, so bằng `Date.now()` của máy — hai đồng hồ lệch vài chục ms | so bằng khoảng (`> 13 && < 16`), đừng so `<=` đúng biên |
| Test ghi nhật ký đọc `activity_logs` ra 0 dòng | `audit.js` ghi ở sự kiện `finish` của response, tức SAU khi supertest đã nhận xong | chờ bằng vòng lặp `waitForLogs()` như `tests/integration/auth-password.test.js` |
| Đăng nhập đúng nhưng mọi API sau đó trả 403 `MUST_CHANGE_PASSWORD`, kể cả API đổi mật khẩu | `requirePasswordChanged` mắc TRƯỚC router `/v1/auth` ⇒ khoá luôn đường thoát | giữ đúng thứ tự khai trong `app.js`: `api.use('/v1/auth', authRouter)` rồi mới `api.use(requirePasswordChanged)` |
| Mật khẩu dài hơn 72 byte vẫn "đúng" khi gõ thiếu ký tự cuối | bcrypt cắt cụt sau 72 **byte** (tiếng Việt có dấu ≈ 3 byte/ký tự) | `password.js` từ chối thẳng nếu `Buffer.byteLength(pw) > 72` |
| Frontend không gửi được token CSRF | cookie CSRF bị đặt `httpOnly` ⇒ JavaScript không đọc nổi | cookie `csrf` **không** httpOnly (chỉ cookie `sid` mới httpOnly) |
| Test đỏ hàng loạt 401, log in ra `RUN v4.1.11 E:/quanlycongviec` | gọi `npx vitest` từ **gốc repo** ⇒ chạy vitest@4 của thư mục gốc, không có `globalSetup` nên CSDL test chưa dựng | luôn `cd server` trước mọi lệnh `npm`/`npx`; kiểm dòng `RUN v2.1.8 E:/quanlycongviec/server` ở đầu output |
| `api.delete is not a function` | helper HTTP ở `tests/helpers/http.js` đặt tên là **`del`** (`delete` là từ khoá) | dùng `api.del(url)` |
| `ECONNRESET` khi test đồng thời (TC-TREE-31) | 20 request cùng lúc, mỗi request tự đi lấy token CSRF ⇒ 40 kết nối, supertest dựng server mới mỗi lần | lấy token **một lần** rồi dùng lại cho cả 20 request |
| Tiếng Việt gửi bằng `curl -d '…'` hoặc `psql -c '…'` vào CSDL thành `U+FFFD` (`KH?I 8.5`) | Git Bash chuyển **argv** sang codepage console trước khi trao cho `.exe`; hệ thống lưu luôn bản đã hỏng | đưa mọi thân JSON và mọi câu SQL qua **stdin**: `printf '%s' "$body" \| curl … --data-binary @-`, `printf '%s' "$sql" \| docker exec -i qlcv-dev-db psql …` |
| Nginx trong Docker trả 502 dù `--add-host app:host-gateway` | `resolver 127.0.0.11` phân giải qua DNS Docker, **bỏ qua `/etc/hosts`** | chạy một container **tên `app`** làm cầu: `alpine/socat tcp-listen:3000,fork,reuseaddr tcp-connect:host.docker.internal:3000` (xem mục 4) |
| `npm run seed:dev` đỏ với «Cha phải là công việc con (cấp 2)» | CSDL đã có dòng tay cùng `code` nhưng khác `level`; `ON CONFLICT (code) DO UPDATE` **không** sửa được `level` | xoá dòng tay, hoặc seed sang CSDL khác bằng `DATABASE_URL=…` trên dòng lệnh (biến dòng lệnh thắng `loadEnvFile()`) |
| `array_length(...) does not exist` khi kiểm link kết quả bằng SQL | `work_items.result_links` là **jsonb**, không phải mảng text | `jsonb_array_length(result_links)` |
| `column "revoked_at" does not exist` khi thử phiên hết hạn | bảng `sessions` không có cột đó | đẩy `expires_at` về quá khứ: `UPDATE sessions SET expires_at = now() - interval '1 hour'` |
| `npm run …` báo `Could not read package.json` | đứng ở **gốc repo**, `package.json` nằm trong `server/` | `cd server` trước mọi lệnh npm (kể cả `lint`, `format:check`) |
| Khói T1–T10 500 `INTERNAL` dù code bootstrap đã có | CSDL `quanlycongviec_uat` đứng ở migration cũ (thiếu `v_countable_*`) — `npm run migrate:up` mặc định vào **dev** | `DATABASE_URL=postgres://qlcv:<mk>@127.0.0.1:5432/quanlycongviec_uat npm run migrate:up` mỗi khi thêm migration |
| XSS-guard đỏ vì helper tên `add*Html` dù đã escape | `BUILDER` chỉ nhận `create`/`build`/`render`/`wrap`/`describe`/`linkify`/`get*Html` | đặt tên `create*Html`; đừng nhét vào danh sách trắng cho hết đỏ |
| Test jsdom mới `no-undef window` | `eslint.config.js` khai globals bằng danh sách trắng từng file | thêm file vào khối jsdom (như `pending-badge` / `subwork-button-ui`) |

**Quy ước code đã chốt** (giữ nguyên, đừng đổi giữa đường):

- ESM (`import`), Node ≥ 24. `server/` là ESM, `tools/` là CommonJS với `node_modules` riêng.
- SQL viết tay, **tham số hoá 100%**, không nối chuỗi. Không ORM.
- Ngày kiểu `date` trả về **chuỗi `YYYY-MM-DD`** (đã đặt type parser ở `pool.js`) — đừng
  `new Date()` rồi format lại, đó là đường dẫn tới lỗi lệch một ngày.
- Log đi qua `src/utils/logger.js`, không `console.log` (ESLint cảnh báo).
- Lỗi trả về **đúng §5.3**: thành công `{ ok: true, data }` · thất bại
  `{ ok: false, error: { code, message, field?, traceId? } }`. Không lộ stack. Đừng dùng
  `{ success: false }` — dạng đó đã bị xoá khỏi `app.js` ở Phase 1.
- Ném lỗi bằng `new AppError(code, message, …)` trong `src/utils/errors.js`; mã HTTP do bảng
  `ERROR_STATUS` quyết định, đừng `res.status()` rải rác.
- `eslint.config.js` khai `globals` bằng **danh sách trắng viết tay** (process, console,
  setTimeout, URL, Buffer). Dùng global mới thì phải thêm vào đó, nếu không lint đỏ.
- Comment và thông báo lỗi cho người dùng viết **tiếng Việt**.
- **Từ vựng (§0.1)**: cấp 1 = **công việc** (`works`, mã `CV0xx`), cấp 2 = **công việc con**,
  cấp 3 = **nhiệm vụ** (cả hai ở `work_items`). Vai trò là `Quản lý công việc`. **Không** viết
  "dự án" trong code, comment hay giao diện — trừ khi đang nhắc **tên thật** của sheet/cột
  Google Sheets (`Dự án/Nhiệm vụ`, `Mã dự án`) hoặc mã cũ `DA0xx`.
- Mọi hàm ghi chạy trong `withTransaction()`.

---

## 6. Checklist cuối session — làm trước khi tổng kết

1. `npm test` xanh, `npm run lint` và `npm run format:check` sạch.
2. `KE-HOACH-VPS.md`: cập nhật §13.2 · thêm **1 dòng** vào §13.3 (không sửa dòng cũ) ·
   §13.4 nếu có câu cần người dùng trả lời · §13.5 nếu có bẫy mới.
3. Thiết kế đổi thì sửa **mục gốc** (§2/§3/§4/§5/§6/§7), không chỉ ghi ở §13.
4. Cập nhật **mục 1** của file này (đang ở đâu) và mục 3 (prompt cho phase kế tiếp).
5. Chạy lại bộ khói nếu phase vừa làm mở thêm điểm §8.5:
   `"C:\Program Files\Git\bin\bash.exe" tools/smoke-8.5.sh` **từ gốc repo** (`bash` trần là WSL),
   rồi cập nhật phần "Checklist khói §8.5" trong `docs/UAT.md` (nêu tên điểm đỏ, đừng chỉ đổi
   con số) và bảng "Ghi chú nghiệm thu" ở cuối file.
6. Commit từng việc nhỏ, thông điệp có mã phase. Không `git add .`.



