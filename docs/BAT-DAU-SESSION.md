# Bắt đầu một session mới — dán prompt, chạy, không phải nhớ gì

## Ưu tiên hiện tại — ĐỢT B BỔ SUNG LƯỢT 2 12/09/2026: nhãn «duyệt cái gì» + nút «Xem các thay đổi» · bốn nút duyệt bé lại · mở hai ô phân công khi lập mới cấp 3 · ẩn «Gửi đi duyệt» khi nhiệm vụ không trình BLĐ

**ĐÃ PHÁT HÀNH VPS 12/09/2026 — NHƯNG CHƯA NGHIỆM THU GIAO DIỆN.** Người dùng ra lệnh «deloy lên vps đi,
đảm bảo vps chạy code mới nhất và ko lỗi, restart lại docker cho chắc»; lệnh đó **thay cho bước nghiệm thu**
của cả ĐỢT B, bản sửa Q6/Q11, đợt bổ sung 12/09 và lượt 2 này, nên bốn việc nay **đang chạy trên dữ liệu
thật** mà chưa ai bấm thử. Đọc
khối này trước; các khối «Snapshot trước đợt B bổ sung lượt 2 …», «Snapshot trước đợt B bổ sung — BẢN SỬA
Q6/Q11» và «Snapshot trước bản sửa Q6 — ĐỢT B» bên dưới vẫn còn hiệu lực ở mọi chỗ **không mâu thuẫn**
với khối này — **riêng mọi câu «CHƯA COMMIT/PUSH/DEPLOY» trong các khối cũ nay đã HẾT hiệu lực**.

**KHÔNG CÓ MIGRATION — CSDL GIỮ `029`, NGƯỜI ĐANG TEST CHỈ CẦN Ctrl+F5.** Không phải chạy lại
`chay-test.bat`. Buster + banner **`20260912-01` → `20260912-02`** (5 chỗ: `web/index.html` dòng
21/1230/1232/1233 + `app.js:9`). **Hình dạng phản hồi RPC/REST không đổi** — `listPending` chỉ THÊM hai
trường `da_sua` / `moc_xu_ly`.

**BỐN CHỈ ĐẠO NGHIỆP VỤ (nguyên văn):**

> «Sửa hiển thị phê duyệt Công việc / Nhiệm vụ , sẽ thêm cột thông tin về đây là duyệt công việc mới tạo,
> hay sửa chữa/xóa ... công việc cha, công việc con., nhiệm vụ, file kết quả Đối với sửa thông tin
> công việc/nhiệm vụ, thêm nút xem các thay đổi, hiển thị popup các thay đổi, sửa (vẫn giữ logic cũ, sửa
> file kết quả thì duyệt riêng, còn sửa tỷ lệ công việc file kết quả thì là cây duyệt kia)»

> «phần Xem chi tiết / Duyệt / Trả lại để sửa / Từ chối bé lại»

> «Sửa lại, nhân viên khi được phép tạo nhiệm vụ cấp 3, nhưng không chọn được Ban lãnh đạo kiểm soát,
> Người thực hiện trực tiếp hãy sửa lại»

> «Khi trưởng phòng/phó phòng duyệt file kết quả vẫn còn hiển thị gửi đi duyệt đối với file không phải gửi
> lên ban lãnh đạo duyệt, tức là ko tích ô Gửi BLĐ phê duyệt đấy»

**ĐÃ LÀM — TÓM TẮT (chi tiết ở `docs/KE-HOACH-DUYET-CAY.md` §13):**

- **MỚI-3 (máy chủ):** `approvals/repo.js` — `DA_XU_LY` (dòng **106**, đúng HAI hành động
  `approvals.approve` / `approvals.return`), `SUA_NOI_DUNG` (**107**, bảy action đổi nội dung),
  `listPending` (**154**) thêm `LEFT JOIN LATERAL … min(created_at) AS moc_xu_ly` (**211**) và trả về
  `moc.moc_xu_ly` (**195**) + `EXISTS (… created_at > moc_xu_ly) AS da_sua` (**205**). **Không migration**
  — chỉ đọc `activity_logs`. Lý do không phân biệt được từ `works`/`work_items`: `submitted_by` ghi ở MỌI
  lần gửi, **không có** `submitted_at`, còn `approver_id`/`approved_at` bị **xoá trắng** khi hạ về `Chờ
  duyệt` (Q9).
- **MỚI-3 (giao diện):** `app.js` — `NHAN_DUYET` (**8590**, ba khoá `moi`/`sua`/`xoa`, đóng băng),
  `nhanDuyetHtml` (**8596**), `buildPendingApprovalRowHtml` (**8504**, `data-da-sua` **8527**,
  `data-moc-xu-ly` **8529**, nút `approval-changes` **8551** chỉ hiện khi `da_sua === true`),
  `buildPendingDeleteRowHtml` (**8621**), `HANH_DONG_SUA_NOI_DUNG` (**8725**, phải trùng khớp
  `SUA_NOI_DUNG`), `moPopupThayDoiChoDuyet` (**8754**, overlay id `thay-doi-cho-duyet-dialog` **8802**,
  TÁI DỤNG `buildNhatKyDong`), nhánh nút trong `goiNutChoDuyetPanel` (**9411**),
  `buildChangeApprovalRowHtml` (**10787**, đọc CHUNG `NHAN_DUYET` ở 10799–10801). **Logic cũ giữ nguyên:**
  sửa file kết quả duyệt riêng; sửa **tỷ lệ** của file đi `approval_changes` (R4/R4'/R4'').
- **MỚI-4:** `app.css` **4309–4332** — `.approval-row button, .approval-delete-row button, .change-row
  button { padding: 3px 9px; font-size: 11px; min-height: 24px; border-radius: 8px; }` + icon `10px`.
  Thắng `.btn-primary` bằng **đặc hiệu (0,1,1) > (0,1,0)**, **không `!important`**. Phải phủ CẢ BA class vì
  ba builder khác nhau dựng ba bảng.
- **MỚI-3 (CSS nhãn + popup):** `app.css` **4334–4356** `.duyet-nhan {…}` + `.duyet-nhan + .duyet-nhan {
  margin-left: -4px; }`; **4358–4366** `#thay-doi-cho-duyet-dialog > section { width: min(760px, 100%); }`
  (trả lại bề ngang bị `.yk-dialog > section` bóp còn 620px).
- **MỚI-5:** `assignments/service.js` — hằng `VAI_DUOC_DOI_PHAN_CONG` (**46**),
  `assertAssignmentActor(user, input, current, ctx)` (**53**) với `moKhiLapMoiCapBa = taoMoi === true &&
  level === 3` mở khoá `supervisor_ids` + `assignee_id`; `leader_ids` **vẫn khoá mọi trường hợp**; hàng rào
  MỚI `assertAssigneeCungPhong` (**95**). Chỗ gọi: `workItems/service.js` **392–412** (`taoMoi: true` +
  gọi hàng rào cùng phòng). `assertSupervisorsByLevel` vẫn bó BLĐKS cấp 3 trong BLĐKS của công việc con.
- **MỚI-6:** `taskFiles/service.js` — `apTuDong` (**410**) thôi «chỉ nhìn vai»: **đọc lại `ghiDe`** qua
  `permissionsRepo.listByVai` (vì `nguoiNop` là dòng `users`, không phải `req.user`) rồi trả
  `phaiTrinhLanhDao(...) ? 'cho-lanh-dao' : 'cho-xem'`; `phaiTrinhLanhDao` (**864**) đúng BA lý do
  (`gui_bld_phe_duyet === true` · người bấm là `assignee` · `file:approve !== 'cho-phep'`); tách
  `laChuBanNhom` (**442**) khỏi `duocGuiBanLuu` (**433**) để 403 ≠ 409; `tpPpLaChanhCuoi` (**456**);
  `hoan-thanh` mở thêm ở `luu-tam` (**922**/**1035**), `quyenFile` theo kịp (**1280**/**1703**). **R6 vẫn
  giữ: không bao giờ trả `'da-duyet'`.** Q1 vẫn giữ: nhóm `luu-tam` **chưa có bản nào** thì không hiện nút
  chốt.

**KIỂM CHỨNG TRÊN PC (đã chạy, đã xanh):** full `npm test` **2076/2076 · 115 file · Duration 271.98s ·
exit 0** (mốc trước 2043/114) · `npm run lint` exit 0 · `npm run format:check` còn đúng **2 nợ cũ**
(`workItems/tyLe.js`, `stats-parity.test.js`) · pin XSS **`101 sink / 986 nội suy`** (từ `100/978`),
CAN-THOAT **21 → 23** · `node tools/local-assets-check.mjs` in `Ban app.js = 20260912-02 (index.html
khop).` exit 0 · ba file integration của đợt (`assignments` + `phase8c-files` +
`approvals-pending-da-sua`) chạy cùng nhau **84 passed** · `approvals-ui.test.js` **23/23** ·
`xss-guard.test.js` **11/11**.

**NGƯỜI DÙNG TEST TRÊN PC:** Ctrl+F5, xác nhận Network có `assets/js/app.js?v=20260912-02` và Console in
`[QLCV] app.js 20260912-02`, rồi bấm theo `docs/HUONG-DAN-TEST-GIAO-DIEN.md` **§9b.25 (bước 61 → 79)**:
61–68 **MỚI-3** nhãn «Mới»/«Sửa»/«Xoá» + nhãn đối tượng + nút «Xem các thay đổi» + popup đúng các lượt SAU
mốc + bảng «Yêu cầu xoá» + bảng «Phê duyệt kết quả» giữ nguyên + hình dạng phản hồi chỉ THÊM hai trường ·
69–70 **MỚI-4** bốn nút bé lại ở CẢ BA bảng, DevTools thấy `font-size: 11px` / `padding: 3px 9px` /
`min-height: 24px`, icon `10px`, vòng xoay `.loading::after` không vỡ · 71–74 **MỚI-5** `nv@` lập mới cấp 3
thấy hai ô MỞ, BLĐKS vẫn bó trong BLĐKS cấp 2, giao khác phòng ⇒ **403 «Cán bộ chỉ được giao nhiệm vụ cho
người cùng phòng»**, SỬA nhiệm vụ có sẵn vẫn khoá, `leader_ids` khoá mọi trường hợp · 75–78 **MỚI-6** nhiệm
vụ KHÔNG tích ⇒ `tp@` mất «Gửi đi duyệt» chỉ còn «Hoàn thành»/«Duyệt», gọi thẳng API ⇒ **409**, nhiệm vụ
CÓ tích ⇒ vẫn `cho-lanh-dao` cho PGĐ, nhóm `luu-tam` 0 bản thì không hiện nút chốt · 79 các mục cũ **không
đổi luật**. Rồi giữ xanh **9b.15 → 9b.24**.

**ĐÃ COMMIT + PUSH + DEPLOY XONG NGÀY 12/09/2026.** Ba commit theo **explicit paths** (không `git add .`):
`b17f878` `may-chu:` (114 file, +14256/−1417 — gồm cả 8 migration `022 → 029` và 34 file untracked trước
đó) · `3689bc2` `giao-dien:` (5 file `web/`) · `7929f62` `tai-lieu:` (9 file). Đã push
`68d4b75..7929f62` lên `origin/vps/sua-loi-vat`; cây làm việc **sạch hoàn toàn**. Trên VPS:
`bash deploy/backup.sh` → `git fetch` → `git pull --ff-only` (HEAD `7929f62`, quyền file mới `644`) →
`bash deploy/restart.sh` **exit 0**: «Migrations complete!», «OK: app/db healthy, readyz DB up, OnlyOffice
healthcheck=true». Xác minh sau deploy: `pgmigrations` = **29** (029 → 021 đúng thứ tự; bảng này có schema
`id / name / run_on`, **KHÔNG có cột `version`/`dirty`**) · bốn cột mới có thật (`task_files.tp_duyet_boi`,
`tp_duyet_luc`, `approval_changes.file_id`, `work_items.supervisor_ids`) · `task_file_flow_hanh_dong_check`
nay **12 action**, đã bỏ `trinh-lanh-dao` · `readyz {"ok":true,"db":"up"}` · buster qua nginx
`https://ttdt.site/` = **`20260912-02`** ở cả 4 URL · `docker logs qlcv-app`: **0** dòng error/fatal, ba
lịch cron (quét quá hạn 07:00, dọn tin chat, đẩy Zalo `*/2`) đều bật. Backup chụp trước deploy:
`/var/backups/qlcv/qlcv-2026-09-12.dump` + thư mục `restart-<ngày giờ>-<mã>/` của `restart.sh`.
**VIỆC CÒN NỢ: NGHIỆM THU GIAO DIỆN TRÊN PRODUCTION** — bấm `docs/HUONG-DAN-TEST-GIAO-DIEN.md` **§9b.25
(bước 61 → 79)** ngay trên `https://ttdt.site` với **Ctrl+F5**, giữ dữ liệu thật cẩn thận.

**TÀI LIỆU ĐÃ CẬP NHẬT TRONG ĐỢT NÀY:** `docs/KE-HOACH-DUYET-CAY.md` **§13 (MỚI, 5 tiểu mục)** ·
`docs/HUONG-DAN-TEST-GIAO-DIEN.md` **§9b.25 (MỚI)** + dòng mới ở bảng §11 · `docs/KE-HOACH-KET-QUA-FILE.md`
khối **«Bổ sung 12/09/2026 lượt 2» (MỚI, ở ĐẦU file)** · `docs/XSS-4.6.md` khối pin **101/986** (ở ĐẦU
file) · `KE-HOACH-VPS.md` §13.2 (hàng mới ở TRÊN) + §13.3 (dòng «2026-09-12 (đợt B bổ sung lượt 2…)» ở
DƯỚI) + §13.5 (khối «Bổ sung 12/09/2026 (đợt B bổ sung lượt 2 …)» — **hai mươi mốt bẫy** — ở TRÊN) ·
`docs/BAT-DAU-SESSION.md` khối này · `chay-test.bat` **chỉ sửa chú thích REM** (thêm khối **(12)** trước
dòng `REM =====` của phần khai báo biến) — bước `[7/7]` in buster bằng `findstr` nên không cần sửa logic.

## Snapshot trước đợt B bổ sung lượt 2 — ĐỢT B BỔ SUNG 12/09/2026: «Tình trạng» và «Người thực hiện» ghi Ở TỪNG BẢN · bản ĐẦU chỉ người thực hiện trực tiếp nộp

**ĐỢT B, bản sửa Q6/Q11 và đợt bổ sung này CHƯA NGHIỆM THU — nghiệm thu GỘP MỘT LẦN.** Đọc khối này
trước; hai khối «Snapshot trước đợt B bổ sung — BẢN SỬA Q6/Q11» và «Snapshot trước bản sửa Q6 — ĐỢT B»
bên dưới vẫn còn hiệu lực ở mọi chỗ **không mâu thuẫn** với khối này.

**KHÔNG CÓ MIGRATION — CSDL GIỮ `029`, NGƯỜI ĐANG TEST CHỈ CẦN Ctrl+F5.** Không phải chạy lại
`chay-test.bat`. Buster + banner **`20260911-04` → `20260912-01`** (5 chỗ: `web/index.html` dòng
21/1230/1232/1233 + `app.js:9`). **Hình dạng phản hồi RPC/REST không đổi** — chỉ THÊM ba trường trong
`quyen`.

**HAI CHỈ ĐẠO NGHIỆP VỤ (nguyên văn):**

> «Sửa lại, người thực hiện trực tiếp mới được upfile đầu tiên, hiện tại đang cho Tp up file đầu tiên»

> «ở cột Tình trạng fiel kết quả, ghi ở từng bản tình trạng, ví dụ bị trả về hoặc tp/pp sửa trực tiếp,
> PGĐ/GĐ sửa trực tiếp, lưu ý thêm tên vào nhé, phần Người thực hiện sẽ là người duyệt hoặc người sửa đối
> với các bản sau, chỉ hiển thị Người thực hiện trực tiếp nếu trực tiếp sửa lại bản bị trả về hoặc tải lên
> lần đầu...»

**ĐÃ LÀM:**

- **(1) Guard bản ĐẦU** — `assertNguoiNopBanDau(user, item, versionNo, client)` ở
  `server/src/modules/taskFiles/service.js:371`. `version_no > 1` ⇒ `return` ngay (luật cũ giữ nguyên cho
  mọi bản sau). `assignee_id == null` ⇒ **409 CONFLICT**; sai người ⇒ **403 FORBIDDEN** kèm TÊN tra từ
  `users`. Gọi ở **CẢ HAI** đường: `nopBaoCao` (625) và `nop` (710 — **TRƯỚC** `mkdir`/`writeFile`).
  `luuTuCallback` **không** gác (luôn sinh bản ≥ 2). Điều kiện theo **SỐ BẢN**, không theo `fileId == null`
  — vì Q1 tách KHAI khỏi NỘP, `khaiKetQua` tạo nhóm **0 bản**. Lỗ hổng cũ: `duocGhiTheoPhanCong`.
- **(2) `quyenFile()` (~1498)** trả thêm `duocNop` / `tenNguoiThucHien` / `thieuNguoiThucHien`, tra `users`
  qua `repo.nguoiTheoId` chạy song song trong `Promise.all` — **không** đọc `item.assignee_name` (rỗng khi
  client chỉ gửi `assigneeId`, MỒ CÔI khi user bị xoá vì FK `ON DELETE SET NULL`).
- **(3) `taskFiles/repo.js listNhomByItem`** thêm `w.assignee_id` + `nv.full_name AS ten_nguoi_thuc_hien`.
  **Cố ý không nhét vào hằng `NHOM`** để mọi đường đọc khác giữ nguyên hình dạng.
- **(4) `web/assets/js/app.js`** — ba bảng hằng `Object.freeze` (`NHAN_VAI_NGAN` 2340 · `HANH_DONG_TAO_BAN`
  2351 · `TINH_TRANG_BAN` 2358); **sáu HÀM TRẢ CHUỖI** 4090–4193 (`vaiNgan`, `luongCuaBan`,
  `banTruocBiTraVe`, `nguoiTaoBan`, `tinhTrangMotBan`, `nguoiThucHienCuaBan`) — **không hàm nào dựng
  HTML**, nhờ vậy CAN-THOAT giữ đúng 21 chỗ; `buildDongBanKetQua` (4194) viết lại **ô 7** (NHÃN + TÊN +
  `title`) và **ô 9** (từ ô TRỐNG thành badge); `buildKhoiFile` (4298) thêm `doiNguoiNop` (4359 → ô Hành
  động 4423); ô 7 DÒNG CHA (4402–4403) đổi nguồn `ten_nguoi_tao` → `ten_nguoi_thuc_hien`; cờ
  `quyenNopBanDau` (2711/2977/2988) và dải chú bảng RỖNG (3027–3035).

**TEST: full `2043/2043 · 114 file · Duration 279.08s · exit 0`** (mốc trước 2034/113 — đúng **+9 ca** của
file mới). `npm run lint` exit 0; `format:check` còn đúng **2 nợ cũ** ngoài phạm vi (`workItems/tyLe.js`,
`stats-parity.test.js`); `tools/dem-xss.mjs` đo **100 sink / 978 nội suy** (từ 969, CAN-THOAT **không
đổi**); `tools/local-assets-check.mjs` in `Ban app.js = 20260912-01 (index.html khop).` exit 0.

- File MỚI `server/tests/integration/phase8d-ban-dau.test.js` — **9 ca** (7 ca luật bản đầu + 2 ca cờ cho
  giao diện).
- Vá `server/tests/integration/phase8c-files.test.js` — **3 ca** từng cho TP/admin up bản 1 làm bước dọn
  cảnh: `TC-V2-04`, `TC-V5-03` ×2. **Sửa test theo luật mới, KHÔNG nới guard.**
- `server/tests/unit/xss-guard.test.js` — `TC-SEC-17` đổi pin **969 → 978** + khối chú thích 2026-09-12.

**NGƯỜI DÙNG TEST PC — `docs/HUONG-DAN-TEST-GIAO-DIEN.md` §9b.24 (bước 46 → 60).** 46 hiện trường ·
47 `tp@` **mất nút «Tải lên»** ở nhóm 0 bản + dải chú «Bản đầu chỉ «Tên» nộp được.» · 48 gọi thẳng API ⇒
**403 kèm tên**, đường «Báo cáo» cũng 403 · 49 `nv@` nộp bản 1 ⇒ 200, từ bản 2 luật cũ y nguyên · 50 chưa
gán người thực hiện ⇒ **409** · 51–54 cột «Tình trạng» có badge **ở từng bản** kèm tên (bảng đối chiếu 8
hành động; bản chưa ai đụng thì in «Tải lên lần đầu»/«Sửa lại bản bị trả về»/«Nộp lại»; `gom-y` cố ý không
phải tình trạng) · 55–59 cột «Người thực hiện»: bản 1 của `nv@` và bản sửa lại sau trả về ⇒ «Người thực
hiện trực tiếp», còn lại ⇒ người duyệt/người sửa kèm vai, dữ liệu cũ ⇒ «TP/PP nộp thay», dòng CHA lấy
người thực hiện của nhiệm vụ · 60 các mục cũ **không đổi luật**. Rồi giữ xanh **9b.15 → 9b.23 (gồm mục J)**.

**CHƯA NGHIỆM THU — CHƯA COMMIT/PUSH/DEPLOY.** Chỉ khi nghe **OK RIÊNG ĐỢT NÀY** mới commit bằng
**explicit paths** (không `git add .`), push `vps/sua-loi-vat`, deploy theo `deploy/runbook.md` — **VPS
đang ở `pgmigrations=021`, phải áp 022 → 029, backup VPS trước**. OK ngày 2026-09-08 của bản bỏ vai cũ
**KHÔNG** áp dụng cho đợt này. Danh sách file untracked phải `git add` đích danh: xem cuối khối ĐỢT B bên
dưới, **cộng thêm `server/tests/integration/phase8d-ban-dau.test.js`**.

**TÀI LIỆU ĐÃ CẬP NHẬT TRONG ĐỢT NÀY:** `docs/KE-HOACH-DUYET-CAY.md` **§12 (MỚI, 5 tiểu mục)** ·
`docs/HUONG-DAN-TEST-GIAO-DIEN.md` **§9b.24 (MỚI)** · `docs/KE-HOACH-KET-QUA-FILE.md` khối **«Bổ sung
12/09/2026» (MỚI, ở ĐẦU file)** · `docs/XSS-4.6.md` khối pin **100/978** (ở ĐẦU file) · `KE-HOACH-VPS.md`
§13.2 (hàng mới ở TRÊN) + §13.3 (dòng «2026-09-12 (đợt B bổ sung…)» ở DƯỚI) + §13.5 (khối «Bổ sung
12/09/2026» — **mười một bẫy** — ở TRÊN) · `docs/BAT-DAU-SESSION.md` khối này · `chay-test.bat` **chỉ sửa
chú thích REM** (dòng 43 bỏ số buster hardcode + khối **(11)** mới) — bước `[7/7]` in buster bằng
`findstr` nên không cần sửa logic.

## Snapshot trước đợt B bổ sung — BẢN SỬA Q6/Q11 SAU ĐỢT B: tích «Gửi BLĐ phê duyệt» quyết định TP/PP có nút nào (chiều 11/09/2026)

**ĐỢT B và bản sửa này CHƯA NGHIỆM THU — nghiệm thu GỘP MỘT LẦN.** Đọc khối này trước, khối
«Snapshot trước bản sửa Q6 — ĐỢT B» bên dưới vẫn còn hiệu lực ở mọi chỗ **không mâu thuẫn** với khối này.

**LỖI NGƯỜI DÙNG BẮT ĐƯỢC KHI TEST THẬT (nguyên văn):** «vừa tôi test, nhiệm vụ mà **ko tích** gửi Gửi
BLĐ phê duyệt, nhưng khi gửi file **tp duyệt vẫn đẩy lên cho PGĐ**, CV002». Hiện trường đo trên UAT
(read-only): `CV002-002` = `work_items.id 8`, cấp 3, `gui_bld_phe_duyet = f`, `assignee_id = 5` (Lê Thị
Nhân, **Nhân viên**), `leader_ids = {3}` (Trần Thị Trưởng, **Trưởng phòng**), `supervisor_ids = {2}`
(Phó GĐ Phụ trách); nhóm file **6** («Hi»): `nv1` `gui-duyet` 22:18:42 ⇒ `cho-xem` → `tp`
`sua-truc-tuyen` 22:19:45 tạo bản 2 `uploaded_by = 3` → `tp` `tp-phe-duyet` 22:19:58 ⇒ `cho-lanh-dao`.

**HAI NGUYÊN NHÂN CHỒNG NHAU — sửa một cái là vẫn tái diễn:**

1. `BANG_VERDICT['tp-phe-duyet'].den` là `cho-lanh-dao` **CỐ ĐỊNH, không đọc tích**. ĐỢT B đã đọc Q6
   thành «không đổi luồng» — chỉ **đổi tên** hành động chứ không làm nó **phụ thuộc dữ liệu**.
2. Van chống tự duyệt canh **`uploaded_by` của bản cuối** ⇒ TP vừa «Sửa trực tuyến» là **mất** nút
   «Hoàn thành / Duyệt». Ghép với (1): TP chỉ còn **đúng một** nút, và nút đó đẩy lên PGĐ.

**HAI LỰA CHỌN NGƯỜI DÙNG ĐÃ CHỐT** (qua hộp hỏi, còn hiệu lực):

| Câu hỏi | Người dùng chọn | Nghĩa là |
|---|---|---|
| Luồng khi tích TẮT | **«Ẩn nút, chỉ còn «Hoàn thành»»** | Tích TẮT ⇒ TP/PP chỉ thấy **«Hoàn thành / Duyệt»** + **«Đẩy về Cán bộ»**; «TP/PP phê duyệt» chỉ hiện khi tích **BẬT** hoặc khi **không được tự chốt**. Nút chốt nay có ô ghi chú **TUỲ CHỌN** |
| Van chống tự duyệt | **«Nới: chỉ chặn khi là người thực hiện»** | `hoan-thanh` chỉ bị chặn khi tích **BẬT** hoặc khi người bấm là **`assignee`** (Q5). **BỎ** điều kiện «người lưu bản cuối» |

**ĐÃ LÀM — `server/src/modules/taskFiles/service.js`:**

- **`phaiTrinhLanhDao(user, item)` (dòng 785) — MỘT hàm duy nhất** = `item.gui_bld_phe_duyet === true ||
  sameId(item.assignee_id, user.id) || giaTriHieuLuc(user,'file','approve') !== 'cho-phep'`. `verdict` và
  `hanhDongDuocLam` đọc **CÙNG** hàm ⇒ **nút hiện trên màn hình và luật máy chủ không bao giờ lệch nhau**.
- `BANG_VERDICT`: `tp-phe-duyet` thêm cờ **`chiKhiTrinh: true`** (831); `hoan-thanh` nay **`canDuyet: true`**
  (845) để ghi đè ⏳ chặn được nó. `hanhDongDuocLam` (1188-1204) thêm hai bộ lọc: `(!luat.chiKhiTrinh ||
  trinh)` (1200) và `!(ma === 'hoan-thanh' && trinh)` (1201).
- **Ba guard trong `verdict`, đúng thứ tự:** **(5)** 924 — `hoan-thanh` + tích BẬT ⇒ **403** «Nhiệm vụ đã
  bật Gửi BLĐ phê duyệt — phải trình Ban lãnh đạo phụ trách, không Hoàn thành tại TP/PP»; **(6)** 927-929
  — `chiKhiTrinh` + **không** phải trình ⇒ **409** «Nhiệm vụ này KHÔNG bật «Gửi BLĐ phê duyệt» nên TP/PP
  là chặng cuối — hãy dùng «Hoàn thành / Duyệt» để chốt, hoặc «Đẩy về Cán bộ» nếu cần sửa lại.»; **(8)**
  942 — `canDuyet` + `file:approve` = ⏳ ⇒ **403**; **(11)** 972 — `hoan-thanh` + người bấm là `assignee`
  ⇒ **403** «Bạn là người thực hiện nhiệm vụ này nên không được tự chốt kết quả của chính mình — hãy dùng
  «TP/PP phê duyệt» để trình Ban lãnh đạo kiểm soát.» — **thay hẳn** guard cũ đọc `uploaded_by`.
- `thongBaoVerdict` nhánh `default` nay **nối ghi chú** vào chuông (`Ghi chú: <lý do>`) — trước đó ghi chú
  của `hoan-thanh` bị **nuốt**.
- Copy trang editor (1864): «Bản này bạn không tự Hoàn thành được — phải trình Ban lãnh đạo kiểm soát. Nút
  «TP/PP phê duyệt» sẽ lưu bản mới rồi trình lên; cần ý kiến ít nhất 10 ký tự.» **Cố ý giữ substring
  `không tự Hoàn thành`** để hai ca UI đang assert không vỡ.

**ĐÃ LÀM — `web/assets/js/app.js`:** hằng `HANH_DONG_CHOT = Object.freeze(["hoan-thanh","duyet"])` (2346);
`xuLyVerdictFile` (3518-3549) thêm nhánh đọc ô `task-y-kien-<fileId>` cho nút chốt, `.trim().slice(0,2000)`,
**KHÔNG bật `prompt`**; `dsVerdictFile` (3725-3732) lọc nút chốt theo `giaTriHieuLucFile(role,'approve')`
và **cố ý là SUPERSET** (máy chủ vẫn là người quyết). **`xuLyVerdictChoDuyet` (8886-8903) CỐ Ý KHÔNG ĐỔI**
— trang «Hàng chờ phê duyệt» không dựng sẵn ô nhập nên nút chốt ở đó **không gửi ghi chú**.
`nutVerdictFile`/`buildNutVerdictFile` **vẫn là CODE CHẾT**, chưa dọn.

**LUẬT BẢO ĐẢM — ĐÚNG MỘT đường chốt trong mọi tổ hợp:** TẮT + không phải `assignee` + quyền duyệt ✓ ⇒
chỉ «Hoàn thành / Duyệt»; BẬT ⇒ chỉ «TP/PP phê duyệt»; TẮT + **là** `assignee` ⇒ chỉ «TP/PP phê duyệt»
(Q5); TẮT + quyền duyệt ⏳ ⇒ chỉ «TP/PP phê duyệt». **Không ô nào ra cả hai nút hoặc mất cả hai.**

**CSDL — KHÔNG CÓ MIGRATION MỚI CHO BẢN SỬA NÀY.** Vẫn ở `029`; **chỉ đổi mã máy chủ + `app.js`**, buster
`20260911-03` → **`20260911-04`** (5 chỗ: `web/index.html` dòng 21 · 1230 · 1232 · 1233 + banner
`console.info("[QLCV] app.js 20260911-04")` ở `app.js:9`; `api-bridge.js` vẫn ghim `?v=20260825`).
⇒ **Người đang test chỉ cần Ctrl+F5, KHÔNG cần chạy lại `chay-test.bat`.** (Muốn chắc ăn thì `/giu /f`
vẫn được — 029 đã lên rồi nên `migrate:up` sẽ bỏ qua.)

**UAT ĐÃ LÊN `pgmigrations=029`** (đo lại trong session): lỗi `23514` do để hai câu `UPDATE` **trước**
`DROP CONSTRAINT` đã sửa thành **`DROP → UPDATE → ADD`** + chốt `DO $$`; node-pg-migrate đã tự rollback
nên lần nổ trước không để lại rác. **Đừng chạy `npm run migrate:up` bằng tay** — nó đọc `../deploy/.env`
và trúng CSDL **dev** `quanlycongviec` @ 5432, không phải UAT; thứ trỏ đúng `quanlycongviec_uat` là
`chay-test.bat`. **029 vẫn KHÔNG LÙI TỰ ĐỘNG** (DOWN = `RAISE EXCEPTION`) ⇒ sao lưu trước khi migrate.

**HIỆN TRƯỜNG UAT SAU KHI 029 LÊN (đo read-only):** 8 nhiệm vụ cấp 3 đều **«Đã duyệt»** ⇒ Q1/Q2 (cấm tải
file khi cây chưa duyệt) **không thử được trên chúng**, phải tạo nhiệm vụ mới; **4 nhiệm vụ
`CV001-003`→`CV001-006` TRỐNG `supervisor_ids`** ⇒ không thử được ĐIỂM 12/R1(a)/`assertGuiBld` trên
chúng; 7 nhóm file, mốc điền ngược **3/7** (nhóm 3, 4, 6 đều `tp_duyet_boi = 3` = `tp@test.local`).
**DỮ LIỆU KHÔNG TỰ LÙI:** nhóm file **6** của `CV002-002` **đang ở `cho-lanh-dao`**, mà nút chốt của TP
chỉ có ở `cho-xem`/`can-sua` ⇒ muốn nghiệm thu trên đúng hiện trường cũ thì `pgd@` bấm **«Đẩy về TP»**
(`tra-ve-tp` ⇒ `can-sua`) rồi `tp@` sẽ thấy «Hoàn thành / Duyệt». Hoặc tạo nhiệm vụ mới cho sạch.

**Full test 2034/2034 · 113 file · Duration 244.55s · exit 0** (mốc ĐỢT B 2027/2027; **+7 ca mới trong
`tests/integration/phase8d-dot-b.test.js`**); focused đã chạy tuần tự trước: `task-files-api` 54/54 ·
`phase8c-files` + `task-files-editor` 45/45 · `phase8d-dot-b` 37/37. `lint` scoped 4 file exit 0;
`prettier --check` sạch; `tools/dem-xss.mjs` đo **100 sink / 969 giá trị — KHÔNG ĐỔI** (pin ở
`docs/XSS-4.6.md`, mục mới «Pin sau bản sửa Q6/Q11»).

**BẪY ĐÃ TRẢ GIÁ — đọc `KE-HOACH-VPS.md` §13.5 khối «Bổ sung 11/09/2026 (chiều — bản sửa Q6/Q11…)», chín
bẫy; và `docs/KE-HOACH-DUYET-CAY.md` §11.6.4.** Ba bẫy đáng nhớ nhất: (a) đọc một quyết định về **LUỒNG**
thành quyết định về **TÊN NÚT**; (b) **ẩn nút chỉ an toàn khi còn ít nhất một nút hợp lệ** — phải **đếm
đường ra trước khi ẩn nút**; (c) **test «xanh oan»** khi lời gọi dựng hiện trường (`tp-phe-duyet`/
`tra-ve-tp`/`gui-di-duyet`) không được assert — ca vẫn xanh dù guard mới từ chối chính bước dọn đó, và nó
âm thầm đo một hiện trường **khác** với tên ca. Đã thêm assert ở TF-09, TF-10, `taoLenh`, TC-HCPD-02,
TC-V4-09.

**CÁCH BẬT TÍCH TRONG TEST — hai đường, chọn theo fixture, KHÔNG đổi lẫn nhau:** `phase8d-dot-b.test.js`
dùng **SQL thẳng** (`batGuiBld`: `UPDATE work_items SET gui_bld_phe_duyet = true WHERE id = $1`);
`task-files-api.test.js` và `phase8c-files.test.js` dùng **API lúc tạo** (`guiBldPheDuyet: true` +
`supervisorIds`) vì **`assertGuiBld` (`assignments/service.js:487-518`) ném 400 «Nhiệm vụ chưa có Ban lãnh
đạo kiểm soát để gửi phê duyệt»** khi tích BẬT mà cả nhiệm vụ lẫn công việc cha đều trống `supervisor_ids`
— **mười ca** đỏ cùng lúc vì đúng một chỗ, sửa bằng `...(guiBld ? { supervisorIds: [pgdA.id] } : {})`.
**Phải khai lúc TẠO chứ không `PATCH` về sau**: sửa nhiệm vụ trên cây đã duyệt thì Q9 hạ cây về `Chờ
duyệt` và Q2 **khoá luôn cửa nộp file**.

**NGƯỜI DÙNG TEST PC — `docs/HUONG-DAN-TEST-GIAO-DIEN.md` §9b.23, ĐỌC MỤC J TRƯỚC KHI BẤM LẠI.** Mục J
(bước **36→45**) là phần mới của bản sửa này: 36 ca bạn báo nay phải khác · 37 gọi thẳng API ⇒ **409** ·
38 tích BẬT ⇒ **403** · 39 TP vừa sửa trực tuyến **vẫn** chốt được · 40 van chỉ canh NGƯỜI THỰC HIỆN ⇒
**403** · 41 ghi đè ⏳ vẫn thắng ⇒ **403** · 42 ghi chú nút chốt TUỲ CHỌN (trang «Hàng chờ phê duyệt» cố ý
không có ô ghi chú) · 43 bật tích mà chưa có BLĐKS ⇒ **400** · 44 câu giải thích ở trang editor đã đổi chữ ·
45 **mọi tổ hợp phải có ĐÚNG MỘT đường chốt**. Rồi giữ xanh **9b.15 → 9b.22**. Mục **E bước 18** và **bước
21**, mục **I bước 34**, **§9b.17 bước 10**, **§9b.8 (3)** đều đã được sửa lại vì bản đầu ghi SAI.

**CHƯA NGHIỆM THU — CHƯA COMMIT/PUSH/DEPLOY.** Chỉ khi nghe **OK RIÊNG ĐỢT NÀY** mới commit bằng
**explicit paths** (không `git add .`), push `vps/sua-loi-vat`, deploy theo `deploy/runbook.md` — **VPS
đang ở `pgmigrations=021`, phải áp 022 → 029, backup VPS trước**. OK ngày 2026-09-08 của bản bỏ vai cũ
**KHÔNG** áp dụng cho đợt này. Danh sách file untracked phải `git add` đích danh: xem cuối khối ĐỌT B bên dưới.

**TÀI LIỆU ĐÃ CẬP NHẬT TRONG BẢN SỬA NÀY:** `docs/KE-HOACH-DUYET-CAY.md` **§11.6 (MỚI, 5 tiểu mục)** + sửa
§11.2 hàng Điểm 7, §11.3, §11.5 · `docs/HUONG-DAN-TEST-GIAO-DIEN.md` **§9b.23 MỤC J (MỚI)** + 6 chỗ sửa ·
`docs/KE-HOACH-KET-QUA-FILE.md` mục **«ĐỢT B + bản sửa Q6» (MỚI, ở ĐẦU file)** + 8 chỗ cũ đánh dấu đã đổi ·
`docs/XSS-4.6.md` mục pin mới · `KE-HOACH-VPS.md` §13.2 (hàng mới ở trên + sửa 4 chỗ cũ trong hàng ĐỢT B),
§13.3 (dòng mới «2026-09-11 (chiều — bản sửa Q6/Q11…)»), §13.5 (khối «Bổ sung» mới) · `chay-test.bat`
**chỉ sửa chú thích REM** (dòng 43 + khối (10) mới) — bước `[7/7]` in buster bằng `findstr` nên **không**
hardcode, không cần sửa logic.

## Snapshot trước bản sửa Q6 — ĐỢT B: «gộp hai trục» duyệt cây + duyệt file kết quả (11/09/2026)

**CÓ MIGRATION MỚI `029_dot_b_gop_hai_truc.sql` và CÓ đổi cả mã máy chủ lẫn giao diện** ⇒ test PC
**BẮT BUỘC chạy lại `chay-test.bat /giu /f`** (script tự `npm run migrate:up` rồi mới bật Node).
**Ctrl+F5 là KHÔNG ĐỦ.** ⚠ **029 ĐÃ LÊN UAT rồi** (chiều 11/09/2026) ⇒ từ đây về sau, với **bản sửa
Q6/Q11** thì **Ctrl+F5 là ĐỦ** vì bản đó **không có migration** — xem khối «Ưu tiên hiện tại» ở đầu file.

**⚠ ĐÃ CŨ — UAT NAY ĐÃ LÊN `pgmigrations=029` (chiều 11/09/2026); đọc khối «Ưu tiên hiện tại — BẢN SỬA
Q6/Q11» ở trên. Đoạn dưới đây giữ nguyên để nhớ LÝ DO và thứ tự đúng của 029.** ~~UAT TRÊN PC ĐANG Ở
`pgmigrations=028` — 029 CHƯA LÊN.~~ ~~Cột `task_files.tp_duyet_boi`/`tp_duyet_luc`
chưa có, CHECK `task_file_flow_hanh_dong_check` vẫn còn `yeu-cau-sua` + `trinh-lanh-dao`, CHECK
`approval_changes_change_kind_check` vẫn chỉ `reviewer` + `gui-bld`.~~ **Nay cả ba đã có/đã đổi.**
**Đừng chạy `npm run migrate:up`
bằng tay**: `migrate` đọc `../deploy/.env` (`server/package.json`), và `DATABASE_URL` ở đó trỏ
`quanlycongviec` @ `127.0.0.1:5432` = **CSDL DEV**, không phải UAT. Thứ trỏ đúng
`quanlycongviec_uat` là `chay-test.bat` (dòng 60 đặt `DB`, dòng 151 đặt `DATABASE_URL`, dòng 212 gọi
`npm run migrate:up`). **029 KHÔNG LÙI TỰ ĐỘNG ĐƯỢC** — DOWN là một `RAISE EXCEPTION` (giống 025/026),
vì lịch sử `yeu-cau-sua` đã bị gộp nên không còn cách nào biết dòng nào từng là nút nào, và xoá đề nghị
`ty-le` đang treo là xoá việc người dùng đang chờ ký. Lùi thật sự = khôi phục bản sao lưu ⇒ **sao lưu
TRƯỚC khi chạy**.

> **LẦN CHẠY ĐẦU NGÀY 11/09/2026 ĐÃ NỔ — VÀ ĐÃ SỬA XONG, CHỈ CẦN CHẠY LẠI.** Người dùng chọn mode 4,
> tới bước [4/7] thì `23514 task_file_flow_hanh_dong_check` (`Failing row contains (6, 3, 1, 3, Trưởng
> phòng, tp-phe-duyet, …)`). Nguyên nhân: 029 đặt hai câu `UPDATE` đổi tên verdict **TRƯỚC** câu
> `ALTER TABLE … DROP CONSTRAINT`, mà CHECK cũ không biết `tp-phe-duyet` nên chính nó chặn câu lệnh
> sinh ra để thay nó. Đã sửa thành **`DROP → UPDATE → ADD`** và thêm chốt `DO $$ … RAISE EXCEPTION` kể
> đích danh mã lạ. node-pg-migrate **tự `Rolling back attempted migration`** nên UAT không hỏng gì, vẫn
> sạch ở 028. Bản sửa đã được **dry-run trên BẢN SAO dữ liệu UAT thật** (nạp từ
> `E:/quanlycongviec-backups/uat-20260911-204416` vào CSDL tạm rồi drop): `task_file_flow` **46 → 46
> dòng**, `trinh-lanh-dao:3 → tp-phe-duyet:3`, `yeu-cau-sua:2 → tra-ve-cbo:2`, mốc điền ngược **3/16**
> nhóm file. Vì sao 2020 test xanh mà không bắt được: `tests/global-setup.js` dựng CSDL test từ số
> không nên `task_file_flow` **rỗng** lúc 029 chạy. Đã bịt bằng
> **`tests/integration/migration-replay.test.js`** (mới, 7 test) — replay `022 → 029` trên CSDL riêng có
> **gieo dữ liệu cũ**, và đã kiểm bằng mutation (trả 029 về thứ tự sai ⇒ test đỏ đúng lỗi đó).
> Chi tiết: `KE-HOACH-DUYET-CAY.md` §11.4 bẫy (2) + (10), `KE-HOACH-VPS.md` §13.5 bẫy (10).
> **Lần chạy lại nên chọn `/giu /f` (mode 1), ĐỪNG chọn mode 4** — xem cảnh báo `supervisor_ids` ở dưới.
> **ĐÃ CHẠY LẠI THÀNH CÔNG: UAT nay ở `029_dot_b_gop_hai_truc`.**

**⚠ Số liệu của RIÊNG ĐỢT B lúc đó — nay là 2034/2034 và buster `20260911-04`, xem khối trên.**
**Full test 2027/2027 · 113 file · Duration 276.91s · exit 0** (đợt A: 1987/111; **+7 của
`tests/integration/migration-replay.test.js`** thêm sau khi 029 nổ trên UAT); `lint` exit 0;
`format:check` còn đúng
2 nợ cũ (`workItems/tyLe.js`, `stats-parity.test.js`); `node --check` sạch; `tools/dem-xss.mjs` đo
**100 sink / 969 giá trị**; `local-assets-check --live` **exit 0**; buster + banner **`20260911-03`**
(bốn chỗ trong `index.html`: dòng 21 · 1230 · 1232 · 1233, cộng banner ở `app.js` dòng 9;
`api-bridge.js` vẫn ghim `?v=20260825`). Pin XSS **100 sink / 964 → 969 nội suy**, CAN-THOAT
**19 → 21 chỗ** (16 mục trong `CO_Y_KHONG_BOC`) — hai chỗ mới đều là ô nhập tỷ lệ đã escape sẵn.

**TÁM VIỆC CỦA ĐỢT B** (số Q/R/điểm lấy từ bảng quyết định bên dưới — bảng đó vẫn là **nguồn sự thật**):

1. **Q1 + Q2 + Q4 — CẤM HẲN nút tải file khi cây chưa duyệt.** Lần gửi ĐẦU chỉ có **KHAI BÁO**
   (tên kết quả · định dạng · tỷ lệ) đi theo cây; **file thật** đi chuỗi riêng **SAU KHI** cây `Đã duyệt`.
   Máy chủ chặn bằng `chanKhiCayChuaDuyet` (`taskFiles/service.js:282`, soi `itemsRepo.cayDaDuyet`) với
   thông báo `LOI_CAY_CHUA_DUYET` (dòng 279). Giao diện: `buildKhungKhaiKq` (`app.js:3036`) thêm ô
   **Tỷ lệ (%)** qua helper dùng chung `oNhapTyLeKhai` (dòng 3016), luật số ở `docTyLeKhai` (dòng 3008) —
   **để trống = `null` = «tự chia»**, sai thì báo cho người dùng sửa chứ không âm thầm bỏ qua.
   Chỉ «Báo cáo» mới có ô nội dung chữ (`doiDinhDangKhaiKq`); năm định dạng còn lại khai rồi nộp file sau.
2. **Q3 — `Nháp` là nháp TẤT CẢ.** `trangThaiDuyetKhiTao` (`approvals/rules.js:41`) **BỎ** luật cũ
   «nhiệm vụ cấp 3 LUÔN `Đã duyệt`» (điểm bất hợp lý số 2): nay chỉ còn ba nhánh — `luuNhap` ⇒ `Nháp`,
   ghi đè `create` ⇒ `Chờ duyệt`/`Đã duyệt`, **còn lại ⇒ `Chờ duyệt`**. `v_countable_items` không mất số
   của phần cây đã duyệt vì nó loại **đúng dòng** `Chờ duyệt` chứ không hạ cả cây.
3. **R5 — nhiệm vụ thêm SAU vào cây đã duyệt = `Chờ duyệt` MỘT MÌNH NÓ**, duyệt riêng. Đây là hệ quả
   trực tiếp của việc bỏ luật ở mục 2, không cần mã riêng.
4. **R6 — BỎ TỰ DUYỆT.** `apTuDong` (`taskFiles/service.js:368`) nay **chỉ** trả `cho-lanh-dao`
   (TP/PP nộp) hoặc `cho-xem`; **không bao giờ** trả `da-duyet`, và `duyet-tu-dong` **không được ghi
   thêm** (mã vẫn nằm trong CHECK để dòng lịch sử cũ đọc được). `file:create = ✓` chỉ còn nghĩa
   «được phép khai/nộp`. `batBuocDuyet` của bản cũ mất nghĩa nên bỏ — nó sinh ra chỉ để CHẶN tự duyệt.
   **Đọc thêm mục «SÁU CÁCH DIỄN GIẢI» điểm (a) dưới đây.**
5. **ĐIỂM 7 — thay `trinh-lanh-dao` bằng «TP/PP phê duyệt» (`tp-phe-duyet`) CÓ LƯU MỐC.** Thêm hai cột
   `task_files.tp_duyet_boi` + `tp_duyet_luc`; 029 điền ngược cho dữ liệu cũ bằng lần `tp-phe-duyet`
   hoặc `hoan-thanh` MUỐN NHẤT của nhóm (`hoan-thanh` cũng là một lần TP/PP ký theo Q11;
   `duyet-tu-dong` thì KHÔNG — máy tự chốt, không có người). ~~Trạng thái đích **GIỮ NGUYÊN**
   `cho-lanh-dao` vì Q5/Q6 không đổi luồng.~~ **CHỖ NÀY ĐỌC SAI Q6 — ĐÃ SỬA chiều 11/09/2026:** trạng
   thái đích **vẫn** là `cho-lanh-dao`, nhưng hành động này **chỉ TỒN TẠI khi nhiệm vụ thật sự phải trình
   BLĐKS** (tích BẬT, hoặc người bấm là `assignee`, hoặc `file:approve` ≠ ✓); tích TẮT thì TP/PP chốt bằng
   `hoan-thanh` và gọi thẳng `tp-phe-duyet` ⇒ **409**. Cờ mới là **`chiKhiTrinh`**, đọc qua MỘT hàm
   `phaiTrinhLanhDao` — xem khối «Ưu tiên hiện tại» ở đầu file và `KE-HOACH-DUYET-CAY.md` §11.6.
   Cờ `laMocTpPp` trong `BANG_VERDICT` quyết định hành động nào
   ghi mốc. **Ba tên trường cho CÙNG một mốc, đừng nhầm**: `ten_nguoi_tp_duyet` (GET `…/files`,
   `taskFiles/repo.js:27`) · `tp_duyet_ten` (mapper tab Nhiệm vụ dạng gọn, `repo.js:519`) ·
   `tenNguoiTpDuyet` (RPC camelCase).
6. **ĐIỂM 9 — gộp `yeu-cau-sua` vào `tra-ve-cbo`.** Hai mã cũ cùng `den:'can-sua'`, cùng
   `datLenhSua(...,'can-bo',...)`, khác đúng `tu` và `canNoiDung` — hai nút cho một việc. Mã sống sót lấy
   `tu` là **HỢP** của hai bên và `canNoiDung: true`. 029 phải chạy đúng thứ tự **`DROP CONSTRAINT` →
   `UPDATE` → `ADD CONSTRAINT`**: `UPDATE` đứng SAU `DROP` vì CHECK cũ không biết `tp-phe-duyet` (đảo
   lại là Postgres chặn ngay câu UPDATE bằng chính cái ràng buộc chưa bị xoá — **đã nổ thật trên UAT
   ngày 11/09/2026**), và đứng TRƯỚC `ADD` vì `ADD` soi lại mọi dòng nên một dòng `yeu-cau-sua` còn sót
   là chết `23514`. Khuôn 015/020/025 cũng `DROP` trước `ADD`, chỉ là chúng nới danh sách chứ không
   đổi tên giá trị nào.
7. **R4 + R4' + R4'' — tỷ lệ đi qua `approval_changes`.** Module mới `approvals/tyLe.js` (346 dòng):
   `proposeTyLe` **không đổi giá trị**, chỉ ghi MỘT dòng đề nghị `change_kind='ty-le'` và trả
   `{pending:true, value: giaTriCu, nguoiNhan}` — đúng khuôn `proposeGuiBld` của 026. `decideTyLe` kiểm
   lại quyền **SỐNG** rồi mới áp, qua đúng ba hàm chia đang có (`updateFileWeights` cho FILE ·
   `canLaiTyLeWork` cho đầu mục · `updateChildWeights` cho cấp 3 có cha) — **không phát minh luật chia
   mới**. `pendingTyLe` gộp vào **cùng** `GET /approvals/pending`, không mở hàng chờ thứ ba.
   Người nhận theo `nguoiNhanTyLe`: tỷ lệ **file** và tỷ lệ **nhiệm vụ cấp 3** → **ĐÚNG 1** BLĐKS cấp 3
   (có lùi về phần tử đầu của cấp 2 theo Q12); tỷ lệ **công việc con** → tất cả BLĐKS cấp 2.
   **KHÔNG hạ cây về `Chờ duyệt`** nên `v_countable_items` không mất số.
8. **ĐIỂM 12 — siết `dungNguoiDuyetFile` theo BLĐKS cấp 3, KỂ CẢ khi tích TẮT**
   (`taskFiles/service.js:764`). Bản cũ chỉ siết khi `gui_bld_phe_duyet` BẬT và chỉ siết vai Phó Giám đốc.
   Nay soi `supervisorFile(item)` = `supervisor_hieu_luc ?? supervisor_ids[0] ?? null` (dòng 747) cho
   **cả Phó Giám đốc lẫn admin**, không phụ thuộc cái tích — cùng luật với R1(a) bên trục duyệt cây.
   Hai vai TP/PP không đi qua đây (họ bị `laLanhDaoPhuTrachNhiemVu` soi theo `leader_ids`).

**029 KHÔNG PHẢI REBUILD VIEW**: không có view nào dựng trên `task_files` (chỉ 024 chạm bảng này và
không tạo view) nên thêm cột ở đây **không** nổ `countable-views.test.js` — khác hẳn 026/028. Nhưng nó
**ĐỔI hai index unique của 023**: `approval_changes_pending_work`/`_item` nay phải theo `change_kind`
(không có thì một đề nghị đổi tích đang treo chặn luôn đề nghị đổi tỷ lệ của cùng nhiệm vụ và ngược lại),
và `_item` thêm `COALESCE(file_id,0)` để đề nghị tỷ lệ của **TỪNG NHÓM FILE** không đè nhau.
Cột mới `approval_changes.file_id` là `ON DELETE CASCADE`.

**SÁU CÁCH DIỄN GIẢI — NÓI VỚI NGƯỜI DÙNG KHI NGHIỆM THU, đừng để họ tự phát hiện:**
- **(a) Bỏ hẳn `VAI_TU_DUYET` là đi XA hơn chữ của R6.** R6 chỉ nói «`apTuDong` không bao giờ trả
  `da-duyet`», nhưng giữ `VAI_TU_DUYET` bên trục CÂY thì vẫn còn một cửa tự duyệt, trái tiêu đề
  «**BỎ quyền tự duyệt**» và trái Q3. Việc này **đảo quyết định TC-APR-03/04** cũ. Lý do ghi ở
  `approvals/rules.js:14-24`. **Đường gỡ tắc vẫn còn**: ghi đè `create = ✓` **VẪN** trả `Đã duyệt` —
  đó là admin chủ động đặt luật cho một VAI ở Bảng phân quyền, không phải một vai tự duyệt việc của mình.
- **(b) Q3 + `coSuaDuocKhiChoDuyet` ⇒ một dòng `Chờ duyệt` chỉ người tạo, `admin` hoặc Phó Giám đốc
  sửa/xoá được.** Trước đây cấp 3 tự `Đã duyệt` nên không ai gặp; nay cấp 3 cũng `Chờ duyệt` nên TP/PP
  sẽ thấy dòng mình vừa thêm **không sửa được nữa** cho tới khi có người duyệt. Đó là hệ quả đúng của Q3,
  không phải lỗi.
- **(c) KHÔNG tồn tại «tỷ lệ công việc cha»**: bảng `works` **không có cột `ty_le`**. Câu «tỷ lệ công
  việc cha → tất cả BLĐKS cấp 1» trong phần gộp R4+R4'+R4'' chỉ áp cho **đầu mục** (cấp 2, hoặc cấp 3
  không cha — `laDauMuc` trong `workItems/tyLe.js`).
- **(d) `tra-ve-cbo` NAY BẮT BUỘC lý do ≥ 10 ký tự.** Trước đây nhánh `yeu-cau-sua` mới bắt, nhánh
  `tra-ve-cbo` thì không; gộp lại là bắt cả hai. Trang đang mở từ trước khi tải bản mới mà bấm nút cũ
  sẽ nhận **400** — Ctrl+F5 là hết.
- **(e) `decideTyLe` có CHỐT CHỐNG CŨ**: nếu giá trị tỷ lệ hiện tại đã khác giá trị lúc lập đề nghị thì
  ném `conflict('Tỷ lệ hiện tại đã thay đổi — hãy từ chối và lập đề nghị mới')` (**409**). Đề nghị treo
  lâu rồi mới ký là có thể gặp; đó là chủ ý, không phải hỏng.
- **(f) `duocSuaTyLe` CỐ Ý không bị chặn bởi `cayDaDuyet`.** Sửa tỷ lệ lúc nào cũng **lập đề nghị**
  chứ không đổi thẳng, nên cổng thật nằm ở người ký, không nằm ở trạng thái cây. Chặn thêm ở đây là làm
  mất luôn khả năng xin sửa tỷ lệ của cây đang `Chờ duyệt`.

**SỰ CỐ PRETTIER NGÀY 11/09/2026 — ĐỌC TRƯỚC KHI CHẠM VÀO `web/`.** Trong đợt này `npx prettier
--write` đã bị chạy nhầm lên **`web/assets/js/app.js` và `web/index.html`**, xoá sạch format gốc
(app.js phình 10392 → 12484 dòng, `git diff --stat` cho `web/` lên 12484/4355). **`web/assets/*` và
`web/index.html` CỐ Ý KHÔNG nằm trong phạm vi prettier** — `server/package.json` chỉ format
`"src/**/*.js"` và `"tests/**/*.js"`; `server/.prettierrc.json` **không với tới** `web/`
(`prettier --find-config-path ../web/assets/js/app.js` báo *Can not find configure file*) nên prettier
dùng **mặc định thuần** (printWidth 80). HEAD của `app.js` **không phải** output prettier ở bất kỳ độ
rộng nào (dòng dài nhất 9523, p99 283), và `getPreferredQuote` của prettier **có mất mát** — nó đảo
`"…\"px-3\"…"` thành `'…"px-3"…'` — nên một lần reformat **KHÔNG đảo ngược được bằng máy**.
**Cách đã cứu (áp dụng lại được):** `~/.claude/file-history/<sessionId>/<hash>@vN` là kho rewind của
Claude Code, chứa **ảnh byte THẬT** của file qua mỗi lần Edit/Write (`d823ce53bea21388` = `app.js`,
`590ee35bcefeae38` = `index.html`); **lệnh Bash ghi file KHÔNG tạo ảnh chụp**. Lấy ảnh `@vN` ngay trước
lệnh gây hỏng làm nền, phát lại các sửa sau mốc đó theo đúng thứ tự thời gian trích từ
`~/.claude/projects/<…>/<sessionId>.jsonl`, rồi **kiểm chứng bằng ORACLE**: `prettier --no-config
--print-width 80` trên bản dựng lại phải **trùng TỪNG BYTE** với bản đã hỏng — prettier là hàm tất định
của (AST, options) và giữ chú thích, nên trùng nhau là chứng minh nội dung giống hệt. Kết quả:
21 sửa áp dụng, **0 thất bại**, `git diff --stat` của `web/` về **2421 dòng** cho `app.js` và **115
dòng** cho `index.html`. **Đừng lặp lại**: chỉ `prettier --write` file dưới `server/src` và `server/tests`.

**CHƯA NGHIỆM THU — CHƯA COMMIT/PUSH/DEPLOY.** Người dùng test PC **mục 9b.23 (ĐỢT B)** — **nay đã có
thêm MỤC J (bước 36→45) của bản sửa Q6/Q11, ĐỌC MỤC J TRƯỚC KHI BẤM LẠI** — và giữ xanh
**9b.15 → 9b.22**. Chỉ khi nghe **OK RIÊNG ĐỢT NÀY** mới commit explicit paths, push `vps/sua-loi-vat`,
deploy theo `deploy/runbook.md` (**sao lưu trước**; VPS đang ở `pgmigrations=021` ⇒ cần **022 → 029**).
**Lưu ý khi commit — các file UNTRACKED (`??`) phải `git add` đích danh, vẫn KHÔNG `git add .`:**
migration `022`–`029`; `server/src/modules/approvals/{changes,tyLe}.js`;
`server/src/modules/systemSettings/`; `server/src/modules/taskFiles/weights.js`;
`server/src/modules/workItems/{canTyLe,childWeights}.js`; `server/tests/helpers/{results,uiPermissions}.js`;
`server/tests/integration/{migration-replay,phase8b-permissions,phase8b-review,phase8c-files,phase8c-gui-bld,phase8d-dot-b,result-completion}.test.js`;
`server/tests/unit/{file-progress,nhan-kem-vai,phase8b-permissions-ui,phase8b-review-ui,phase8c-ui,result-completion-ui,tasks-results-design}.test.js`;
`web/assets/js/phase8b-review.js`; `docs/BAO-CAO-V1-V8.md`. **OK ngày 2026-09-08 của bản bỏ vai cũ,
OK của đợt 3/4/5, và OK của ĐỢT A đều KHÔNG áp dụng cho đợt này.**

## Snapshot trước đợt B — ĐỢT A: «Ban lãnh đạo kiểm soát» BA CẤP thành MẢNG + gửi đúng người (11/09/2026)

**CÓ MIGRATION MỚI `028_supervisor_ids.sql` và CÓ đổi mã máy chủ** ⇒ test PC **BẮT BUỘC chạy lại
`chay-test.bat /giu /f`** (script tự `npm run migrate:up` rồi mới bật Node). **Ctrl+F5 là KHÔNG ĐỦ.**
**Full test 1987/1987 · 111 file · exit 0**; `lint` exit 0; `format:check` còn đúng 2 nợ cũ
(`workItems/tyLe.js`, `stats-parity.test.js`) — đã `prettier --write` **chỉ 11 file** thuộc phạm vi rồi
**chạy lại full suite lần hai**, vẫn 1987/1987; `node --check` sạch ba file JS; `tools/dem-xss.mjs` đo
**100/964**; `local-assets-check --live` **exit 0**; buster + banner **`20260911-02`**; pin XSS
**99 → 100 sink / 961 → 964 nội suy**, **KHÔNG** CAN-THOAT mới.

**ĐÂY LÀ ĐỢT ĐẦU TIÊN TRONG LOẠT SOÁT LẠI LOGIC PHÊ DUYỆT.** Bảng 22 quyết định (Q1–Q13 + R1–R7 +
R3/R4'/R4'') ở **mục «VIỆC KẾ TIẾP NGƯỜI DÙNG ĐÃ GIAO»** bên dưới vẫn là **nguồn sự thật**; đợt này chỉ
làm phần **ĐỢT A** = **D2 + D3 + R1(a) + R2 + R7 + Q12**. **ĐỢT B** (Q1–Q4, R4/R4'/R4'', R5, R6, thay
`trinh-lanh-dao` bằng «TP/PP phê duyệt», gộp `yeu-cau-sua` vào `tra-ve-cbo`, siết `dungNguoiDuyetFile`)
**ĐÃ LÀM XONG NGAY SAU ĐÓ** — đọc khối **«Ưu tiên hiện tại — ĐỢT B»** ở đầu file. Thiết kế đầy đủ +
**sáu bẫy** ở `docs/KE-HOACH-DUYET-CAY.md` **mục 10**; test tay ở
`docs/HUONG-DAN-TEST-GIAO-DIEN.md` **mục 9b.22 (28 bước)**.

**R1(a) LÀ THAY ĐỔI HÀNH VI LỚN NHẤT — PHẢI NÓI VỚI NGƯỜI DÙNG TRƯỚC KHI HỌ TEST.** admin **MẤT** quyền
duyệt mọi cây: chỉ người **có tên trong `supervisor_ids`** của mục đó mới duyệt được, **không chừa admin
làm dự phòng** (403 `NOT_APPROVER`). **Đường gỡ tắc đã chốt và đã có test khoá**: admin vẫn **SỬA** được
`supervisor_ids` (quyền `update`, **không phải** `approve`) để thay người, rồi người mới duyệt — admin
**không tự duyệt thay**. **Hệ quả có chủ ý** (TC-APR-22 đã đảo 200→403): ghi đè `task:approve = cho-phep`
cho TP/PP **vẫn không cho duyệt**, vì ghi đè cấp **HÀNH ĐỘNG** còn `supervisor_ids` là **PHẠM VI** ⇒
TP/PP **không bao giờ** duyệt được cây. **Danh sách RỖNG thì KHÔNG bắt cổng** — van an toàn **một chiều**
cho dòng cũ đang `Chờ duyệt` mà bước 6 của migration không điền được ai; `submit` mới là chỗ làm cho dòng
rỗng **không sinh ra được nữa** (`NO_APPROVER_ASSIGNED`, 409).

**MỘT NGOẠI LỆ CÓ CHỦ Ý, ĐỪNG «SỬA» LẠI.** `decideGuiBld` (đề nghị đổi tích «Gửi BLĐ phê duyệt»,
`change_kind='gui-bld'`) là **trục KHÁC** với duyệt cây, luật riêng từ 023 là «admin **hoặc** đúng PGĐ
đang kiểm soát, và **không phải** người đề nghị», và `proposeGuiBld` **chủ động** báo tới **MỌI admin**
khi chính supervisor tự đề nghị cho mình. Nếu để `NOT_APPROVER` gạt admin ở đây thì đề nghị đó **không ai
xử lý được**. Nên `approvals/changes.js` có helper **`coTheQuyet(user,row)`** chấp admin **chỉ khi** lý do
từ chối đúng là `NOT_APPROVER`. TC-V7-10 + TC-V7-15 canh chỗ này. **Bài học tổng quát ở §13.5 bẫy (5):
trước khi siết một hàm quyền dùng chung (`can()`), `grep` MỌI nơi gọi nó và hỏi từng nơi «chỗ này hỏi câu
gì»** — nhiều chỗ mượn `can()` làm **điều kiện phụ** chứ không phải **quyết định cuối**.

**BỐN ĐIỂM KỸ THUẬT DỄ LÀM SAI KHI SỬA TIẾP:**
1. **`sqlSupervisorHieuLuc(alias)`** (xuất từ `workItems/repo.js`) là công thức **DUY NHẤT** của
   «MỘT người quyết định kết quả của dòng này» = `COALESCE(supervisor_ids[1], parent.supervisor_ids[1])`.
   Nó được dùng ở **bốn nơi**: `findById` · `findByRefWithWork` · `taskFiles/repo.js` (hàng chờ PGĐ) ·
   `approvals/changes.js` (`pendingGuiBld`). **Bốn nơi phải khớp nhau** — lệch là tích bật mà file chạy
   tới một người, còn hàng chờ của người khác thì không thấy gì. Đợt này diệt chỗ chép tay thứ 4; đừng
   chép lại thành năm.
2. **`nguonBanKiemSoat({level,parentRow,workRow})` trả `Set|null`**, và **tập nguồn RỖNG ⇒ `null`**
   (không giới hạn) **chứ không phải tập rỗng**: cha chưa kịp phân công mà bắt con chọn trong «không ai»
   là khoá cứng cả cây, không ai gỡ được. Hàm là **hàm thuần** (không đọc CSDL, không `async`) — khác
   `validTaskLeaders` của `leader_ids` ở đúng chỗ đó, và eslint `require-await` đòi như vậy.
3. **Form nhiệm vụ có HAI ô cùng `name="supervisorIds"`** (select `#task-supervisor-select` cho cấp 3 +
   nhóm checkbox `#task-supervisors-box` cho cấp 2). Chỉ **MỘT** ô được gửi: ô không dùng phải `disabled`
   (select) hoặc **không có `name`** (hidden input). Cả hai cùng gửi thì `FormData` chỉ giữ **giá trị cuối**
   — của ô người dùng **KHÔNG nhìn thấy**. Đúng cái bẫy cặp `leaderIds` cạnh bên đã xử lý từ 005.
4. **`CREATE OR REPLACE VIEW` chỉ cho THÊM cột Ở CUỐI**, và `ADD COLUMN` nhét cột mới xuống **cuối thứ tự
   vật lý**. Hai điều đó hợp lại làm nổ `countable-views.test.js` — ca giả lập «view thời 019» bằng
   **danh sách tên cột cần loại** nay có bốn cột nằm **giữa** danh sách ⇒ `cannot change name of view
   column "supervisor_ids" to "ty_le"`. Đã sửa bằng cách **cắt tiền tố** tại cột đầu tiên sinh ra sau mốc.
   **Migration nào vừa thêm vừa bớt cột: viết UP xong phải đọc lại DOWN và ngược lại** — 028 đã viết đúng
   thứ tự `DROP VIEW` ở DOWN mà **quên ở UP** và chết ngay lần chạy đầu.

**HÌNH DẠNG PHẢN HỒI RPC KHÔNG ĐỔI** (ràng buộc người dùng đặt ra): `[COL.P_SUP]`/`[COL.T_SUP]` vẫn là
**một chuỗi tên nối dấu phẩy** (đúng cái `tenTrongDanhSach` của `project-details.js` đang đợi),
`supervisorId` **vẫn còn** = phần tử đầu, và **THÊM** `supervisorIds` — thuần tuý bổ sung theo tiền lệ
`leaderIds`. Chiều **gửi lên**: `supervisorIdsFromLegacy` nhận **cả** `supervisorIds` (client mới) **lẫn**
`supervisorId` (trang đang mở từ trước khi tải bản mới); web vẫn `delete data.supervisorId` song song với
khoá mới. Nhận khoá cũ là **CHỐNG MẤT DỮ LIỆU**, không phải chiều client.

**CHƯA NGHIỆM THU — CHƯA COMMIT/PUSH/DEPLOY.** Người dùng test PC **mục 9b.22 (28 bước A–I)** và giữ xanh
**9b.15 → 9b.21** (các bước **8→12 của 9b.15** đã bị 9b.22 thay: form nhiệm vụ nay có ô Ban lãnh đạo ở
**cả ba cấp**, nhãn đổi thành «Ban lãnh đạo kiểm soát», cấp 3 **được** chọn người riêng). Chỉ khi nghe
**OK RIÊNG ĐỢT NÀY** mới commit explicit paths, push `vps/sua-loi-vat`, deploy theo `deploy/runbook.md`
(**sao lưu trước**; VPS đang ở `pgmigrations=021` ⇒ cần **022 → 028**; **ĐỢT B nâng thành `022 → 029`**).
**Lưu ý khi commit: migration
022–028, `approvals/changes.js`, `systemSettings/`, `taskFiles/weights.js`, `workItems/childWeights.js` và
nhiều file test đang ở trạng thái UNTRACKED (`??`)** — `git add` phải liệt kê đủ đường dẫn, vẫn **KHÔNG
`git add .`**. **OK ngày 2026-09-08 của bản bỏ vai cũ KHÔNG áp dụng cho đợt này, và OK của đợt 3/4/5 cũng
không.**

## Snapshot trước đợt A — ĐỢT 5: «Kết quả làm được» về cột Nhiệm vụ, «Ghi ý kiến» thành popup, căn giữa (11/09/2026)

**CHỈ CÓ GIAO DIỆN** (`app.js`, `app.css`, `index.html`) — **không đổi một dòng mã máy chủ nào**, không migration.
**Full test 1984/1984 · 111 file · exit 0** (+5 test mới `TCKQ-47..51`); `lint` exit 0; `format:check` còn đúng
2 nợ cũ (`workItems/tyLe.js`, `stats-parity.test.js`); buster + banner **`20260911-01`**;
`local-assets-check --live` **exit 0**; pin XSS **98 → 99 sink / 957 → 961 nội suy**, **KHÔNG** CAN-THOAT mới
(`TC-SEC-10..14` vẫn xanh, đúng 19 chỗ cũ).

**SỬA MỘT LỖI ĐẶT TÊN CỦA ĐỢT 4.** Đợt 4 khai `tenDayDu = file.ten_ket_qua || file.ten_goc` rồi nhét vào cột có
tiêu đề **«Tên file»** — mà `ten_ket_qua` là **TÊN KHAI** người dùng điền ở ô ＋ (migration 016), **không phải**
tên file vật lý (`ten_ban_cuoi`). Người dùng báo đúng chỗ đó: *«hiện tên Kết quả làm được ở cùng cột với tên
file»*. Nay tách đôi: **`tenKetQua` VỀ CỘT NHIỆM VỤ**, nằm **ngay cạnh icon `fa-file-lines`** trong cùng khung
`.task-file-lui`; **`tenFileThat` (= `ten_ban_cuoi`) ở CỘT «Tên file»**, chưa nộp bản nào thì ghi «Chưa có bản».
**Màu chữ theo TIẾN ĐỘ đi theo «Kết quả làm được»** (bốn bậc của đợt 4 giữ nguyên), cột «Tên file» chữ xám đen
trung tính — tô cả hai chỗ là rối mắt.

**Ô «GHI Ý KIẾN» THÀNH CHỮ MỞ POPUP** — `moYKienKetQua(maNhiemVu, fileId, banId)` mới, dựng theo khuôn
`moNhatKyFileKetQua` của đợt 3. Dòng cha (1., 2., 3.) truyền `banId` **RỖNG** ⇒ popup in **TẤT CẢ** ý kiến
(*«còn bản đầu 1. đấy sẽ xem tất cả»*). Dòng bản 1.1/1.2 truyền `b.id` ⇒ popup in **ĐÚNG ý kiến của bản đó**
(*«popup xem ý kiến của bản đấy»*) và **CHỈ ĐỌC** — máy chủ chỉ cho ghi góp ý vào **BẢN MỚI NHẤT**
(`guiYKien` POST theo `data-ban-cuoi`), để ô nhập trong popup của bản cũ là mời người dùng viết vào một chỗ
rồi chữ chạy sang bản khác. **Ô nhập + nút «Gửi ý kiến» dời THEO popup của dòng cha**: tách
`buildONhapYKien(n, ma)` ra khỏi `buildYKienPanel` để popup lắp đúng phần ô nhập; nút nay gọi
`guiYKienTuPopup` — **gửi thành công thì ĐÓNG popup**, **ô còn chữ (thất bại) thì GIỮ** để không mất chữ vừa gõ
(`guiYKien` không trả trạng thái, nhưng nó xoá ô nhập khi thành công ⇒ lấy đúng dấu hiệu đó). **Khung «Lịch sử»
giữ nguyên**; khung `task-kq-yk-*` bị bỏ nên `batTatKetQua(id,'yk')` nay là phép không làm gì (đã ghi chú).

**CĂN GIỮA**: tiêu đề **MỌI** cột của bảng «Kết quả» (kể cả «Hành động» — đợt 4 còn `text-right`);
**«Người thực hiện»** ở cả dòng cha lẫn dòng bản; hai ô tỷ lệ/tiến độ của dòng bản; và **bảng luồng trong khung
«Lịch sử»** cho nhất quán cùng trang. Class Tailwind `text-center` có thật trong bản vendor nhưng **vẫn ép thêm
trong `app.css`** (`.bang-ket-qua thead th`, `.kq-o-nguoi`) — đúng bẫy đợt 4 về bản biên dịch sẵn.

**MỘT THAY ĐỔI HÀNH VI PHẢI BIẾT TRƯỚC KHI TEST** (9b.21 bước 20): `xuLyVerdictFile` vẫn đọc
`#task-y-kien-<id>` để lấy lý do verdict, mà ô đó nay chỉ tồn tại **trong popup**. Popup **đang mở** ⇒ verdict tự
đọc như cũ; popup **đang đóng** ⇒ rơi xuống nhánh `prompt` hỏi lý do. Đây là **hành vi dự phòng có sẵn từ
trước**, không phải lỗi mới — nhưng phải nói để người dùng khỏi tưởng hỏng.

**BẢY BẪY ở §13.5** (mục «Bổ sung 11/09/2026 (đợt 5 …)»), đáng nhớ nhất: **flex item mặc định
`min-width:auto` nên `text-overflow:ellipsis` KHÔNG BAO GIỜ CHẠY** — phải pin
`.task-file-lui .task-file-name { min-width: 0 }` trong CSS **và trong test**, vì thiếu nó thì mọi test khác vẫn
xanh trong khi bảng vỡ trên dữ liệu thật; và **đếm thẻ bằng regex trên chuỗi HTML là đếm sai**
(`/<th[^>]*>/` bắt cả `<thead>`, lại cộng thêm 5 `<th>` của bảng luồng lồng trong khung «Lịch sử») — muốn đếm
thì đưa vào DOM rồi `querySelectorAll('.bang-ket-qua > thead > tr > th')`, muốn soi nội dung một ô thì
**giới hạn phạm vi bằng selector**, đừng soi cả chuỗi.

**Test PC theo mục 9b.21 (22 bước A–E).** **KHÔNG cần khởi động lại Node** — đợt này chỉ có giao diện, tài sản
đọc từ đĩa; chỉ cần **Ctrl+F5** lấy buster `20260911-01`. Giữ xanh lại **9b.15 → 9b.20**, trừ **bước 7/8/11/12
của 9b.20** và **các bước 22 → 26** đã bị 9b.21 thay — mâu thuẫn thì làm theo 9b.21.
**Cả sáu mục trước VẪN CHƯA có OK riêng. KHÔNG commit/push/deploy khi chưa nghe OK RIÊNG ĐỢT NÀY.**

**CHẠY `npx vitest` TỪ `server/`, KHÔNG từ thư mục gốc.** Còn **ba worktree cũ của subagent** nằm ở
`.claude/worktrees/agent-*/` (mỗi cái có cả bản sao `server/tests/`); chạy từ gốc là vitest quét cả ba bản sao
đó và báo **4 FAIL giả** cho cùng một file. Ba worktree này **không đụng tới** — xoá chúng là thao tác git phá
hoại, phải hỏi người dùng trước.

## Snapshot trước đợt 5 — ĐỢT 4: mũi tên ▼/▲, cột «Tên file» riêng, màu theo tiến độ, gộp ý kiến (10/09/2026)

**CHỈ CÓ GIAO DIỆN** (`app.js`, `app.css`, `index.html`) — **không đổi một dòng mã máy chủ nào**, không migration.
**Full test 1979/1979 · 111 file · exit 0**; `lint` exit 0; `format:check` còn đúng 2 nợ cũ (`workItems/tyLe.js`,
`stats-parity.test.js`); buster + banner **`20260910-12`**; `local-assets-check --live` **exit 0**;
pin XSS **98 sink / 957 nội suy** (sink không đổi, **không** CAN-THOAT mới).

Bảng nhiệm vụ **10 → 11 cột**: thêm cột RIÊNG **«Tên file»**; ô đầu của hàng file chỉ còn **dấu nối └ + icon**
thụt vào nên hàng file **LÙI VỀ PHẢI** so với tên nhiệm vụ. **Dấu tích → nút mũi tên**: đang hiện file thì **▲**
(bấm để ẨN), đang gập thì **▼** (bấm để MỞ RỘNG) — mũi tên chỉ **hành động kế tiếp**; vẫn là `<button
aria-expanded>`, **không phải checkbox** (`TC-KQ-UI-03`). **«Người thực hiện» CĂN GIỮA** ở cả hai loại hàng.
**Tên nhiệm vụ 15px, tên file 13px** — đúng «to hơn 02 cỡ chữ»; KHÔNG phóng `.task-ten-chinh` vì class đó còn
dùng cho ô người thực hiện. **Màu chữ tên file theo TIẾN ĐỘ**: ≥100 xanh lá · 50–99 xanh dương · 20–49 cam ·
<20 đỏ (hai mốc 100% và «dưới 20%» do người dùng nêu, hai bậc giữa tự chia và đã nói rõ ở 9b.20 bước 11).
**Bốn thẻ thống kê** (Tổng số · Đã duyệt đủ · Chưa duyệt đủ · Quá hạn) **về MỘT DÒNG**: `index.html` để
`grid-cols-2 md:grid-cols-4` nên **dưới 768px là 2 dòng**; nay thêm `id="tasks-the-tong-ke"` và ép
`repeat(4, minmax(0,1fr))` trong `app.css` — `minmax(0,…)` chứ không phải `1fr` trần.

**Popup nhật ký**: BỎ hai tiêu đề «Ai đăng ký kết quả này» / «Ai thực hiện», gộp thành bốn dòng đúng dạng người
dùng viết; «Lãnh đạo phòng phụ trách:» **giữ nhãn kể cả khi trống**. **SỬA MỘT LỖI THẬT CỦA ĐỢT 3**: popup đọc
`nhom.ban` trong khi `taskFiles/service.js doc()` trả **`bans`** ⇒ chip «Số bản» luôn 0 và khối 3 luôn báo «Chưa
có bản nào được tải lên»; `TC-TASK-DESIGN-08` **mock theo cùng cái tên sai** nên xanh trong khi tính năng chết.

**«GHI Ý KIẾN» GỘP HAI NGUỒN** — lỗi có từ Vòng 14: `verdict()` chỉ gọi `repo.themLuong` (`task_file_flow`),
**KHÔNG** gọi `repo.themGopY` (`task_file_comments`), nên lý do người duyệt gõ khi «Yêu cầu sửa» / «Trả về» /
«Từ chối» **không bao giờ** hiện ở cột «Ghi ý kiến» — chỉ nằm trong bảng «Lịch sử» phải bấm mới ra. Nay
`danhSachYKien()` gộp `gopY` với mọi dòng luồng có `noi_dung`, **TRỪ `gom-y`** (hành động đó ghi CẢ HAI bảng,
lấy cả là in một câu hai lần), sắp CŨ → MỚI, mỗi ý kiến mang **nhãn hành động**. Dùng chung ở BỐN nơi: cột
«Ghi ý kiến» của dòng cha (**nay HIỆN NGAY nội dung**), `buildYKienPanel`, dòng bản 1.1/1.2, khối 3 của popup.
**Đây là sửa HIỂN THỊ, không sửa chỗ ghi** — lý do verdict đã lưu bền trong `task_file_flow`; ghi thêm vào
`task_file_comments` chỉ nhân đôi dữ liệu và làm lệch mọi phép đếm góp ý. Nút «Xem ý kiến (N)» vẫn còn
(TCKQ-03b) nhưng **N nay đếm theo danh sách gộp** nên có thể lớn hơn trước — đúng, không phải đếm sai.

**Bảng «Kết quả» trong modal cân đối lại**: thêm `<colgroup>` (`COT_BANG_KET_QUA`) + `table-layout:fixed`.
Trước đó bảng không có colgroup nên trình duyệt chia theo NỘI DUNG — hai cột chỉ chứa MỘT CON SỐ phình ra bằng
cột chữ chỉ vì TIÊU ĐỀ dài. Nay thời gian 9 · định dạng 6 · file 13 · **tỷ lệ 8** · **tiến độ 6** · người 8 ·
ý kiến 14 · tình trạng 11 · hành động 6 (tổng 81%) ⇒ cột tên (auto) còn 19%. Tiêu đề dài **xuống dòng trong ô**;
ô tỷ lệ **xếp dọc** input + nút «Lưu tỷ lệ». Vẫn **MƯỜI** cột nên mọi `colspan="10"` giữ nguyên.

**Test PC theo mục 9b.20 (28 bước A–G).** **KHÔNG cần khởi động lại Node** nếu đã khởi động lại theo 9b.19 —
đợt này chỉ có giao diện, tài sản đọc từ đĩa; chỉ cần **Ctrl+F5** lấy buster `20260910-12`. Nếu **chưa** khởi
động lại từ đợt 3 thì vẫn phải đóng cửa sổ «QLCV TEST - Node» rồi chạy `chay-test.bat /giu /f`.
Giữ xanh lại **9b.15 → 9b.19**; ba điểm của 9b.19 đã bị 9b.20 thay (10→11 cột, dấu tích→mũi tên, khối 1/2
của popup) — mâu thuẫn thì làm theo 9b.20. **Cả năm mục đều CHƯA có OK riêng. KHÔNG commit/push/deploy khi
chưa nghe OK RIÊNG ĐỢT NÀY.**

## VIỆC KẾ TIẾP NGƯỜI DÙNG ĐÃ GIAO — SOÁT LẠI LOGIC PHÊ DUYỆT: ĐÃ HỎI, ĐÃ CHỐT (11/09/2026)

> **TRẠNG THÁI 11/09/2026: ĐỢT A ĐÃ XONG MÃ TRÊN PC — CHƯA NGHIỆM THU, CHƯA COMMIT.** Full suite
> **1987/1987 · 111 file · exit 0**, migration `028` chạy sạch, buster `20260911-02`, pin XSS **100/964**.
> Chi tiết ở **mục «Ưu tiên hiện tại — ĐỢT A»** trên cùng, thiết kế + sáu bẫy ở
> `docs/KE-HOACH-DUYET-CAY.md` **mục 10**, test tay ở `docs/HUONG-DAN-TEST-GIAO-DIEN.md` **mục 9b.22**.
> **Bảng quyết định bên dưới GIỮ NGUYÊN GIÁ TRỊ** — nó là nguồn sự thật cho **cả ĐỢT B**, đừng sửa.
> Hai chỗ của bảng nay đã thành mã thật và cần đọc kèm chú thích: **R1(a)** có **một ngoại lệ có chủ ý**
> (trục `gui-bld`, xem mục trên cùng), và **«Hệ quả của R1(a)»** bên dưới đã xảy ra đúng như dự đoán —
> đường gỡ tắc (admin **sửa** `supervisor_ids` chứ không duyệt thay) **đã có test khoá** trong
> `approvals-api.test.js`.

Người dùng (10/09/2026, sau đợt 4): «Xem lại logic phê duyệt file kết quả, tìm hiểu hết về nó, tôi đang thấy
có cái bất hợp lý đấy / xem cái ko logic đề xuất tôi để sửa», rồi mô tả **logic đúng** muốn có:

- TP/PP đăng ký **công việc cha → công việc con → nhiệm vụ → file kết quả trong nhiệm vụ**.
- Cha đang **Lưu tạm** thì sửa thoải mái. **«Gửi đi phê duyệt» công việc cha là duyệt TRỌN GÓI** cả con,
  nhiệm vụ và file kết quả bên trong — **không gửi phê duyệt file lẻ**.
- Người duyệt công việc cha **có thể sửa lại cả file kết quả**.
- **Gửi công việc cha lần đầu thì KHÔNG được up file kết quả lên.**
- Nhiệm vụ do **lãnh đạo phòng tự làm** ⇒ file kết quả **bắt buộc lên Giám đốc / Phó Giám đốc** (theo lựa chọn
  phê duyệt của công việc).
- Nhiệm vụ do **cán bộ làm** ⇒ tuỳ tích **«Gửi BLĐ phê duyệt»** lúc tạo: cán bộ → **TP/PP phụ trách** phê duyệt
  (được sửa, được trả lại) → TP/PP duyệt xong thì **lên Phó Giám đốc** → PGĐ sửa thì **đẩy lại TP/PP**, và
  TP/PP lúc đó chọn **tự sửa rồi gửi lại phê duyệt** hoặc **đẩy về cán bộ** để cán bộ sửa rồi lặp lại quy trình.
- **Đồng bộ «Ban lãnh đạo kiểm soát» ở CẢ BA CẤP**: cha chọn **NHIỀU** người; con chọn **nhiều nhưng chỉ trong
  tập đã chọn ở cha**; nhiệm vụ chọn **ĐÚNG MỘT trong tập của con**.
- Gửi phê duyệt **FILE** (kèm **tỷ lệ công việc của file**) ở cấp nhiệm vụ ⇒ **chỉ gửi MỘT người** đã chọn của
  nhiệm vụ đó. Sửa **công việc con / công việc cha** (kèm **tỷ lệ của con và của nhiệm vụ**) ⇒ gửi **TẤT CẢ**
  người đã chọn ở cấp tương ứng.

**ĐÃ ĐỌC HẾT luồng và BÁO CÁO 13 điểm bất hợp lý** (10/09/2026). GỐC RỄ: **hai trục duyệt độc lập, hoàn toàn
không biết nhau** — `grep approval_status` trong `server/src/modules/taskFiles/` ra **0 kết quả**, và
`grep task_files` trong `server/src/modules/approvals/` cũng ra **0 kết quả**. Người dùng đã trả lời **13 câu
Q1–Q13** rồi **6 câu R1–R7**. Dưới đây là **BẢN CHỐT** — mọi thiết kế và mọi dòng mã phải bám bảng này.

### Bảng quyết định đã chốt

| # | Quyết định |
|---|---|
| Q1 | Lần gửi ĐẦU chỉ có **KHAI BÁO** (tên kết quả · định dạng · tỷ lệ) đi theo cây. **File thật** đi chuỗi riêng **SAU KHI** cây `Đã duyệt` |
| Q2 | **CẤM HẲN nút tải file** khi cây chưa duyệt — chỉ cho khai báo |
| Q3 | `Nháp` = sửa thoải mái **MỌI thứ** (thêm/xóa nhiệm vụ, đổi người thực hiện, đổi tỷ lệ). **Nháp là nháp TẤT CẢ** — cấp 3 không còn sinh ra `Đã duyệt` riêng lẻ |
| Q4 | Người duyệt cây chỉ sửa **KHAI BÁO**. OnlyOffice chỉ ở chuỗi sau khi đã có bản tải lên |
| Q5 | TP/PP tự làm ⇒ lên **THẲNG** BLĐKS của nhiệm vụ, bỏ qua bước TP/PP duyệt (**giữ nguyên** `canTraLanhDao` hiện nay) |
| Q6 | Cấp nhiệm vụ có ô chọn **ĐÚNG 1** BLĐKS, lấy trong tập BLĐKS của **công việc con**. Tích BẬT → cán bộ → TP/PP → PGĐ. Tích TẮT → **TP/PP được chốt luôn** (`hoan-thanh`) |
| Q7 | **MỘT người duyệt là đủ** ở MỌI cấp, kể cả khi thông báo gửi cho tất cả |
| Q8 | **KHÔNG thêm vai mới.** `admin` = Giám đốc. CHECK `users_role_valid` giữ đúng 5 vai |
| Q9 | Sửa cây ĐÃ duyệt: **GIỮ NGUYÊN** cơ chế ghi đè `update = ⏳` của admin (`phaiChoDuyetKhiSua`), không bắt buộc luôn luôn |
| Q10 | Sửa **tỷ lệ** CÓ phải gửi duyệt |
| Q11 | **GIỮ** `hoan-thanh` cho nhiệm vụ **không** bật tích |
| Q12 | Nhiệm vụ cấp 3 chưa có BLĐKS riêng ⇒ lấy **người đầu tiên của cấp 2** |
| Q13 | **TÁCH 2 ĐỢT.** A = D2+D3 (BLĐKS 3 cấp + gửi đúng người). B = D1+D4+D5 (gộp trục, bỏ tự duyệt, gộp verdict) |
| R1 | **(a) BÓ CHẶT** — chỉ người TRONG `supervisor_ids` mới duyệt được, **KHÔNG chừa admin làm dự phòng**; và **BẮT BUỘC phải chọn `supervisor_ids` thì mới được gửi đi duyệt** |
| R2 | Migration **TỰ ĐỘNG ĐIỀN** từ dữ liệu đang có, không để trống |
| R4 | **Tỷ lệ của FILE đi theo PHIẾU DUYỆT CÂY** (không theo phiếu duyệt file) — ngược với đề bài gốc, người dùng đã chốt lại |
| R5 | Nhiệm vụ thêm SAU vào cây đã duyệt ⇒ **`Chờ duyệt` MỘT MÌNH NÓ**, duyệt riêng |
| R6 | **BỎ quyền tự duyệt** của admin: `apTuDong` không bao giờ trả `da-duyet`. `file:create = ✓` chỉ còn nghĩa «được phép khai/nộp» |
| R7 | **THÊM thông báo** khi sửa cây bị hạ về `Chờ duyệt` — gửi tới `supervisor_ids` cấp tương ứng |

### Hai đề xuất của Claude BỊ GẠT

- **D4 phần «bỏ hẳn `hoan-thanh`»** — Q11 giữ lại cho nhiệm vụ không bật tích.
- **D6 phần «luôn luôn duyệt lại khi sửa cây»** — Q9 giữ cơ chế ghi đè `update = ⏳`.

### Ba câu hỏi nốt — ĐÃ TRẢ LỜI 11/09/2026

| # | Quyết định |
|---|---|
| R3 | **LÀM ĐỢT A NGAY, SONG SONG** — migration 028 chồng lên 022–027 chưa commit; buổi test PC sẽ gộp 9b.15 → 9b.20 + đợt A. Chấp nhận khó khoanh vùng lỗi hơn để đổi lấy tốc độ |
| R4' | Sửa **tỷ lệ của FILE** ⇒ gửi **ĐÚNG 1 BLĐKS của NHIỆM VỤ (cấp 3)** chứa file đó — khớp đề bài gốc, không phải cấp 2 hay cấp 1 |
| R4'' | Cơ chế: **`approval_changes`** — ghi một dòng đề nghị, **giá trị tỷ lệ CŨ vẫn giữ nguyên cho tới khi được duyệt**, đúng khuôn `proposeGuiBld` đang áp cho cái tích. **KHÔNG hạ cây về `Chờ duyệt`** nên `v_countable_items` không mất số |

⇒ Gộp R4 + R4' + R4'': **mọi sửa tỷ lệ (file · nhiệm vụ · công việc con · công việc cha) đều đi qua
`approval_changes`**, khác nhau ở **người nhận**: tỷ lệ **file** và tỷ lệ **nhiệm vụ** → 1 BLĐKS cấp 3; tỷ lệ
**công việc con** → tất cả BLĐKS cấp 2; tỷ lệ **công việc cha** → tất cả BLĐKS cấp 1. Theo Q7 thì **một người
đồng ý là đủ**.

### PHẠM VI HAI ĐỢT (đã tách theo Q13 + R3)

**ĐỢT A — «BLĐKS 3 cấp + gửi đúng người»** (D2 + D3) — ✅ **ĐÃ XONG MÃ 11/09/2026, CHƯA NGHIỆM THU**:
`supervisor_id` → **`supervisor_ids bigint[]`** ở `works` và `work_items`; cấp 2 ⊆ cấp 1, cấp 3 **đúng 1** ⊆ cấp 2
(nhân bản khuôn `validTaskLeaders` / `assertTaskLeader` / CHECK `task_leader_single`); migration **028** tự điền
theo 6 bước ở trên; `submit` **bắt buộc** `supervisor_ids` khác rỗng (R1a); `approve` **chỉ** người trong
`supervisor_ids` (R1a, bỏ `admin` khỏi `VAI_TU_DUYET` cho việc duyệt cây); người nhận thông báo duyệt cây =
`supervisor_ids` cấp tương ứng thay vì mọi PGĐ của phòng (D3); **thêm thông báo** khi sửa cây bị hạ về
`Chờ duyệt` (R7); viết lại các test `TC-APR-*` giả định admin duyệt được.

> **MỘT CHỖ LÀM KHÁC CÂU CHỮ Ở TRÊN — CÓ LÝ DO, ĐỪNG «SỬA» LẠI.** Câu «bỏ `admin` khỏi `VAI_TU_DUYET`
> cho việc duyệt cây» được ghi lúc **đoán** nơi quyền duyệt của admin nằm. Đọc mã thật thì
> **`VAI_TU_DUYET` (`approvals/rules.js:26`) KHÔNG phải cổng duyệt**: nó chỉ được dùng **đúng một lần** ở
> `rules.js:51` bên trong **`trangThaiDuyetKhiTao`** — quyết định dòng **MỚI TẠO** sinh ra ở `Đã duyệt` hay
> `Chờ duyệt`. Quyền duyệt mọi cây của admin thật ra nằm ở **`PERMISSIONS.admin`** cộng với **`inScope`
> luôn `return true` cho admin**, cả hai được hỏi qua **`can()`**.
> ⇒ Bỏ admin khỏi `VAI_TU_DUYET` **sẽ không** chặn admin duyệt; nó sẽ **tắt tự duyệt lúc tạo** — tức là
> làm hộ **R6**, mà R6 thuộc **ĐỢT B**. Nên ĐỢT A đặt cổng ở **`can()`** (một điều kiện kiểu **phạm vi**,
> đứng **sau** nhánh `create` và **trước** `inScope`), đạt đúng ý R1(a) mà không chạm R6, và mua thêm ba
> thứ: áp **đều** cho mọi vai · **ủy quyền vẫn chạy** · test ma trận 120 phép sinh tự động không phải sửa.
> **`VAI_TU_DUYET` GIỮ NGUYÊN.** Chi tiết ở `docs/KE-HOACH-DUYET-CAY.md` mục 10.2 + 10.4 bẫy (4).

**ĐỢT B — «gộp hai trục»** (D1 + D4 + D5 + D6, làm SAU khi A xanh):
`Nháp` là nháp tất cả, cấp 3 không còn `Đã duyệt` riêng lẻ (Q3); nhiệm vụ thêm sau vào cây đã duyệt =
`Chờ duyệt` một mình (R5); **cấm hẳn nút tải file** khi cây chưa duyệt, chỉ cho khai báo tên · định dạng · tỷ lệ
(Q1 + Q2 + Q4); **bỏ tự duyệt** — `apTuDong` không bao giờ trả `da-duyet` (R6); tỷ lệ qua `approval_changes`
(R4 + R4' + R4''); thay `trinh-lanh-dao` bằng hành động **«TP/PP phê duyệt»** có lưu mốc người duyệt và lúc
duyệt (điểm bất hợp lý số 7); gộp `yeu-cau-sua` vào `tra-ve-cbo` (điểm số 9); siết `dungNguoiDuyetFile` theo
BLĐKS cấp 3 kể cả khi tích TẮT (điểm số 12).
### Hệ quả của R1(a) — PHẢI NHỚ khi code

`admin` hiện duyệt được **MỌI** cây (`VAI_TU_DUYET = ['admin','Phó Giám đốc']`, `approvals/rules.js:24`, và
`assertCan(user,'approve',target)` ở `approvals/service.js:156`). R1(a) **bỏ** quyền đó ⇒ nếu mọi người trong
`supervisor_ids` bị khoá tài khoản hoặc chuyển đi thì cây **TẮC VĨNH VIỄN, không ai gỡ được**. Đường gỡ Claude
sẽ dùng và sẽ nói rõ với người dùng: **admin vẫn SỬA được `supervisor_ids`** (quyền `update`, KHÔNG phải
`approve`) để thay người, rồi người mới duyệt — admin **không tự duyệt thay**. Toàn bộ test `TC-APR-*` đang giả
định «admin duyệt được» sẽ phải viết lại, và `docs/KE-HOACH-DUYET-CAY.md` mục «7 quyết định đã khoá» phải cập
nhật vì quyết định cũ nay bị lật.

### Thứ tự điền của migration 028 (R2 «tự động điền người trong data đang có»)

1. `works.supervisor_ids` ← `ARRAY[supervisor_id]` nếu khác NULL;
2. `work_items` **cấp 2** ← `ARRAY[supervisor_id]` của chính nó; NULL thì lấy của **công việc cha**;
3. `work_items` **cấp 3** ← **phần tử ĐẦU** của `supervisor_ids` cấp 2 chứa nó (đúng Q12); cấp 3 treo thẳng
   cấp 1 (`parent_id IS NULL`) thì lấy của cấp 1;
4. Vẫn còn NULL ⇒ lấy **một Phó Giám đốc (`deputy_director`) đang hoạt động của phòng** từ `department_managers`;
5. Phòng không có PGĐ ⇒ lấy **một tài khoản `admin` đang hoạt động**;
6. Không có ai thật ⇒ để NULL và **in ra danh sách** các cây đó lúc chạy migration — R1(a) sẽ chặn gửi duyệt cho
   tới khi có người vào chọn, nhưng cây **đã `Đã duyệt`** thì không bị ảnh hưởng gì.

### 13 điểm bất hợp lý đã báo cáo (giữ làm bằng chứng, đừng điều tra lại từ đầu)

1. Hai trục không biết nhau (`approval_status` vắng mặt trong `taskFiles/`, `task_files` vắng mặt trong `approvals/`).
2. `trangThaiDuyetKhiTao` cho **cấp 3 luôn `Đã duyệt`** (`rules.js:50`) — thêm nhiệm vụ vào cây đã duyệt là có hiệu lực ngay, không ai ký.
3. Người duyệt **CÂY** là mọi PGĐ của phòng (`approvals/service.js:220`) ≠ người duyệt **FILE** là 1 `supervisor_hieu_luc` (`taskFiles/service.js:678`).
4. `supervisor_id` là **MỘT cột đơn**, không phải mảng; `supervisor_hieu_luc` tính lặp ở **4 nơi**: `workItems/repo.js:113`, `workItems/repo.js:156`, `taskFiles/repo.js:340`, `approvals/changes.js:306`.
5. Cấp 3 hiện **BỊ CẤM** có BLĐKS riêng (`workItems/service.js:358-366` ném lỗi; `assignments/service.js:373` ghi rõ «không thêm ô/người riêng»).
6. **Mặc định là KHÔNG duyệt file**: `apTuDong:344` trả `da-duyet` khi `file:create = ✓` ⇒ R6 chốt bỏ.
7. TP/PP **không có hành động «Phê duyệt»** — `trinh-lanh-dao` chỉ đổi trạng thái, không lưu mốc «TP/PP đã duyệt».
8. `hoan-thanh` là cửa TP/PP tự chốt bỏ qua PGĐ (đã có 2 chốt chặn ở `service.js:794` và `:830`) ⇒ Q11 giữ.
9. `yeu-cau-sua` và `tra-ve-cbo` là **hai nút cho một việc** (cùng `den:'can-sua'`, cùng `datLenhSua(...,'can-bo',...)`; khác đúng `tu` và `canNoiDung`).
10. Sửa cây đã duyệt: mặc định **không** duyệt lại, và khi có bị hạ về `Chờ duyệt` thì **không báo ai** ⇒ R7 chốt thêm thông báo. Kèm hệ quả: cấp 2 bị hạ làm **toàn bộ nhiệm vụ cấp 3 bên dưới biến mất khỏi `v_countable_items`** (migration 026 dòng 26-28).
11. **Tỷ lệ (%) không qua duyệt ở cấp nào**: `suaTyLe:2011` ghi thẳng, không kiểm `approval_status` ⇒ Q10 + R4 chốt phải gửi duyệt.
12. `dungNguoiDuyetFile:687` **chỉ siết PGĐ và chỉ khi bật tích**; tích TẮT thì PGĐ bất kỳ của phòng + admin đều duyệt được dù ô BLĐKS ghi người khác.
13. Hệ thống **không có vai `Giám đốc`** — CHECK `users_role_valid` (migration 021 dòng 26-27) chốt `admin`, `Phó Giám đốc`, `Trưởng phòng`, `Phó phòng`, `Nhân viên`; tài khoản Giám đốc trong seed mang vai `admin` (`dev-vong14.sql:63-65`). Cũng không có vai `Cán bộ` — đó là `Nhân viên` ⇒ Q8 chốt giữ nguyên.

**ĐIỂM THUẬN LỢI:** `leader_ids` **ĐÃ làm đúng y khuôn** thiết kế 3 cấp mà người dùng muốn — cấp 3 chỉ ≤ 1 phần
tử (`workItems/service.js:368`) và phải nằm trong tập của cấp 2 (`validTaskLeaders` / `assertTaskLeader`,
`assignments/service.js:165-199`, kèm CHECK `task_leader_single` trong CSDL). Chỉ cần **nhân bản khuôn đó cho
cột supervisor** là ra đúng thiết kế, không phải phát minh lại.

## Snapshot trước đợt 4 — thiết kế lại tab Nhiệm vụ + popup nhật ký từng file (ĐỢT 3), 10/09/2026

Người dùng báo «tab nhiệm vụ đang không hiển thị nhiệm vụ trực thuộc công việc cha luôn» và yêu cầu thiết kế lại
tab cho đẹp. **GỐC LỖI KHÔNG nằm ở chỗ vẽ**: `tasksXemThang` mặc định là `new Date().getMonth()+1` nên ba nhiệm vụ
`CV002-003/004/006` (cấp 3, `parent_id IS NULL`, hạn 2026-10-01→2026-10-20) bị BỘ LỌC THÁNG loại hẳn, không một câu
giải thích; `xepNhiemVuTheoCongViecCon` vẫn xếp nhóm «Nhiệm vụ trực thuộc công việc» đúng. Đã đổi mặc định về `0`
= «Tất cả tháng», theo tiền lệ `projectsXemThang`. **Bài học: danh sách «không hiện» thì đọc bộ lọc trước, đừng đọc hàm render.**

Bảng nhiệm vụ nay **10 cột**: Nhiệm vụ/Kết quả · Người thực hiện · Ưu tiên · Tỷ lệ (%) · Tiến độ · Bắt đầu · Hạn chót ·
Số bản · Tình trạng kết quả · Thao tác. `<colgroup>` + `table-layout:fixed`, tiêu đề CĂN GIỮA, font đồng nhất 13px,
cột kết quả nhỏ ép hẹp (Ưu tiên 8 · Tỷ lệ 7 · Tiến độ 7 · Bắt đầu 8 · Hạn 8 · Số bản 5 · Tình trạng 13 · Thao tác 9%).
Hàng nhiệm vụ ngăn bằng `border-top:2px solid`, hàng file nền xám + `border-bottom:1px dashed` ⇒ nhìn là tách được
từng nhiệm vụ / từng file. Tên file cùng một mức căn, dài thì `...`, `title` mang tên đầy đủ.
**Dấu tích ẩn/hiện hàng file là `<button class="task-files-toggle" aria-pressed>`, KHÔNG phải checkbox** —
`TC-KQ-UI-03` đã chốt tab này không còn checkbox nào sau đợt «bỏ checkbox Hoàn thành». Trạng thái gập nhớ trong
`localStorage` khoá `qlcv_tasks_files_hidden`, sống qua F5 và re-render; `filterTaskRows` KHÔNG tự mở lại hàng đang gập
(tìm theo tên file vẫn giữ nhiệm vụ + hàng kết quả đi cùng).

Nút «Xem kết quả» mở **popup nhật ký riêng của file** (`moNhatKyFileKetQua`): chip tóm tắt + bốn khối đánh số —
1 ai đăng ký kết quả này, 2 ai thực hiện (trực tiếp + lãnh đạo phòng phụ trách), 3 lịch sử các bản và ý kiến từng lần,
4 diễn biến theo thời gian xếp TĂNG dần. Đọc lại endpoint CÓ SẴN `GET /work-items/:ref/files` ⇒ không mở REST mới.
Dựng hoàn toàn bằng `createElement` + `textContent` ⇒ **sink XSS KHÔNG đổi (98)**, chỉ nội suy 929→952.
Đóng bằng «Đóng» / Escape / bấm nền. Phía máy chủ `tienDoFileRows` + `demNhomFileTheoItem` thêm `so_ban` và
`ten_nguoi_nop` vào `ket_qua_files` (thiếu là TC-KQ-DONE-06 đỏ và hai cột mới không có dữ liệu).

**Full test: 1969/1969 · 111 file · exit 0** (baseline trước khi sửa là 1960/1963 · 109/111 với đúng 3 lỗi thật:
TC-KQ-DONE-06, TC-TASK-DESIGN-01, TC-TASK-DESIGN-02 — hai test sau Codex để đỏ rồi đứt giữa chừng, đã viết lại thành
8 test TC-TASK-DESIGN-01..08 và làm xanh hết). `lint` exit 0; `format:check` còn đúng 2 nợ cũ có chủ đích
(`workItems/tyLe.js`, `stats-parity.test.js`). Không migration mới, không reset/seed, không đụng OnlyOffice/chuông/Zalo/cron.
Buster + banner **20260910-11** đồng bộ bốn thẻ (`app.css`, `app.js`, `project-details.js`, `phase8b-review.js`);
`api-bridge.js` giữ `20260825` vì không đổi. `node ../tools/local-assets-check.mjs --live` **exit 0**.

**⚠ TRƯỚC KHI TEST PC PHẢI KHỞI ĐỘNG LẠI NODE UAT.** Node đang chạy là PID **35656**, bật lúc **17:59:42**, mà
`server/src/modules/taskFiles/repo.js` sửa lúc **21:00:48** ⇒ tiến trình đang giữ bản CŨ trong bộ nhớ, API chưa trả
`so_ban`/`ten_nguoi_nop` nên cột «Số bản» sẽ hiện 0 và hàng file thiếu tên người nộp. **ĐÓNG đúng cửa sổ «QLCV TEST - Node» đang giữ cổng 3000 rồi chạy lại `chay-test.bat /giu /f`**
(giữ nguyên dữ liệu UAT; `/f` chỉ bỏ các lệnh pause, script CỐ Ý không tự diệt tiến trình — xem dòng 227 của
`chay-test.bat`), xong mới mở `http://127.0.0.1:8099`. Chỉ F5 trình duyệt thì được JS/CSS mới (tài sản đọc từ đĩa) nhưng
VẪN thiếu hai trường máy chủ. nginx 8099 (PID 26812) và DB `quanlycongviec_uat` giữ nguyên, không restart container.

**Chưa nghiệm thu: checklist 9b.15, 9b.16, 9b.17, 9b.18 VÀ mục MỚI 9b.19 (21 bước A–F) — cả năm đều chưa có OK riêng.**
Chuỗi OnlyOffice forcesave → callback → phê duyệt với Document Server thật vẫn chưa được nghiệm thu đầu-cuối.
**Việc kế tiếp: người dùng test PC theo 9b.19 (và giữ xanh 9b.15–9b.18). KHÔNG commit/push/deploy khi chưa nghe
OK RIÊNG ĐỢT NÀY — OK 2026-09-08 của bản bỏ vai cũ không áp dụng cho đợt này.**

## Snapshot trước đợt 3 — bốn yêu cầu mới sau V1–V8, 10/09/2026

Đã bỏ hoàn thành/trạng thái tay ở ba cấp; hoàn thành khi mọi nhóm có bản đã duyệt.
Tab Nhiệm vụ có hàng file con, bỏ Link kết quả; modal 10 cột có tỷ lệ và tiến độ riêng.
Đọc phần đầu `docs/BAO-CAO-V1-V8.md` và checklist **9b.18** trước các snapshot lịch sử bên dưới.
**Full cuối 1961/1961, 110/110 file, exit 0; lint exit 0; cú pháp app.js exit 0.**
Sau định dạng test UI: 8/8 xanh. Format chỉ còn nợ `workItems/tyLe.js` và `stats-parity.test.js`;
file parity đã đổi đối chiếu theo cờ hoàn thành mới, không format nợ cũ.
Buster/banner/nginx **20260910-10**, XSS **98/929**, live asset check exit 0.

Node UAT mở **17:59:42 ngày 10/09/2026 (UTC+7)**, PID ghi nhận **35656**, cổng 3000;
nginx 8099, DB quanlycongviec_uat:5432. Kiểm lại listener trước khi thao tác; không dùng PID cũ 6932.
Cron/Zalo tắt; đợt mới không migration, không reset/seed hoặc restart container/VPS.
Đã kiểm trực quan read-only bằng phiên Lê Thị Nhân: bảng file/hàng bản 10 cột, số tỷ lệ nhìn được,
Công việc/chi tiết/Tổng quan/Gantt; không lỗi JS. Sửa thêm ba phép tính trung bình cũ trên thẻ/danh sách
công việc về gia quyền; CV001 0%, CV002 7% ở dữ liệu lúc kiểm, không đổi trọng số để làm đẹp số.

UAT có thao tác ở phiên khác trong lúc kiểm: files 8→10, flow 26→28, items vẫn 12 nhưng hash đổi;
nhóm 10/11 do user 2 (PGĐ) tạo lúc 18:13:53/18:14:19. Không tuyên bố toàn bộ UAT không đổi;
không khôi phục dữ liệu để ép snapshot khớp. Chi tiết và hash ở báo cáo, `result-uat-before/after.json`.
Bằng chứng test trong `server/node_modules/.vite/vitest/result-full-final.{json,log}` và các
`result-*-final.*`; tất cả ignored. Chưa nghiệm thu chuỗi DS thật, 9b.15–9b.18 chưa có OK riêng.
**Việc kế tiếp: người dùng test PC theo 9b.18. Không commit/push/deploy khi chưa OK RIÊNG ĐỢT NÀY.**

## Snapshot trước bốn yêu cầu mới — V1–V8, 10/09/2026

Đọc `docs/BAO-CAO-V1-V8.md` và checklist **9b.17** trong `docs/HUONG-DAN-TEST-GIAO-DIEN.md`.
Mã V1–V7 đã có; V8 chưa tái hiện lỗi NV gửi thẳng PGĐ, giữ test đối chứng và không sửa theo phỏng đoán.
**Full 1946/1946 test, 108/108 file, exit 0; lint exit 0.** Format chỉ còn đúng hai nợ cũ:
`server/src/modules/workItems/tyLe.js` và `server/tests/integration/stats-parity.test.js` — giữ nguyên.

Buster/banner/nginx **20260910-7**, XSS **107 sink / 920 nội suy**, kiểm asset live exit 0.
UAT cục bộ đã UP **024–027**, hai view đủ cột; dữ liệu cũ đối chiếu số dòng và dấu vân tay không đổi.
Node UAT được mở lúc 12:22 ngày 10/09/2026 (UTC+7), PID ghi nhận **6932**, cổng **3000**;
nginx **8099**, `/readyz` trả `ok:true, db:up`. Luôn kiểm lại listener trước khi thao tác PID cũ.
Lịch tự động tắt, `ZALO_BOT_NHAN=tat`; không reset/seed, không restart container hay VPS.

Đã kiểm bố cục OnlyOffice thật trên Chrome headless với hai context tách cookie: gd@ và tp@,
CV002-005/bản 14; ý kiến nằm trên editor, không đè toolbar, admin nhập được và có nút duyệt bản mới.
**Chưa kiểm trọn chuỗi sửa → forcesave → callback → duyệt trên Document Server thật.**
Các test tích hợp dùng Postgres thật nhưng mock mạng DS; không thay cho bước nghiệm thu này.

V7 dùng chung `approval_changes`; phân biệt đề nghị `gui-bld` với biên nhận `reviewer`.
Đổi tích mặc định chưa có hiệu lực cho đến khi duyệt; người đề nghị không tự duyệt, thu hồi quyền
vẫn bị chặn ở request ghi. Form cấu hình chỉ gửi trường đã đổi, không ghi đè Q2 từ form cũ.
Tiếp theo: người dùng bấm **9b.17** và hoàn tất các bước còn thiếu của **9b.15/9b.16**.
Cả ba đợt đều **chưa nghiệm thu**; phải chờ **“OK RIÊNG ĐỢT NÀY”**. Không commit/push/deploy.

File này để **mở một session AI mới** mà không mất thời gian dò lại dự án đang ở đâu. Nguồn sự
thật về tiến độ vẫn là **§13 của `KE-HOACH-VPS.md`**; file này chỉ là bàn đạp.

Thứ tự dùng: đọc mục 1 (đang ở đâu) → copy prompt ở mục 2 hoặc 3 → dán vào session mới.

---

## 1. Đang ở đâu (cập nhật mỗi khi xong một phase)

**Cập nhật 10/09/2026:** ưu tiên bốn yêu cầu mới và checklist 9b.18 ở đầu tài liệu; các đoạn
2026-09-09 và Phase 9 phía dưới là lịch sử, không cho phép commit/deploy hay reset UAT lúc này.

**Ưu tiên MỚI NHẤT 2026-09-09 (ĐỢT 2, cùng ngày) — «Cán bộ trực tiếp» nay là Trưởng phòng / Phó phòng được: mã XONG trên PC, CHƯA commit/push/deploy, CHỜ người dùng test PC và OK RIÊNG ĐỢT NÀY.**
Người dùng yêu cầu **hỏi trước khi làm**; đã hỏi và được chốt **8 quyết định** (chép nguyên văn ở
**§13.4 mục 27**), rồi chọn «làm ngay trên cây hiện tại». Rủi ro thật KHÔNG nằm ở duyệt nhiệm vụ
(TP/PP vốn không có `approve` ở cấp đó) mà ở **luồng file kết quả**: TP/PP giữ `file:approve`=✓ và
`hoan-thanh` là trạng thái kết được `tienDo.js` tính là XONG rồi cộng dồn lên cả cây theo `ty_le` ⇒
«Đẩy về Cán bộ» → «Hoàn thành» là tự duyệt xong việc của mình trong hai lần bấm. Đã chặn ba chỗ trong
`taskFiles/service.js`: `apTuDong` không tự `da-duyet` cho TP/PP kể cả khi `file:create`=✓ (✓ bị CHẶN
TRẦN ở `cho-lanh-dao`; Cán bộ vẫn tự động như cũ) · `verdict` chặn `hoan-thanh` khi người gọi là
`assignee_id` **hoặc** `uploaded_by` của bản cuối · `baoNguoiPhaiSua` lùi thông báo về Phó GĐ phụ trách
khi người phải sửa CHÍNH là người ra lệnh (`bao()` vốn loại người hành động nên danh sách hoá rỗng).
Điều kiện tiên quyết: `assignments.assertTaskAssignee` **không cho gán TP/PP khi phòng chưa có Phó GĐ
phụ trách** (mã mới `ASSIGNEE_LEADER_NO_DEPUTY`, 400), kiểm ở 5 chỗ gọi + kiểm GỘP trong
`assertTreeAssignments` nên **chuyển công việc sang phòng chưa có Phó GĐ cũng bị chặn**. Ai được gán:
admin/Phó GĐ, hoặc TP/PP **cùng phòng** gán cho nhau. **Không migration, không cột mới.**
Giao diện: bộ lọc vai nới thêm TP/PP (Phó GĐ/admin vẫn ẩn), option kèm «(Trưởng phòng)»/«(Phó phòng)»
nhưng `value` VẪN là tên trơn, `coPhoGiamDocPhuTrach=false` thì vẽ lại danh sách cắt TP/PP (giữ người
đang chọn nếu còn hợp lệ, bị cắt thì trả về RỖNG chứ không âm thầm đổi người), ai tự chọn được thì
KHÔNG điền sẵn tên mình. Nhãn «Cán bộ trực tiếp» → **«Người thực hiện trực tiếp»** (form · popup thay
đổi của người duyệt · nhãn cột nhật ký · hai chỗ xem nhanh), «Cán bộ thực hiện» → «Người thực hiện»
(khối phân công · tooltip Gantt). Báo cáo: E5 + Gantt nhóm `assignee` + Excel mẫu (b) đều **kèm vai**,
lãnh đạo xếp SAU Cán bộ, Excel thêm cột **«Vai»** ở vị trí 2 (các cột sau dời +1) — vai tra theo
`assignee_id` bằng MỘT truy vấn mỗi nơi, KHÔNG đoán từ tên.

**Kiểm cuối đợt 2 (chạy trong session):** full `npm test` từ `server/` **1869/1869 test · 104 file · exit 0**
(+28 test, +1 file so với 1841/103 của đợt 1); pin XSS **106/903 → 107/904** (+1 sink
`selTrucTiep.innerHTML`, +1 giá trị `escapeHtml(vai)`; `trong-the text3` 2→1) đã ghi lý do trong
TC-SEC-11/17 + `docs/XSS-4.6.md`; `npm run lint` **exit 0**; `format:check` chỉ còn
`workItems/tyLe.js` + `tests/integration/stats-parity.test.js` lệch — **cả hai không đổi từ commit
trước** nên không sửa lan. `local-assets-check.mjs --live` xanh, **buster + banner `20260909-5`** cho cả
bốn tài sản. Ba bộ fixture phải **đăng ký thêm `deputy_director`** (`phase8b-permissions`,
`work-origin-history`, các ca `TC-LDTT`) vì luật mới đòi thế — KHÔNG nới luật để test xanh;
`TC-LS-04` đổi kỳ vọng CÓ CHỦ Ý. **Không seed/reset/xóa dữ liệu, không migration mới, không dừng
container dự án khác.** Việc kế tiếp: người dùng test tay theo **mục 9b.16** của
`docs/HUONG-DAN-TEST-GIAO-DIEN.md`; sau khi OK RIÊNG ĐỢT NÀY mới commit (explicit paths,
`may-chu:`/`giao-dien:`, ASCII không dấu, trailer Co-Authored-By) → push `vps/sua-loi-vat` → deploy theo
`deploy/runbook.md` (đợt này VPS **không** cần migration mới). **OK của đợt 1 (nếu có) và OK 2026-09-08
đều KHÔNG tự áp dụng cho đợt này.**

**Ưu tiên 2026-09-09 (ĐỢT 1) — PHASE 8B: mã XONG trên PC, CHƯA commit/push/deploy, CHỜ người dùng test PC và OK RIÊNG ĐỢT NÀY.**
Nhánh `vps/sua-loi-vat`, HEAD vẫn `68d4b75`; cây làm việc có **51 file sửa + 10 file mới (+1352/-661)**, KHÔNG commit gì thêm.
Ba việc của prompt: **A** phân quyền hệ thống thành nguồn quyết định thật (quyền mới áp dụng ở request kế tiếp, không cần
restart Docker hay đăng nhập lại; lưu bảng quyền trong MỘT transaction; REST nhận action `ty-le`; `GET /permissions` trả
thêm khối `phamVi`; giao diện bỏ cách quyết định bằng vai cố định, tự nạp lại quyền **mỗi 15 giây và khi tab hiện lại**
⇒ nói đúng là «trễ nhất 15 giây», KHÔNG nói «áp dụng tức thì»). **B** nhiệm vụ trực thuộc công việc cha: tách
`supervisor_id` = **Ban lãnh đạo phụ trách** (Phó GĐ trong phạm vi phụ trách phòng của công việc cha, hoặc Giám đốc =
tài khoản admin) khỏi `leader_ids` = **Lãnh đạo phòng phụ trách** TP/PP — dùng trường CÓ SẴN, không migration, không nới
validation, không nhét PGĐ/admin vào ô TP/PP. **C** khóa phạm vi phòng khi tạo: `create` ở cả ba cấp bó về phòng của
TP/PP/Cán bộ **ngay cả khi ô quyền đặt `pham_vi='tat-ca'`**, so theo phòng ĐỌC TỪ CSDL nên sửa payload / gọi REST-RPC
trực tiếp / truyền ID ngoài phòng đều bị chặn và không ghi dữ liệu; chưa có phòng thì báo rõ, không rơi sang toàn đơn vị;
admin và Phó GĐ giữ phạm vi hiện hành; **giữ nguyên ngoại lệ ủy quyền** → câu hỏi mở ở **§13.4 mục 26**.
Năm yêu cầu người dùng thêm giữa chừng: tỷ lệ nhiệm vụ TRONG công việc con (migration **022**, mặc định chia đều, sửa tay
một dòng thì các dòng khác giữ nguyên, popup «Tổng tỷ lệ nhiệm vụ khác 100%» có **Sửa lại** / **Vẫn …**) · tạo công việc
cha rồi «Lưu tạm» nay mở đúng chi tiết CÓ dữ liệu và có nút thêm con/nhiệm vụ · nhiệm vụ **bắt buộc** chọn Cán bộ trực tiếp ·
`#toast-container` `z-index:2147483647` để thông báo nổi trên mọi modal · người duyệt **sửa rồi Phê duyệt / Trả để sửa lại /
Từ chối ngay trên màn chi tiết**, «Lưu và phê duyệt» là MỘT request atomic, người gửi mở lại thấy popup thay đổi với
**OK** (chỉ đóng lần đó) / **Đã biết** (ngừng nhắc, lưu theo tài khoản) — migration **023** + `approval_changes` +
`web/assets/js/phase8b-review.js`.

**Kiểm cuối 2026-09-09 (chạy trong session, không chép số cũ):** full `npm test` từ `server/` **1841/1841 test · 103 file ·
458 suite · exit 0**, chạy LẠI SAU khi đổi buster/BOM; focused 4 file phase8b **86/86**; pin XSS **106 sink/903 giá trị** giữ
nguyên; eslint scoped **exit 0**; prettier scoped sạch — chỉ `server/src/modules/workItems/tyLe.js` còn lệch nhưng KHÔNG
thuộc phạm vi (không đổi từ 2026-09-06) nên **không sửa lan**. UAT đã lên **022+023**; sao lưu PC TRƯỚC migration ở
`E:/quanlycongviec-backups/phase8b-20260909-1788890763839/` (dump + fingerprint trước/sau + restore-list, đã drill khôi phục).
Máy chủ PC đang bật bằng `chay-test.bat /giu /f`: cổng 3000 nối ĐÚNG `quanlycongviec_uat`, `/healthz` + `/readyz` 200 cả
3000 lẫn 8099, `ZALO_BOT_NHAN=tat`, log không có dòng level 50/60. **Buster + banner `20260909-4`** cho cả bốn tài sản
(`app.js`/`project-details.js`/`phase8b-review.js`/`app.css`); `tools/local-assets-check.mjs --live` **xanh trọn**.
Hai lỗi tự phát hiện khi kiểm lại: banner `app.js` kẹt ở `-2` trong khi `index.html` trỏ `-3`, và
`web/assets/js/project-details.js` mang **BOM UTF-8** từ 2026-08-26 làm công cụ luôn báo «Nginx phục vụ khác file PC»
— xem §13.5. **Không seed/reset/xóa dữ liệu, không dừng container dự án khác.**
Việc kế tiếp: người dùng test tay theo **mục 9b.15** của `docs/HUONG-DAN-TEST-GIAO-DIEN.md`; sau khi OK RIÊNG ĐỢT NÀY mới
commit tách từng lỗi (`may-chu:`/`giao-dien:`, ASCII không dấu, explicit paths, trailer Co-Authored-By) → push → deploy VPS
theo `deploy/runbook.md` (backup TRƯỚC, chạy migration 022+023 trên VPS). **OK ngày 2026-09-08 KHÔNG áp dụng cho đợt này.**

**Các đoạn 2026-09-08 bên dưới là LỊCH SỬ của đợt bỏ vai «Quản lý công việc» (ĐÃ phát hành VPS), không phải trạng thái đang chờ nghiệm thu.**

**Ưu tiên MỚI 2026-09-08 — BỎ VAI PHÂN QUYỀN QUẢN LÝ CÔNG VIỆC, ĐÃ PHÁT HÀNH VPS.**
Không nhầm tên trang với vai hệ thống. VPS trước đúng b03c74a/020, không lỗi kéo mã/cache:
bản cũ chỉ ẩn cột, form vẫn gửi Quản lý và API ánh xạ thành vai cũ, dept_role TP/PP không
đồng bộ role. Đọc-only VPS: NV004 vai cũ/chức vụ Phó phòng, NV005 vai cũ/chức vụ Trưởng phòng.
Migration021 đã chuẩn hóa theo chức vụ; form/API/CHECK/RBAC bỏ vai cũ; năm vai còn lại giữ
nguyên quyền. Admin/mật khẩu/Zalo không đổi; app chỉ có vai cũ chuyển thành chỉ admin,
không vô tình công khai. Không sửa NV007 PGD chưa phòng ngoài phạm vi.

**Kiểm cuối:** full npm test **1751/1751,99 file,exit0,173.23giây**; scoped12 JS lint/format
sạch, cú pháp Bash/app.js sạch, XSS106/903. PC dev/UAT020→021, fingerprint20 bảng mỗi DB
giữ nguyên, đã backup riêng trước; không seed/reset/kill server. 8099 readyz OK, đã mở browser
PC; người dùng đã xác nhận **OK bản phân quyền mới**. Commit `fcc8aed` + `f23fd34` đã push,
VPS ff-only `f23fd34`, migration021 và restart.sh exit0. NV004=Phó phòng, NV005=Trưởng phòng;
role cũ/override/app role cũ=0. Dữ liệu nghiệp vụ và users (trừ role/updated_at) fingerprint
trùng; Zalo liên kết/mã=1/1; sessions4 dòng trước-sau (hạn phiên đổi). App/db healthy, OO=true,
public health200. App buster **20260908-1**; project-details20260907-1/CSS20260906-1 giữ nguyên.
Script `deploy/restart.sh` đã trên VPS mode755, không reset/pull/đổi secrets. Không reset database nữa.

**Các đoạn phát hành/reset bên dưới là LỊCH SỬ của đợt OnlyOffice.** Số tài khoản0/1 ở thời
điểm reset không phải trạng thái hiện nay: người dùng đã tạo lại tài khoản và phòng.

**Ưu tiên hiện tại 2026-09-08 — ĐÃ TEST PC OK, ĐÃ DEPLOY VÀ RESET DATABASE VPS theo yêu cầu người dùng:** nhánh `vps/sua-loi-vat`, mã máy chủ **`63f05b0`** + giao diện **`4cc8bba`**, migration **020**, app buster **20260907-2** (project-details **20260907-1**, CSS **20260906-1**). Người dùng xác nhận riêng đợt này «đã test trên pc, thấy ok», yêu cầu xóa data database nhưng giữ admin/Zalo và restart Docker. Đã backup rồi transaction xóa nghiệp vụ + hai tài khoản cũ + một phòng, giữ nguyên toàn dòng admin/mật khẩu/Zalo và lịch sử migration; tạo lại ba container, không xóa volume/.env/storage. **VPS hiện chỉ có 1 admin hoạt động, 1 liên kết Zalo, 1 dòng mã liên kết; works/work_items/task_files/versions/departments/sessions đều0 tại lúc kiểm.** Đăng nhập lại admin bằng mật khẩu cũ rồi khai lại dữ liệu, không seed. Backup riêng **`/var/backups/qlcv/release-20260908-140701/`**; `post-reset.dump` đã restore chuẩn thành công. Bản trước reset có 4 công việc mồ côi người tạo; cách khôi phục giữ nguyên dữ liệu xem runbook §3.1. App/db healthy, readyz OK, OO healthcheck true, website200, asset khớp Git; token Zalo hợp lệ, webhook/cron */2 giữ nguyên, không gửi tin thử. Chi tiết nhật ký §13.3. **Không tự reset database lần nữa.**

**PC đã kiểm trong đợt này:** UAT nâng 019→020, fingerprint dữ liệu nghiệp vụ cũ giữ nguyên; dev còn 017 nên đã nâng **018+019+020**, có backfill tỷ lệ của 018 (không tuyên bố fingerprint dev giữ nguyên). Cả hai giữ số dòng works/work_items/permission_overrides/task_files/task_file_versions **1/6/0/4/6**, không seed/reset hoặc dừng server của người dùng. Nginx 8099 `/healthz` 200, OnlyOffice local `/healthcheck` true. Trình duyệt tài khoản NV thấy nav, badge 1, chỉ tab vàng, đủ 4 nút; Lưu tạm giữ ghi chú sau tải lại, đã trả ghi chú về rỗng ban đầu. **Chưa nghiệm thu e2e sửa DOCX thật/gửi-hủy thật/Zalo**; test callback/editor tự động không thay thế các bước đó. Hướng dẫn **mục 9b.13** trong `docs/HUONG-DAN-TEST-GIAO-DIEN.md`; không seed lại để test. **OK đợt 2026-09-07 không áp dụng cho đợt này.**

**Các đoạn ngày 2026-09-07 bên dưới là lịch sử đợt đã phát hành**, không phải trạng thái phát hành của mã đang sửa ngày 2026-09-08.

**Ưu tiên hiện tại 2026-09-07 — ĐÃ NGHIỆM THU PC, ĐÃ PUSH GITHUB + DEPLOY VPS (`c0858f4`):** đã sửa launcher `chay-test.bat`, quyền ĐỌC cùng phòng của Quản lý công việc và footer chi tiết bản nháp. Banner `app.js` và buster `app.js`/`project-details.js` **20260907-1**, CSS giữ **20260906-1**. Đã commit 4 lần, push `30e41b4..c0858f4` và deploy VPS — kết quả kiểm chứng ở đoạn «Đã phát hành» bên dưới và §13.3. Giữ nguyên việc người dùng xoá `chay.bat`. Chạy `chay-test.bat /giu` (không seed/reset, giữ UAT); nếu cổng 3000 bận, tự đóng đúng cửa sổ server cũ trước. `Lưu tạm` chỉ đóng bản nháp đã lưu; `Gửi đi phê duyệt` gửi REST cả cây, khoá nhấp đôi, lỗi mở lại nút. Chọn tháng 10/2026 hoặc «Tất cả tháng» để xem dữ liệu tháng 10, không đổi ngày dữ liệu. **Thời điểm viết chưa test tay PC**: kiểm đọc-only 8099 đang 502 vì chưa bật Node; không coi đó là stack verified. Người dùng sau đó đã tự test và chọn «Đã test PC và OK». Lint toàn repo **đỏ 20 lỗi** ở `ty-le-form.test.js`/`ty-le-tien-do.test.js`, format **đỏ 8 file ngoài scope**; scoped checks sạch, không sửa lan. Full suite độc lập **1701/1701 pass, 96/96 file, exit 0** (lượt đầu chạy chồng global setup đỏ, chi tiết §13.3); các số xanh bên dưới là lịch sử, không thay thế kết quả session này.

**Bổ sung 2026-09-07 — sửa sáu biểu đồ 500 trên PC:** UAT đã ghi migration 018, bảng `work_items` có `ty_le` nhưng view thiếu cột. Migration tiến tới **019_refresh_countable_views** đã áp dụng thành công vào **local `quanlycongviec_uat`**, không seed/reset, không dừng server. Số dòng và fingerprint toàn dòng giữ nguyên trên `works` (1), `work_items` (6), `permission_overrides` (0), `task_files` (4), `task_file_versions` (6), bao gồm tỷ lệ. Đăng nhập bằng tài khoản test có sẵn: **cả sáu loại biểu đồ hợp lệ HTTP 200**, Gantt **200** qua Nginx 8099. Focused **34/34**, full suite tuần tự **1703/1703 trong 96 file**, scoped lint/format sạch; không chạy lại lint/format toàn repo, lỗi ngoài scope đã ghi ở trên vẫn chưa sửa. Launcher thêm smoke chỉ đọc sau migrate bằng truy vấn thống kê thật `LIMIT 0`: mã smoke chạy trực tiếp xanh; `/giu /f` dừng an toàn exit 1 khi cổng 3000 đang bận. Chưa chạy được toàn launcher vì không tự dừng server; smoke đã kiểm qua `cmd.exe` bằng stdin exit 0 (lần bọc `/c` ban đầu sai quoting, exit 1). Buster giữ **20260907-1**. Người dùng Ctrl+Shift+R → Tổng quan → kiểm sáu request 200, biểu đồ và Gantt; nếu cần chạy lại launcher, tự đóng đúng cửa sổ server cũ rồi `chay-test.bat /giu`. **Thời điểm viết: CHỜ test tay PC và OK. Người dùng đã OK và 019 đã lên VPS — xem đoạn «Đã phát hành» bên dưới.**

**Đã phát hành 2026-09-07 — push GitHub + deploy VPS sau khi người dùng chọn «Đã test PC và OK» và «Push GitHub + deploy VPS»:** bốn commit trên `vps/sua-loi-vat` — `b531f38` (giao-dien: quyền đọc cùng phòng + footer bản nháp + buster + 3 test), `71150c5` (may-chu: migration 019 + hồi quy view cũ), `2bebb8c` (may-chu: launcher + `tools/local-assets-check.mjs`, ghi nhận `D chay.bat`), `c0858f4` (tai-lieu); push `30e41b4..c0858f4`. VPS `/opt/qlcv` theo đúng §1 runbook: **backup trước** (`deploy/backup.sh` exit 0, log ghi «xong 22:53», `qlcv-2026-09-07.dump` 112 KB) → fetch → xem trước 5 commit → `git pull --ff-only` về đúng `c0858f4` → `docker compose build app` exit 0 → `up -d` (`qlcv-app` Recreated/Started) → `migrate:up` exit 0, `pgmigrations` mới nhất `019_refresh_countable_views`. **Kiểm chứng:** `/readyz` = `{"ok":true,"db":"up"}`; `qlcv-app` và `qlcv-db` **healthy**, còn `qlcv-onlyoffice` chỉ **Up** (không có healthcheck — không suy ra healthy); smoke chạy đúng hai `QUERIES` của `stats/repo.js` với `LIMIT 0` ngay trong container → «Schema thong ke OK»; **dữ liệu giữ nguyên** works/work_items/permission_overrides/task_files/task_file_versions = **4/2/0/2/1** trước và sau, `sum(ty_le)=100` cả trên bảng lẫn đọc qua hai view; trang sống phát `app.js?v=20260907-1`, `project-details.js?v=20260907-1`, `app.css?v=20260906-1`; sáu `/api/v1/stats/charts` trả **401** khi không có phiên (không còn 500 ở tầng route — **chưa** kiểm 200 kèm phiên vì không đăng nhập tài khoản thật trên production); log app 3 phút đầu không có error/fatal. **Parity PC ↔ GitHub ↔ VPS:** cùng `c0858f4`; `app.js` nginx phát **trùng sha256** file PC; `project-details.js` file PC lớn hơn 470 byte **chỉ do CRLF** của `core.autocrlf=true` — blob đã commit trùng khớp từng byte bản nginx phát và `git diff HEAD` rỗng. Trên VPS còn file untracked `deploy/.env.save`: giữ nguyên, không đọc, không commit. Lint toàn repo **20 lỗi** và format **8 file ngoài scope** vẫn chưa sửa, không tuyên bố sạch.

**Cổng bắt buộc áp dụng cả các prompt bên dưới:** sửa PC → test tự động → **người dùng tự test PC và nói OK** → mới xem xét commit/GitHub/VPS. Đợt 2026-09-07 đã có OK và đã phát hành; lỗi bổ sung về sau vẫn phải đi lại đúng cổng này — OK cũ KHÔNG tự áp dụng cho lần mới.

| | |
|---|---|
| Nhánh đang làm | vps/sua-loi-vat; VPS đang f23fd34 (mã phân quyền/021), tài liệu phát hành của session sẽ commit tiếp. Không cắt lại nhánh từ81d9fb9. |
| Phase đã xong | **0**–**7** (Phase 7: đề nghị CRUD, quản lý App, chat REST + hỏi lại 10 giây, cron dọn chat >90 ngày, xuất Excel 3 mẫu, quyền xuất theo phạm vi — **cầu RPC 37/37 chạy thật, hết `pending()`**) **+ tính năng ngoài kế hoạch**: phân công ba lớp — migration `005_phan_cong.sql` (`works`/`work_items` thêm `supervisor_id`, `leader_ids`, CHECK `task_leader_single`), module `assignments/service.js`, endpoint `GET /departments/assignment-options`, giao diện form/modal; **Sơ đồ Gantt xem theo THÁNG** (2026-08-26, chi tiết `docs/NHAT-KY-GANTT-THEO-THANG.md`); **tab «Quản lý Nhiệm vụ»** (lọc Tháng/Năm/Cán bộ/Phòng + gom khối theo công việc con); **Phó Giám đốc** thấy tab «Quản lý công việc» (client `laQuanTriTrongPhamVi()`, máy chủ không nới quyền — `inScope()` đã bó theo `managedDepartmentIds`); **ỦY QUYỀN CÓ THỜI HẠN** — migration `006_delegations.sql` (`EXCLUDE USING gist` + `btree_gist` chặn trùng khoảng ngày cùng cặp người), **lớp 3 của `can()`** (quyền mượn khi `current_date` ∈ [from,to], `inScopeMuon()`, `viaDelegationId` ghi vào `activity_logs.details`), REST `/api/v1/delegations`, modal «Ủy quyền của tôi» + nhãn «đang được ủy quyền» (kế hoạch `docs/KE-HOACH-UY-QUYEN.md`); **PHÊ DUYỆT ỦY QUYỀN + thứ bậc + cùng phòng** (2026-08-28, §13.4 mục 17/18/20) — migration `007_delegations_approval.sql` (`status` DEFAULT `'pending'`, `accepted_at`/`declined_at`, EXCLUDE nới sang `('pending','active')`), `BAC_VAI` chặn ủy quyền lên cấp trên (`DELEGATION_RANK_UP`), bắt cùng phòng trừ 3 cặp ngoại lệ (`DELEGATION_DIFFERENT_DEPARTMENT`), `POST /:id/accept` · `/:id/decline` chỉ người nhận bấm được (admin **không** thay được), thông báo hai chiều trong bảng `notifications`, và ô chọn phòng hiện **riêng cho Giám đốc** ở form ủy quyền (`buildUyQuyenPhamVi()`); **trang «Quản lý tài khoản»** + bộ lọc một dòng của tab «Quản lý nhiệm vụ» + ô Tháng/Năm cho tab «Quản lý công việc»; **NHẬT KÝ TỪNG LẦN CHỈNH SỬA** (2026-08-28) — `?scope=self\|tree` cho `GET /:id/history`, `listForWorkTree` gom theo `work_id`, `utils/historyRefs.attachRefs`, vá lỗ hổng audit của `DELETE /work-items/:id`, tab «Thông tin \| Nhật ký» trong modal sửa công việc và nhiệm vụ (kế hoạch `docs/KE-HOACH-NHAT-KY.md`); **TÊN RIÊNG THEO TỪNG THÁNG** (2026-08-28) — migration `008_work_month_names.sql` (bảng rời, hai FK `work_id`/`item_id` + `CHECK` đúng một cái, unique **bộ phận** `ux_wmn_work`/`ux_wmn_item`), `PUT`/`DELETE /works/:id/month-names/:month` và `/work-items/:id/…`, bản đồ `monthNames` gắn vào 3 đường đọc, trình duyệt chọn tên theo tháng đang xem ở 2 tab + Gantt (kế hoạch `docs/KE-HOACH-TEN-THEO-THANG.md`) |
| Test đang xanh | **2026-09-08 cuối đợt bỏ vai:1751/1751,99/99 file,exit0,173.23giây**; full chạy độc lập sau sửa cuối. Scoped12 JS lint/format sạch, XSS106/903, Bash/node-check/diff-check sạch. Người dùng đã nghiệm thu PC; migration021/restart VPS exit0 và kiểm dữ liệu sau deploy xanh. Không tuyên bố lint toàn repo sạch; Prettier không hỗ trợ SQL, migration kiểm qua DB/test. |
| ⚠ Phạm vi xem của Phó Giám đốc ở trình duyệt | `visibleDepartments` là **TÊN** các phòng PGĐ phụ trách (bản sao đọc-only của `managedDepartmentIds`), có thể **nhiều phòng**. Chỗ nào lọc danh sách theo người đăng nhập thì phải có nhánh này, nếu không PGĐ thấy **trắng** (đã xảy ra ở `renderTasks()` ngày 2026-08-28): dùng `dsPhongToiPhuTrach()` / `dsNhiemVuToiDuocThay()` thay vì tự viết lại. Vai khác hoặc `visibleDepartments` rỗng ⇒ **không nới** — máy chủ (`inScope()`) vẫn là rào chặn cuối, và công việc chung (không phòng) thì máy chủ cũng không cho. **Bẫy thứ tự (2026-08-29)**: `handleSuccessfulLogin` vẽ **đồng bộ ngay**, còn `visibleDepartments` chỉ về **sau** bằng `getDepartmentContext()` bất đồng bộ ⇒ lần vẽ đầu chạy với `[]`, PGĐ thấy **trắng**, mà đổi tab lại thấy nên rất dễ chẩn đoán sai thành lỗi phân quyền máy chủ (đã mất một lượt điều tra: đo API thật cho **cả hai** tài khoản mới loại trừ được). Nay `loadDepartmentContext` **vẽ lại** 6 khung + Gantt khi `isDeputyDirector` bật hoặc vừa tắt; thêm chỗ nào lọc theo `visibleDepartments` thì **phải** đưa vào danh sách vẽ lại đó, và luôn kiểm bằng lần vẽ ĐẦU chứ không phải sau khi đã bấm qua lại |
| ⚠ Bẫy cột «Đối tượng» | Dữ liệu thật/seed ghi `users.object_type` = **`'Nội bộ'`**; chữ `'Người dùng'` chỉ có ở người tạo qua giao diện/REST. Lọc người thật **chỉ được** loại `'Nhà cung cấp'` (`!== "Nhà cung cấp"`), **đừng** viết `=== "Người dùng"` — đã làm ô chọn người nhận ủy quyền và `<datalist>` gợi ý email rỗng sạch ngày 2026-08-28. Khuôn test cũng phải mặc định `'Nội bộ'`, nếu không test xanh mà giao diện rỗng |
| ⚠ Nhật ký từng lần chỉnh sửa (3 cấp) | Đường đọc là `GET /works/:id/history` và `GET /work-items/:id/history`, mặc định `?scope=self` (**giữ nguyên hợp đồng cũ**); muốn xem cả cây thì thêm `?scope=tree` — cấp 1 gom theo **`work_id`** (nên **con đã bị xoá vẫn còn dấu**), cấp 2 gom nó + các cấp 3 của nó, cấp 3 luôn trả `self`. Máy chủ tự gắn `ref {kind, level, code, name, deleted}` cho từng dòng (`server/src/utils/historyRefs.js`) nên trình duyệt **không** phải gọi thêm cây; tên trong `activity_logs.details` là **dữ liệu cũ**, luôn phải đi qua `escapeHtml` khi vẽ. Thêm hành động ghi nhật ký mới thì khai nhãn vào `NHAT_KY_HANH_DONG` trong `app.js`, thêm cột mới thì khai vào `NHAT_KY_COT` — thiếu thì giao diện hiện thẳng tên hành động/cột của CSDL. Giới hạn đã biết: **cháu bị xoá cùng cha cấp 2** chỉ tra lại được ở nhật ký **cấp 1** |
| ⚠ Tên riêng theo từng tháng | Bảng `work_month_names` (migration **008**) giữ tên của **từng tháng SAU**; **tháng đầu luôn dùng tên gốc** (`MONTH_IS_FIRST`), tháng ngoài khoảng bị chặn (`MONTH_OUT_OF_RANGE`), PUT tên trắng = **bỏ** tên riêng. `ON CONFLICT` phải nêu **tên unique bộ phận** (`ux_wmn_work`/`ux_wmn_item`), không viết `(work_id, month)`. Máy chủ **không** chọn tên: `COL.P_NAME`/`COL.T_NAME` giữ **tên gốc**, chỉ gửi thêm bản đồ `monthNames` (REST trả `month_names`) — vì hai tab nạp một lần rồi lọc tháng tại trình duyệt và một lượt `/gantt` có thể trải nhiều tháng. Ở trình duyệt dùng `tenTheoThangCuaDong(dong, tenGoc, thang)` + `tenGocNeuDaDoiCuaDong(...)`, tháng lấy bằng `thangLocCongViec()` / `thangLocNhiemVu()` / `thangLocGantt()`; **đừng** đổi `data-name`/`data-project-name` hay ô «Tên» của form sang tên tháng (hộp thoại Xoá/Nhân bản/Cập nhật không có tháng nào trong tầm nhìn). Chỗ nào **không** có một tháng cụ thể — Tổng quan, thống kê, biểu đồ, xuất Excel, tìm kiếm — thì giữ tên gốc |
| Phase kế tiếp | **Vẫn Phase8b, danh sách lỗi mở.** Bỏ vai QLCV/021 và restart VPS đã phát hành/kiểm chứng; lỗi bổ sung vẫn theo cổng PC → full test → OK mới → commit/push/deploy. Dùng restart.sh chỉ sau pull sạch và đóng tài liệu OnlyOffice; không lặp reset/seed. Chỉ chuyển Phase9 khi người dùng đóng danh sách lỗi. |
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

## 3. Prompt cho session tiếp theo — nghiệm thu bốn yêu cầu mới trên PC

```text
Repo E:\quanlycongviec, nhánh vps/sua-loi-vat. Trả lời tiếng Việt.
Đọc phần đầu docs/BAO-CAO-V1-V8.md, docs/BAT-DAU-SESSION.md và KE-HOACH-VPS.md §13.
Mã bốn yêu cầu mới đã sửa: hoàn thành từ tất cả nhóm có bản được duyệt; không trạng thái tay;
bảng file 10 cột có tỷ lệ/tiến độ riêng; tab Nhiệm vụ hiện hàng file, bỏ Link kết quả.
Full 1961/1961 (110 file), lint 0; buster 20260910-10, XSS 98/929.
Tiếp tục theo phản hồi PC/checklist 9b.18, giữ các luật V1–V8 và giới hạn chưa nghiệm thu DS thật.
Cây có nhiều thay đổi chưa commit. Không reset/restore/stash/clean/add/commit/push/deploy.
Không reset/seed UAT, không /v14 /f, không xóa volume; dữ liệu đang được người dùng cập nhật.
Test tuần tự từ server/, chỉ CSDL _test cổng 5434. Không in bí mật hoặc đọc trọn app.js/Code.gs.moi.
Không coi test tự động xanh là OK nghiệm thu; chờ người dùng nói OK RIÊNG ĐỢT NÀY.
```

### 3.1 Prompt Phase 9 lịch sử — chưa áp dụng khi các đợt PC còn chưa nghiệm thu


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

> **TRẠNG THÁI 2026-09-09 (đọc trước khi dán prompt):** đợt A/B/C + 5 yêu cầu bổ sung đã XONG MÃ trên PC,
> **chưa commit/push/deploy**, đang CHỜ người dùng test tay theo mục **9b.15** và nói OK RIÊNG ĐỢT NÀY.
> Session kế tiếp vào việc thì: (1) kiểm `git status` + `git log -1` (HEAD vẫn `68d4b75`, cây có 61 file chưa commit);
> (2) KHÔNG tạo lại nhánh từ commit cũ, KHÔNG reset/seed; (3) nếu người dùng đã OK → commit tách từng lỗi
> (`may-chu:`/`giao-dien:`, ASCII không dấu, explicit paths, trailer Co-Authored-By) rồi push + deploy theo
> `deploy/runbook.md` (backup TRƯỚC, migration **022+023** phải chạy trên VPS); (4) nếu người dùng báo lỗi mới → sửa tiếp
> trên chính cây làm việc này, chạy lại full suite, buster đang là **`20260909-4`** (động `web/assets/*` thì tăng lên `-5`
> cho CẢ bốn tài sản và sửa luôn banner `console.info("[QLCV] app.js …")` ở dòng 9 của `app.js` — xem bẫy §13.5).
> Câu hỏi còn chờ người dùng trả lời: **§13.4 mục 26** (Trưởng phòng có được tạo ngoài phòng khi có ủy quyền).
> Lỗi số 1 trong danh sách bên dưới (menu «+ Tạo mới» kéo dài khung đầu trang) **VẪN CHƯA LÀM** — không thuộc đợt A/B/C.

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
2. Chạy npm test từ server/ — phải XANH toàn bộ; chỉ một tiến trình Vitest vì global setup dùng chung CSDL test. Số test mới xem §13.3.
3. Người dùng tự test trên PC theo mục 4 và nói **OK**. jsdom KHÔNG thay bước này. Chưa OK thì DỪNG, không commit/push/deploy.
4. Chỉ sau OK và yêu cầu commit của người dùng, commit riêng từng lỗi: tiền tố giao-dien:/may-chu:, thông điệp ASCII không dấu, explicit paths, cuối thông điệp có dòng Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>.

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
