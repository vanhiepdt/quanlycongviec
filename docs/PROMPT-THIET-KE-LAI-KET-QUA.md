Dự án e:\quanlycongviec — hệ quản lý công việc (Node 24 + Express 5 + PostgreSQL 16, dev DB chạy
Docker Desktop). Nhánh `vps/ket-qua-file`, HEAD `fd0d4f0` (đã push, = origin).
Session này CHỈ LÀM GIAO DIỆN: **THIẾT KẾ LẠI 2 CHỖ THEO ĐÚNG 2 ẢNH GỬI KÈM TIN NHẮN NÀY** —
(A) khối «Kết quả» trong modal nhiệm vụ (tab Thông tin); (B) trang «Hàng chờ phê duyệt» → tab con
«Phê duyệt kết quả». KHÔNG đổi nghiệp vụ, KHÔNG đổi luồng duyệt, KHÔNG đổi CSDL.
TÁCH NHÁNH MỚI `vps/ket-qua-thiet-ke-lai` từ HEAD rồi làm; commit nhỏ theo việc, push cuối,
báo URL PR.

## §0 — NGUỒN THIẾT KẾ LÀ 2 ẢNH KÈM THEO (LÀM TRƯỚC KHI VIẾT MÃ)

Bố cục / số cột / thứ tự cột / nhãn / màu / chỗ đặt nút LẤY TỪ ẢNH, không lấy từ suy đoán.

1. MÔ TẢ LẠI cho tôi những gì bạn THẤY ở từng ảnh: là bảng hay danh sách; **liệt kê tên từng cột
   theo đúng thứ tự trái→phải**; mỗi hàng đại diện cái gì (nhiệm vụ / file / bản); có hàng nhóm
   theo cây không và thụt lề thế nào; nút-icon nào nằm ở cột nào; đâu là badge trạng thái; «Xem ý
   kiến» và lịch sử bản hiện ra sao; phần tải file lên nằm ở đâu.
2. NÊU RÕ những gì ảnh KHÔNG nói (bảng rỗng hiện gì; có phân trang không; khối thu gọn mặc định mở
   hay đóng; nhãn chính xác từng nút; cột nào được cắt chữ khi hẹp) → **HỎI LẠI tôi** bằng
   ask_question, kèm phương án + khuyến nghị của bạn. KHÔNG tự đoán rồi làm.
3. CHỜ tôi xác nhận mô tả ở bước 1 rồi mới sửa mã.

⚠ NẾU KHÔNG THẤY / KHÔNG MỞ ĐƯỢC ẢNH: DỪNG NGAY, nói thẳng «không đọc được ảnh», hỏi tôi mô tả
bằng lời. TUYỆT ĐỐI KHÔNG bịa bố cục rồi làm.

## §0.1 — CHƯA HIỂU THÌ HỎI LẠI

Mâu thuẫn giữa ảnh và luồng đang chạy (§3) ⇒ DỪNG + HỎI, nêu phương án + khuyến nghị. Những gì
prompt này đã chốt coi như tôi đã duyệt, đừng hỏi lại. Ảnh đòi dữ liệu mà REST hiện tại KHÔNG trả
⇒ DỪNG + HỎI trước, KHÔNG tự thêm cột / migration / trường mới.

## §1 — BASELINE BẮT BUỘC xác nhận TRƯỚC khi sửa (chạy và báo số THẬT)

1. `cd server && npm test` → **1549 test · 87 file** xanh; `npm run lint` + `npm run format:check`
   sạch. (Test integration cần Docker Desktop chạy + container `qlcv-dev-db`.)
2. `node --check web/assets/js/app.js` và `node --check web/assets/js/project-details.js` OK.
3. Banner `[QLCV] app.js 20260903-1` (app.js L9). Buster trong `web/index.html`:
   `app.css?v=20260903-1` (L21) · `app.js?v=20260903-1` (L1238) ·
   `project-details.js?v=20260902-1` (L1240).
4. Pin XSS TC-SEC-17 trong `server/tests/unit/xss-guard.test.js` = **101 chỗ / 830 giá trị**
   (đếm bằng `node tools/dem-xss.mjs`).
5. Migration cuối = `015_file_sua_truc_tuyen.sql` ⇒ kế tiếp là 016. **Session này KHÔNG cần 016.**
6. Dữ liệu để xem bằng mắt: `chay-test.bat /v14 /f` (dựng CSDL `quanlycongviec_uat` + bộ seed
   Vòng 14). Tài khoản `gd@ / pgd@ / tp@ / pp@ / nv1@ / nv2@ / nvb@test.local`, mật khẩu
   `Test@12345`. Năm nhiệm vụ NV-01..NV-05 phủ 5 trạng thái file; **chỉ NV-01 có file thật trên
   đĩa**, NV-02..05 chỉ có dòng CSDL nên tải về / mở editor sẽ báo lỗi mất file — ĐÚNG thiết kế.

## §2 — ĐỌC TRƯỚC (grep rồi đọc ĐÚNG ĐOẠN; app.js ~7100 dòng, CẤM đọc tràn cả file)

Tài liệu: `docs/KE-HOACH-KET-QUA-FILE.md` (sơ đồ trạng thái + bảng ánh xạ phân quyền → cửa luồng) ·
`KE-HOACH-VPS.md` §0.1 từ vựng (**cấp 1 công việc · cấp 2 công việc con · cấp 3 nhiệm vụ**), §13.3
nhật ký, §13.4 câu hỏi đang chờ, **§13.5 bảng bẫy — đọc HẾT, nhiều bẫy vừa gãy đúng ở 2 vùng này** ·
`docs/HUONG-DAN-TEST-GIAO-DIEN.md` mục 1.0 (dựng môi trường bằng `chay-test.bat`) + mục 9b và 9b.7 ·
`docs/BAT-DAU-SESSION.md` mục 1 + mục 3.3 (thư viện đang dùng).

**(A) Khối «Kết quả»** — tất cả trong `web/assets/js/app.js`: `batTatKetQua` L2287 ·
`buildYKienPanel` L2292 · `restUpload` L2318 · **`napKetQua` L2347 (hàm dựng HTML chính)** ·
`moChonFileKetQua` L2397 · `veTrangThaiUpload` L2409 · `uploadKetQua` L2437 · `xuLyVerdictFile`
L2476 · `guiYKien` L2501 · `xoaKetQuaFile` L2528 · `taiFileKetQua` L2535 · `xemFileKetQua` L2538 ·
`nutVerdictFile` L2551 · `buildNutVerdictFile` L2560.

**(B) Trang hàng chờ** — `web/assets/js/app.js`: `renderChoDuyetPanel` L6471 · `moTabChoDuyet`
L6606 · `napTrangChoDuyet` L6619 · **`renderChoDuyetKetQua` L6638 · `buildBangChoDuyetKetQua` L6659
· `buildHangCayChoDuyet` L6688 · `buildDongChoDuyetKetQua` L6706** · `moChonFileChoDuyet` L6766 ·
`xuLyVerdictChoDuyet` L6776 · `capNhatNavChoDuyet` L6799 · `goiNutChoDuyetPanel` L6880.
`web/index.html`: `nav-cho-duyet` L190 · `nav-cho-duyet-badge` L196 · `cho-duyet-section` L751 ·
`cho-duyet-refresh` L754 · `tab-ket-qua-count` L768 · `panel-cho-duyet-viec` L773 ·
`cho-duyet-viec-trong` L800 · `panel-cho-duyet-ket-qua` L805 · `cho-duyet-ket-qua-list` L811 ·
`kq-cho-duyet-file-input` L817 · `kq-cho-duyet-trang-thai` L820.

**Máy chủ — đọc để biết dữ liệu CÓ SẴN, KHÔNG sửa nếu ảnh không đòi thêm trường:**
`server/src/modules/taskFiles/service.js` — `nop` L191 · `verdict` L429 · `gomY` L571 · `xoaNhom`
L623 · `choDuyetKetQua` L656 · `demChoDuyetKetQua` L696 · `doc` L708 · `quyenFile` L734 ·
`onlyOfficeBat` L788 · `moEditor` L825 · `luuNgay` L885 · `luuTuCallback` L1153.
`server/src/modules/taskFiles/routes.js` — `POST /work-items/:ref/files` (multer
`upload.single('file')` L75) · `GET /work-items/:ref/files` L120 · `GET
/task-file-versions/:id/editor` L137 · **`GET /task-files/cho-duyet` L174** · `POST
/task-file-versions/:id/save` L183 · `GET /task-files/:id/download` L199 (`?inline=1` cho PDF) ·
`POST /task-files/:id/verdict` L229 · `POST /task-file-versions/:id/comments` L248 · `DELETE
/task-files/:id` L269. Mount: `server/src/app.js` L118 (`v1.use(taskFilesRouter)`) và L75
(`/v1/task-files-ds` — đường ONLYOFFICE gọi vào, ĐỨNG TRƯỚC verifyCsrf, ĐỪNG ĐỤNG).
Cầu REST: `web/assets/js/api-bridge.js` — `restGet` / `restPost` / **`restUpload`**, header
`X-CSRF-Token`, `GET /api/csrf`. Upload là FormData ⇒ **dùng lại `restUpload()`, đừng viết mới**.

## §3 — NGHIỆP VỤ PHẢI GIỮ NGUYÊN (ảnh chỉ đổi CÁCH HIỂN THỊ)

- 5 trạng thái nhóm file: `cho-xem` → `can-sua` ⇄ → `cho-lanh-dao` → `da-duyet`, cộng nhánh
  `hoan-thanh`. `da-duyet` = KHOÁ (nộp tiếp trả 409). Màu badge đang dùng: cho-xem vàng ·
  can-sua đỏ nhạt · cho-lanh-dao tím · hoan-thanh xanh · da-duyet xanh đậm.
- Một nhóm file có NHIỀU BẢN (v1, v2…). Sửa trực tuyến ONLYOFFICE lưu thành **BẢN MỚI**, không ghi
  đè. Hành động luồng hợp lệ: `nop` · `gom-y` · `yeu-cau-sua` · `trinh-lanh-dao` · `tra-ve-tp` ·
  `tra-ve-cbo` · `duyet-tu-dong` · `duyet` · `hoan-thanh` · `sua-truc-tuyen`.
- Nút verdict hiện theo VAI + **GIÁ TRỊ HIỆU LỰC** của Bảng phân quyền động (2 hàng `file:create`
  và `file:approve`): `✓ Cho phép` = chốt luôn · `⏳ Chờ duyệt` = phải gửi đi duyệt · `✕ Tắt` = không
  làm được. Admin đổi ghi đè là hành vi đổi NGAY cho request kế tiếp. **Client chỉ ẨN/HIỆN nút cho
  đẹp; máy chủ là rào chặn cuối** — đừng chuyển bất kỳ phép kiểm nào từ máy chủ sang client.
- Hàng chờ bó theo `leader_ids` của CHÍNH nhiệm vụ (ai không được nêu ở «Lãnh đạo phòng phụ trách»
  thì không thấy dòng và gọi API cũng bị chặn). Máy chủ đã `ORDER BY` theo mã ba cấp và `LIMIT 200`
  ⇒ **client KHÔNG được `sort` lại**, chỉ chèn hàng tiêu đề khi đổi nhóm.
- `yeu-cau-sua` / `tra-ve-tp` / `trinh-lanh-dao` bắt buộc nội dung ≥ 10 ký tự; `duyet` /
  `hoan-thanh` được để trống. Ô «Ý kiến» nhập đủ 10 ký tự thì nút dùng luôn, không hỏi lại.
- Upload: whitelist `.doc/.docx/.pdf` + kiểm mimeType, `limits.fileSize` **20MB**. Tên file gốc có
  dấu tiếng Việt phải giữ đúng (`tenGocUtf8`) và **luôn escape khi in ra HTML**.

## §4 — VIỆC PHẢI LÀM

**VIỆC 1 — (A) khối «Kết quả» theo ẢNH 1.** Sửa `napKetQua` + các hàm dựng con ở §2(A). Giữ nguyên
mọi đường REST và mọi hàm xử lý (`uploadKetQua`, `xuLyVerdictFile`, `guiYKien`, `xoaKetQuaFile`,
`taiFileKetQua`, `xemFileKetQua`). Nút ✎ sửa trực tuyến chỉ hiện khi máy chủ trả `onlyOffice: true`.
Thanh trạng thái tải lên (`veTrangThaiUpload`) phải còn.

**VIỆC 2 — (B) tab «Phê duyệt kết quả» theo ẢNH 2.** Sửa `buildBangChoDuyetKetQua` /
`buildHangCayChoDuyet` / `buildDongChoDuyetKetQua`. Giữ: nút do máy chủ trả về (`quyenFile`), nút ⬆
nộp bản mới dùng chung `restUpload`, badge số ở `nav-cho-duyet-badge` + `tab-ket-qua-count`, và
`capNhatNavChoDuyet` phải chạy cho MỌI vai duyệt (admin/GĐ + Phó GĐ + TP/PP) — bẫy đã gãy một lần.

**VIỆC 3 — CSS.** Sửa `web/assets/css/app.css` (khối cuối file là của Vòng 14). Bảng phải đọc được
ở màn hình hẹp: cột dài `truncate` + `title`, đừng để tràn ngang cả trang.

**VIỆC 4 — TEST (chạy NGAY sau mỗi việc, đừng dồn cuối).**
- Cập nhật `server/tests/unit/task-files-ui.test.js` (470 dòng, mã ca TCKQ-*) cho bố cục mới: đủ
  cột theo ảnh, badge đúng màu, nút ẩn/hiện theo vai + giá trị hiệu lực, **escape tên file
  `<b>xấu</b>`**, chặn sai đuôi file ở client.
- Giữ xanh: `nav-cho-duyet.test.js` (105 dòng) · `dom-contract.test.js` (77 — **mọi id có listener
  phải tồn tại trong `web/index.html`**) · `xss-guard.test.js` (356) ·
  `project-details-phan-cong.test.js` (303) · `pho-giam-doc-ui.test.js` (303) ·
  `task-files-api.test.js` (749 — integration, KHÔNG sửa vì máy chủ không đổi).
- Sửa mã client xong: `node tools/dem-xss.mjs` → cập nhật pin TC-SEC-17 + ghi 1 mục vào
  `docs/XSS-4.6.md` TRONG CÙNG COMMIT.

## §5 — QUY ƯỚC BẮT BUỘC (vi phạm là test đỏ — đã gãy nhiều lần)

- Đổi `app.js` ⇒ bump banner `[QLCV] app.js 20260903-2` (hoặc `-3`…) **và** `app.js?v=` trong
  `index.html` cùng số. `app.css` / `project-details.js` bump riêng.
- `node --check web/assets/js/app.js` **NGAY sau mỗi lần vá** (editor hay cắt cụt `new_text`; khối
  dài phải tách nhỏ).
- Vá `app.js` bằng script node fs utf8 (`tools/_tam*.mjs`, đếm ĐÚNG số lần thay, xong **XOÁ**).
  **CẤM PowerShell `Set-Content`** (hỏng UTF-8 im lặng). `old_text` chứa `\\` thì chuyển sang script
  (bẫy §13.5).
- Nhãn tiếng Việt; KHÔNG kèm mã nhiệm vụ trong nhãn (quy ước Vòng 7). Mọi giá trị người dùng nhập
  in ra HTML phải escape.
- Commit nhỏ theo thứ tự việc: `giao-dien: khoi ket qua ...` → `giao-dien: bang phe duyet ket qua
  ...` → `giao-dien: css ...` → `test: ...` → `tai-lieu: ...`. **CẤM `git add .`**; KHÔNG add
  `server/storage/`. `git add` / `commit` **TUẦN TỰ** (chạy song song giành `index.lock` — đã gãy).

## §6 — KHÔNG LÀM

KHÔNG đổi `server/src/modules/taskFiles/*` (service/repo/routes/dsRoutes) trừ khi ảnh đòi trường mà
REST chưa trả — lúc đó DỪNG + HỎI trước. KHÔNG đổi `approvals/*`, `approval_status`, `workItems/
service.js`, RPC bridge, `assignments`. KHÔNG thêm migration. KHÔNG deploy / cấu hình lại
ONLYOFFICE. KHÔNG đổi bộ seed `dev-vong14.sql`. KHÔNG thêm thư viện mới.

## §7 — XONG KHI

**1549 + test mới** tất cả xanh (chạy full `npm test`) · `node --check` hai file JS · `npm run lint`
+ `format:check` sạch · pin XSS cập nhật đúng + 1 mục `docs/XSS-4.6.md` · banner + buster bump khớp
nhau · `KE-HOACH-VPS.md` §13.3 thêm 1 dòng (KHÔNG sửa dòng cũ) + §13.5 thêm bẫy mới gặp ·
`docs/HUONG-DAN-TEST-GIAO-DIEN.md` mục 9b cập nhật theo bố cục mới · `docs/BAT-DAU-SESSION.md` mục 1
cập nhật số test + banner · `git push` · báo URL PR + liệt kê câu hỏi còn chờ tôi.

Cuối cùng in cho tôi **danh sách bước bấm tay** để tự kiểm bố cục mới: dựng bằng
`chay-test.bat /v14 /f`, Ctrl+F5 để lấy banner mới, rồi đường đi cụ thể cho `tp@test.local` (khối
«Kết quả» ở NV-01 — nhiệm vụ duy nhất có file thật) và cho `gd@test.local` (trang «Hàng chờ phê
duyệt» → tab «Phê duyệt kết quả»).
