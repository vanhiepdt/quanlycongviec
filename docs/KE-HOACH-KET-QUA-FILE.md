# KE HOẠCH — «KẾT QUẢ NHIỆM VỤ LÀ FILE»: NỘP → GÓP Ý → DUYỆT (2026-09-01, nhánh `vps/ket-qua-file`)

Yêu cầu người dùng (tóm tắt nguyên văn từ prompt session): kết quả của **nhiệm vụ (cấp 3)** thường là
file **Word/PDF**. **Cán bộ** nộp bản 1 → **Trưởng phòng/Phó phòng** (phòng của công việc) xem, góp
ý, chọn (a) **Yêu cầu sửa lại** (kèm góp ý) → cán bộ nộp bản mới, lặp tới khi ưng; (b) **Trình Phó
giám đốc phụ trách hoặc Giám đốc**; (c) **Hoàn thành luôn**. **Giám đốc/Phó giám đốc** nhận thông
báo, cho ý kiến thì **đẩy về TP/PP** (TP/PP lúc đó tự nộp bản mới của mình HOẶC đẩy về nhân viên,
lặp lại), đồng ý thì **Duyệt** — kết quả chốt, khóa upload. Có **MỘT BẢNG LUỒNG** cho từng file:
thời điểm · người (vai) · hành động · bản · nội dung.

**LÕI CỦA ĐỢT** — luồng KHÔNG có luật cứng riêng: mọi «cửa duyệt» đọc **giá trị hiệu lực** từ ma
trận + GHI ĐÈ (`permission_overrides` 009/010/011, hiệu lực ngay qua `attachSession`). Thêm 2 hàng
mới entityType **`'file'`**: «Nộp kết quả (file nhiệm vụ)» = `file:create`, «Duyệt kết quả (file
nhiệm vụ)» = `file:approve`. Chỗ admin cấu hình **KHÔNG phải duyệt** (`✓ Cho phép`) thì KHÔNG gửi
đi duyệt nữa mà **PHÊ DUYỆT LUÔN** (tự động chốt + dòng flow «Tự động — phân quyền không yêu cầu
duyệt»).

**KHÔNG deploy Nextcloud/OnlyOffice trong session này.** Code phải chạy NGAY không cần editor: PDF
xem bằng iframe trình duyệt, DOCX tải về + góp ý trong app (§7 trả lời câu hỏi editor trực tuyến).

## 0. Đã hỏi lại người dùng trong session (luật «CHƯA HIỂU THÌ HỎI LẠI»)

| Câu hỏi | Người dùng chốt |
|---|---|
| Nút chốt «Hoàn thành / Duyệt» của TP/PP (khi `file:approve` = ✓) ghi **trạng thái nào**? | **Ghi `hoan-thanh` + dòng flow `hoan-thanh`** — TP/PP hoàn thành luôn, không cần trình ai; **`da-duyet` (xanh đậm) chỉ do Phó GĐ/GĐ bấm «Duyệt» hoặc TỰ ĐỘNG theo phân quyền ✓**. Đúng nghĩa «Hoàn thành luôn» mục 2(c), dùng đủ 5 trạng thái |

## 1. Sơ đồ trạng thái — 5 trạng thái của NHÓM file (`task_files.trang_thai`)

```
                    nộp v1 (Cán bộ ⏳)                    nộp (TP/PP ⏳) / Trình (TP/PP)
   (chưa có file) ────────────────────► cho-xem ──┬──────────────────────────────► cho-lanh-dao ──┐
                                                  │  ▲  góp ý (bất kỳ lúc nào)                    │
                          Yêu cầu sửa / Đẩy về    │  │  Yêu cầu sửa                                │ Duyệt (PGD/GĐ)
                          Cán bộ (TP/PP)          ▼  │  Trình (TP/PP)                               │
   (chưa có file) ◄── nộp (TP/PP ✓/PGD/GĐ ✓) ... can-sua ┘                     ┌──────────────────────┤
                                                                                  ▼                      ▼
   nộp của ai đó có giá trị hiệu lực ✓ (cho-phep) ──────── TỰ ĐỘNG ──────► da-duyet                 da-duyet
   TP/PP «Hoàn thành / Duyệt» (file:approve ✓) ──────────────────────────► hoan-thanh        (kết thúc, khóa)
   hoan-thanh / da-duyet = TRẠNG THÁI KẾT — không nộp thêm (409), không verdict (409)
```

| Trạng thái | Nghĩa | Ai đang giữ file | Nhãn / màu badge |
|---|---|---|---|
| `cho-xem` | Chờ TP/PP xem (mặc định sau nộp của Cán bộ) | TP/PP phòng của công việc | vàng |
| `can-sua` | Người phải sửa cần nộp bản mới | Cán bộ (người được giao) và/hoặc TP/PP | đỏ nhạt |
| `cho-lanh-dao` | Chờ Phó GĐ phụ trách / GĐ xử | PGD phụ trách (fallback GĐ) | tím |
| `hoan-thanh` | TP/PP chốt «Hoàn thành / Duyệt» | — (kết thúc) | xanh |
| `da-duyet` | PGD/GĐ bấm «Duyệt» hoặc TỰ ĐỘNG theo phân quyền | — (kết thúc) | xanh đậm |

| Từ | Hành động | Ai (điều kiện) | Đến | Flow ghi | Thông báo tới |
|---|---|---|---|---|---|
| — | nộp bản mới | người được giao nhiệm vụ / TP/PP / PGD / GĐ theo trạng thái (§2, §4) | `cho-xem` (Cán bộ ⏳) · `cho-lanh-dao` (TP/PP ⏳) · `da-duyet` (✓) | `nop` (+ `duyet-tu-dong` nếu ✓) | TP/PP phòng (`cho-xem`) · PGD phụ trách (`cho-lanh-dao`) · người nộp + TP/PP (tự động) |
| `cho-xem`/`can-sua` | góp ý | TP/PP + PGD phụ trách + GĐ/admin | giữ nguyên | `gom-y` | — (thread hiện tại chỗ) |
| `cho-xem`/`can-sua` | Yêu cầu sửa (nội dung ≥ 10 ký tự) | TP/PP | `can-sua` | `yeu-cau-sua` | người phải sửa (người nộp bản cuối + người được giao nhiệm vụ) |
| `cho-xem`/`can-sua` | Trình Phó giám đốc (nội dung ≥ 10 ký tự) | TP/PP | `cho-lanh-dao` | `trinh-lanh-dao` | PGD phụ trách phòng |
| `cho-xem`/`can-sua` | Hoàn thành / Duyệt (không cần nội dung) | TP/PP khi giá trị hiệu lực `file:approve` = ✓ | `hoan-thanh` | `hoan-thanh` | người nộp + TP/PP phòng |
| `cho-xem`/`cho-lanh-dao` | Đẩy về Cán bộ (nội dung không bắt buộc) | TP/PP | `can-sua` | `tra-ve-cbo` | người phải sửa |
| `cho-lanh-dao` | Trả về TP/PP (nội dung ≥ 10 ký tự) | PGD phụ trách / GĐ/admin | `cho-xem` (bàn của TP/PP) | `tra-ve-tp` | TP/PP phòng |
| `cho-lanh-dao` | Duyệt (không cần nội dung) | PGD phụ trách / GĐ/admin khi `file:approve` = ✓ | `da-duyet` — KHÓA | `duyet` | người nộp + TP/PP phòng |

## 2. Ánh xạ 2 hàng phân quyền → từng cửa

Nghĩa của giá trị **cho vai người ở ô đó**, đọc lúc hành động diễn ra (`giaTriHieuLuc` — ma trận +
`user.ghiDe`; hiệu lực NGAY vì `attachSession` nạp lại mỗi request):

| Hàng | Giá trị | Nghĩa | Hiệu ứng cụ thể |
|---|---|---|---|
| «Nộp kết quả (file nhiệm vụ)» `file:create` | `⏳ Chờ duyệt` — **mặc định Cán bộ, TP/PP** | phải gửi đi duyệt | Nộp xong: Cán bộ → `cho-xem`; TP/PP → `cho-lanh-dao` (lãnh đạo của họ là PGD/GĐ) |
| | `✓ Cho phép` | phê duyệt luôn | Nộp xong nhóm chuyển thẳng `da-duyet` + dòng flow `duyet-tu-dong` «Tự động — phân quyền không yêu cầu duyệt». KHÔNG gửi TP/PP/PGD |
| | `✕ Tắt` | không nộp được | 403 kèm câu rõ |
| «Duyệt kết quả (file nhiệm vụ)» `file:approve` | `✓ Cho phép` — **mặc định admin (GĐ), PGD, TP/PP** | nút «Duyệt kết quả»/«Hoàn thành / Duyệt» là chốt luôn | TP/PP có nút «Hoàn thành / Duyệt» (→ `hoan-thanh`); PGD/GĐ có nút «Duyệt» (→ `da-duyet`) |
| | `⏳ Chờ duyệt` (TP/PP) | bắt buộc qua cấp trên | Nút «Hoàn thành / Duyệt» của TP/PP **ẨN** — chỉ còn «Yêu cầu sửa» + «Trình Phó giám đốc/GĐ» |
| | `✕ Tắt` | vai đó không duyệt được | Nút ẩn; gọi API → 403 |

- **`⏳` chỉ hợp lệ ở**: `file:create` × (Cán bộ `Nhân viên`, Trưởng phòng, Phó phòng) và
  `file:approve` × (Trưởng phòng, Phó phòng). Admin đặt `⏳` cho Phó GĐ ở 2 hàng này ⇒ máy chủ 400
  (PGD/GĐ là cấp chốt cuối — không có ai để «chờ»). Giá trị `✓`/`✕` cho PGD vẫn chỉnh được như
  hàng thường; **admin không chịu ghi đè** (luật cũ 009 giữ nguyên).
- **Quy tắc chung «cửa TIẾP THEO của chính người đó»**: SAU MỖI hành động, nếu giá trị hiệu lực của
  cửa của NGƯỜI VỪA HÀNH ĐỘNG là `cho-phep` thì bỏ qua cửa đó (auto chốt + dòng «Tự động»). Nút
  chốt của NGƯỜI KHÁC (TP/PP duyệt kết quả của Cán bộ) không bao giờ tự bấm hộ — `✓` chỉ làm nút
  đó xuất hiện. Ví dụ prompt: TP/PP nộp bản sửa sau khi PGD trả về mà `file:create` của TP/PP là
  `⏳` ⇒ bản mới về `cho-lanh-dao`; admin đổi `✓` ⇒ từ lần nộp sau là chốt luôn.
- Đổi ghi đè qua `PUT /api/v1/permissions` ⇒ hành vi luồng đổi **NGAY** cho request tiếp theo.
- `read` file đi theo `can(user,'read','task',row)` (scope phòng của công việc cha); file **không
  có** hành động xoá cấu hình trong bảng phân quyền — xoá NHÓM file = người tạo nhóm + admin, khi
  chưa `da-duyet` (server chặn, UI ẩn nút).

## 3. CSDL — migration `014_nhiem_vu_file_ket_qua.sql` (khuôn 012/013)

Bốn bảng mới + nới CHECK phân quyền; **KHÔNG đụng `approval_status`** (luồng file là chiều ĐỘC LẬP
với luồng duyệt cây — tiền lệ «3 cột `xoa_*`» của 013) và **KHÔNG đụng hai view `v_countable_*`**
(014 không thêm cột vào works/work_items).

| Bảng | Vai trò | Điểm chính |
|---|---|---|
| `task_files` | NHÓM file của một nhiệm vụ | `item_id → work_items ON DELETE CASCADE`, `ten_goc` (tên hiển thị), `trang_thai` CHECK 5 giá trị, `created_by` |
| `task_file_versions` | BẢN (v1, v2…) | `file_id CASCADE`, `version_no`, `ten_luu` (**tên vật lý sinh sẵn `v{n}-{uuid}.{ext}` — CẤM dùng tên gốc làm đường dẫn**), `ten_goc`, `loai_mime`, `kich_thuoc`, `uploaded_by/at`, `UNIQUE(file_id, version_no)` |
| `task_file_comments` | Góp ý theo BẢN | `version_id CASCADE`, `nguoi_id`, `vai`, `noi_dung`, `trang` int NULL, `created_at` |
| `task_file_flow` | BẢNG LUỒNG | `file_id`, `version_id NULL`, `nguoi_id`, `vai`, `hanh_dong` CHECK 9 giá trị (`nop`/`gom-y`/`yeu-cau-sua`/`trinh-lanh-dao`/`tra-ve-tp`/`tra-ve-cbo`/`duyet-tu-dong`/`duyet`/`hoan-thanh`), `noi_dung`, `created_at` |

Chỉ mục: `(item_id)`, `(version_id)`, `(file_id, created_at)`.

Nới ràng buộc phân quyền cho `'file'` (đọc đúng CHECK của 009/010/011):
- `po_entity_ok`: thêm `'file'` vào danh sách entity_type.
- `po_cho_duyet`: nới thêm nhánh `entity_type='file' AND action='approve' AND vai IN ('Trưởng
  phòng','Phó phòng')` (luật cũ chỉ cho `cho-duyet` ở `action='create'`).
- Down: **xoá dòng `entity_type='file'` trước khi siết lại CHECK** (không làm thế là ALTER nổ — bẫy
  012), rồi DROP 4 bảng. Đã thử `migrate:down` + `up` lại trên cả 2 CSDL (dev + UAT).

## 4. Server — phân quyền `'file'` + storage + REST

| Thành phần | Đã làm |
|---|---|
| `middleware/rbac.js` | `ENTITIES` + ma trận `PERMISSIONS` thêm `'file'`: read mọi vai (inScope như task — phòng của công việc cha); `create` cho admin/PGD/TP/PP/Cán bộ; `approve` cho admin/PGD/TP/PP (Cán bộ không có). `inScope` case `'file'` đi cùng đường task. Helper mới **`giaTriHieuLuc(user, entityType, action)`** trả `'cho-phep'\|'cho-duyet'\|'tu-choi'` — ghi đè trước, mặc định theo vai sau; DUY NHẤT một chỗ cho server |
| `permissions/service.js` | `THUC_THE_DUOC_SUA` thêm `'file'`; luật `cho-duyet` nới: hợp lệ ở `file:create` cho Cán bộ/TP/PP và `file:approve` cho TP/PP (400 cho các cặp khác, kể cả PGD); `permissions/routes.js` zod enum thêm `'file'` |
| Upload | **`multer`** (thư viện mới — ghi 1 dòng mục 3.3 `docs/BAT-DAU-SESSION.md`); lưu `server/storage/ket-qua/{itemId}/v{n}-{uuid}.{ext}`; `server/storage/` vào `.gitignore`; whitelist `.doc/.docx/.pdf` + mimeType (`application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`), `limits.fileSize` 20 MB; **cấm** tin tên gốc làm đường dẫn |
| Module `server/src/modules/taskFiles/` | `repo.js` / `service.js` / `routes.js` (khuôn `approvals/`), mount **một dòng** trong `app.js`: `v1.use('/work-items', ...)` mở rộng — routes gắn lên `/work-items/:ref/files` + `/task-files` + `/task-file-versions` |

Endpoint (máy chủ là rào chặn cuối; mọi ghi chạy `withTransaction`):

| REST | Làm gì |
|---|---|
| `POST /api/v1/work-items/:ref/files` (FormData) | Nộp bản mới: kiểm `can(create,'file')` + trạng thái nhóm cho phép nộp (`cho-xem`: người được giao + TP/PP + PGD/GĐ; `can-sua`: người được giao + TP/PP; `cho-lanh-dao`: chỉ TP/PP + PGD/GĐ; kết thúc ⇒ 409). Lưu version `v{n}` rồi **áp quy tắc tự-động** theo `giaTriHieuLuc` của người nộp ⇒ `cho-xem`/`cho-lanh-dao` hoặc `da-duyet` + flow `duyet-tu-dong` |
| `GET /api/v1/work-items/:ref/files` | Nhóm + bản + góp ý + LUỒNG; kiểm `can(read,'task')` trên nhiệm vụ |
| `GET /api/v1/task-files/:id/download` | Stream `Content-Disposition` tên gốc; `?inline=1` cho PDF xem trong iframe |
| `POST /api/v1/task-file-versions/:id/comments` | TP/PP + PGD phụ trách + GĐ/admin; ghi flow `gom-y` |
| `POST /api/v1/task-files/:id/verdict` | `{hanhDong, noiDung?}` — state machine kiểm CẢ quyền HIỆU LỰC lẫn trạng thái (§1); `yeu-cau-sua`/`tra-ve-tp`/`trinh-lanh-dao` bắt buộc `noiDung` ≥ 10 ký tự; `duyet`/`hoan-thanh`/`tra-ve-cbo` có thể trống; ghi flow + thông báo `notifications` |
| `DELETE /api/v1/task-files/:id` | Người tạo nhóm + admin, khi chưa `da-duyet` |

## 5. Giao diện

- Tab **«Kết quả & Luồng»** trong modal NHIỆM VỤ, bám khuôn `buildThanhTabNhatKy`/`buildKhungNhatKy`
  (thanh tab + khung ẩn `task-ket-qua-panel`, nạp một lần rồi thôi) — đừng chế khung thứ hai.
- Bố cục: nút «Tải file lên» (`accept=".doc,.docx,.pdf"` — chỉ hiện với người được nộp THEO TRẠNG
  THÁI VÀ quyền hiệu lực); mỗi FILE một khối: tên + badge trạng thái (cho-xem vàng · can-sua đỏ
  nhạt · cho-lanh-dao tím · hoan-thanh xanh · da-duyet xanh đậm) + ⬇ tải / 👁 xem (chỉ PDF) / 🗑
  xoá (người tạo + admin, chưa `da-duyet`); dưới mỗi file: **BẢN** (v1, v2… ai nộp lúc nào),
  **GÓP Ý** (thread theo bản), **BẢNG LUỒNG** `<table>` cột Thời điểm · Người (vai) · Hành động ·
  Bản · Nội dung, mới nhất trên đầu; dòng «Tự động — phân quyền không yêu cầu duyệt» hiện được.
- Nút verdict hiển thị THEO VAI + GIÁ TRỊ HIỆU LỰC (client đọc `user.ghiDe` + ma trận từ
  `GET /api/v1/permissions` — khuôn `oPhanQuyenHieuLuc`): TP/PP thấy «Yêu cầu sửa» + («Trình»
  và/hoặc «Hoàn thành / Duyệt» + «Đẩy về Cán bộ» tùy `file:approve` của họ và trạng thái); PGD/GĐ
  thấy «Trả về TP/PP» + «Duyệt» ở `cho-lanh-dao`; người phải sửa thấy «Nộp bản mới».
- Upload qua `restUpload()` (FormData) kế thừa CSRF của `restPost` (đọc token từ cookie `_csrf`,
  header `X-CSRF-Token`); toast lỗi rõ; sau upload nạp lại tab. Nhãn tiếng Việt, KHÔNG kèm mã
  nhiệm vụ (quy ước Vòng 7). Mọi giá trị nội suy qua `escapeHtml`/`escapeHtmlAttr` (bộ soát XSS).

## 6. Test

| File | Nội dung |
|---|---|
| `tests/integration/task-files-api.test.js` (**mới**, khuôn `xoa-cho-duyet-api.test.js`) | **TC-TF-01..14** chốt state machine + PHÂN QUYỀN (đủ 14 ca §6.1) |
| `tests/unit/task-files-ui.test.js` (**mới**, jsdom — khai vào `eslint.config.js`) | Tab render đủ khối, badge màu, nút ẩn/hiện theo vai + giá trị hiệu lực, bảng luồng đủ cột, escape tên file `<b>xấu</b>`, chặn sai đuôi file ở client |
| `tests/unit/phan-quyen-ghi-de.test.js` | TC-PQ mới cho `giaTriHieuLuc` (mặc định theo vai, ghi đè thắng, tu-choi) |
| `tests/unit/tai-khoan-ui.test.js` | TC-TKPQ-06 `13*4`→`15*4`, TC-TKPQ-14 `13*3`→`15*3`, thêm ca 2 hàng file |
| `tests/unit/xss-guard.test.js` | Pin TC-SEC-17 cập nhật theo `tools/dem-xss.mjs` |
| Migration | `migrate:up` cả 2 CSDL (dev + UAT) + `down`/`up` lại sạch |

**TC-TF-01..14:** 01 cán bộ nộp ⇒ `cho-xem` · 02 TP góp ý · 03 TP yêu cầu sửa ⇒ `can-sua` + thông
báo · 04 nộp v2 ⇒ `cho-xem` · 05 admin đổi `file:create` Cán bộ = `cho-phep` qua PUT ⇒ lần nộp sau
TỰ ĐỘNG `da-duyet` + flow `duyet-tu-dong` · 06 đổi lại `⏳` ⇒ luồng thường (hiệu lực NGAY) · 07 TP
trình PGD ⇒ thông báo PGD phụ trách · 08 PGD trả về TP (nội dung ≥ 10) ⇒ `cho-xem` · 09 TP nộp
chính mình (`⏳`) ⇒ `cho-lanh-dao` · 10 TP đẩy về Cán bộ ⇒ `can-sua` · 11 TP `file:approve` = ✓ ⇒
«Hoàn thành / Duyệt» chốt `hoan-thanh`; = ⏳ ⇒ 403 · 12 PGD Duyệt ⇒ `da-duyet` khóa (nộp tiếp 409)
· 13 Cán bộ không verdict ⇒ 403; vai ngoài phòng 403 · 14 sai loại file/quá 20MB ⇒ 400.

## 7. § ĐÁP NEXTCLOUD AIO — trả lời bằng tài liệu (người dùng hỏi trước khi bật editor trực tuyến)

**(a) DOCX góp ý / track-changes trực tuyến: CÓ.** Qua engine Office nhúng: Nextcloud AIO có sẵn
tùy chọn «Nextcloud Office» (= Collabora Online) trong danh sách dịch vụ; hoặc nhúng ONLYOFFICE
Docs — cả hai đều cho xem/sửa DOCX trực tuyến, thêm nhận xét và theo dõi thay đổi (track changes)
ngay trên trình duyệt. Nguồn: README Nextcloud AIO — mục «Included are: … Nextcloud Office
(optional)» (https://github.com/nextcloud/all-in-one); tổng quan tích hợp ONLYOFFICE
(https://api.onlyoffice.com/docs/docs-api/get-started/how-it-works/ — «Document editor … viewing,
editing, and saving documents»).

**(b) PDF thêm ý kiến trực tuyến:**
- **ONLYOFFICE Docs ≥ 8.0 (8/2024)** có trình sửa PDF thật: mở/sửa nội dung, thêm chú thích
  (annotation), điền form PDF. Kiểm chứng được trong session này ở tầng API: trang «How it works»
  hiện hành (Docs 9.4) liệt kê `.pdf` vào nhóm định dạng **nguyên bản có thể mở để sửa** của
  conversion/editor (https://api.onlyoffice.com/docs/docs-api/get-started/how-it-works/).
- **Collabora Online: hạn chế** — PDF mở/đọc được, chỉnh sửa PDF đi qua giao diện Draw của
  LibreOffice, không mượt bằng ONLYOFFICE ở phần chú thích PDF. Trong session này **chưa trích được
  câu nguyên văn** từ trang release notes của Collabora (fetch lỗi) ⇒ nếu chọn Collabora thì phải
  kiểm chứng lại bằng demo trước khi hứa tính năng. Khuyến nghị: bài PDF cần góp ý thật → dùng
  ONLYOFFICE.
- **Không bật gì cả (như hiện tại của session này):** PDF xem bằng `<iframe>` của trình duyệt
  (đường `?inline=1`), góp ý ghi trong app theo BẢN — đủ cho luồng nộp → góp ý → duyệt.

**(c) Nextcloud AIO là bộ NẶNG — gồm gì, bao nhiêu RAM, có bắt buộc HTTPS/domain không?**

| Tiêu chí | Nextcloud AIO | ONLYOFFICE Docs standalone (Docker) |
|---|---|---|
| Gồm những dịch vụ | Theo README AIO: Nextcloud + High performance backend Files (Client Push) + **Redis + APCu** + **PostgreSQL** + Nextcloud Office (tùy chọn) + EuroOffice (tùy chọn) + HPB/TURN Talk (tùy chọn) + Talk Recording (tùy chọn) + **BorgBackup** (tùy chọn) + **Imaginary** (tùy chọn) + **ClamAV** (tùy chọn) + Fulltextsearch (tùy chọn) + Whiteboard (tùy chọn) + Docker Socket Proxy + mastercontainer + apache + community containers | MỘT bộ Document Server (editor + editing service + command service + conversion service + builder); app của mình giữ storage + CSDL sẵn có |
| RAM | Nextcloud core cần tối thiểu 128 MB/quy trình, khuyến nghị 512 MB/quy trình (nguồn: https://docs.nextcloud.com/server/latest/admin_manual/installation/system_requirements.html); thực tế AIO chạy đủ bộ + Collabora/ClamAV là **~2 GB trở lên**, khuyến nghị 4 GB (đang là câu hỏi §13.4 **mục 23** cho người dùng soi VPS) | Document Server khuyến nghị ~**4 GB RAM** cho máy chạy riêng (bộ cài chuẩn của ONLYOFFICE); nhẹ hơn nếu chỉ vài người dùng đồng thời |
| HTTPS / domain | **BẮT BUỘC có domain** — AIO tự phát chứng chỉ Let's Encrypt («Automatic TLS included (by using Let's Encrypt)») và chỉ cần MỘT domain cho mọi dịch vụ (nguồn: README AIO, mục Requirements/TLS) | Không bắt buộc domain riêng; chạy cùng host với app là được, nhưng app đang HTTPS thì editor cũng phải HTTPS (tránh mixed-content) — đặt sau cùng Nginx |
| Độ phức tạp | Cài/mastercontainer/backup/upgrade riêng cả một hệ sinh thái; phải học vòng bảo trì của Nextcloud | Thêm 1 service + JWT secret + callback handler vào app hiện có; không đụng dữ liệu người dùng |
| Đủ tính năng DOCX + PDF | DOCX tốt (Collabora); PDF góp ý hạn chế (Draw) | **DOCX tốt + PDF góp ý tốt (≥ 8.0)** |

**Khuyến nghị:** khi bật editor trực tuyến, dùng **ONLYOFFICE Docs standalone (Docker)** nhúng
thẳng vào app qua **iframe + JWT + callback-save** về storage của mình — **KHÔNG cần Nextcloud**.
Lý do: app đã có luồng bản (versions) + bảng luồng + phân quyền; Nextcloud AIO chỉ để có editor thì
trả giá bằng cả một hệ thống lưu trữ/file permission riêng, và PDF góp ý vẫn kém hơn.

**(d) Tích hợp kỹ thuật khi bật (thiết kế sẵn, chưa làm trong session này):** file nằm ở storage
của mình (`server/storage/ket-qua/…`); editor mở qua URL có **token ký ngắn hạn** của app (server
kiểm quyền trước khi ký); config editor ký **JWT** bằng secret chung với container; `document.key`
đặt theo `task_file_versions.id` (đổi key khi sang bản mới để editor không tái dùng cache bản cũ);
người dùng lưu → Document Server gọi **callbackUrl** của app với `status=2/6` kèm `url` bản đã sửa
→ app tải về, lưu thành **BẢN MỚI (version_no + 1) trong cùng NHÓM**, không ghi đè bản cũ; luồng
duyệt/góp ý/bảng luồng hiện có không đổi. (Nguồn: https://api.onlyoffice.com/docs/docs-api/get-started/how-it-works/
— Document Server gồm editing/command/conversion service, integrator giữ document manager + storage.)

## 8. Câu hỏi chờ người dùng — đã ghi vào §13.4 `KE-HOACH-VPS.md` (mục 21–24)

1. **(mục 21)** Trình lên TỰ ĐỘNG cho PGD phụ trách (fallback GĐ) hay TP/PP tự chọn thời điểm? —
   mặc định **TỰ ĐỘNG** (`department_managers` như luồng duyệt hiện có; phòng không có PGD phụ trách
   thì không ai được báo, admin vẫn duyệt được).
2. **(mục 22)** Giới hạn file — mặc định `.doc/.docx/.pdf`, ≤ **20 MB**, mỗi lần nộp là một bản mới.
3. **(mục 23)** RAM/HTTPS của VPS cho editor trực tuyến (AIO cần domain + ~2–4 GB; OnlyOffice nhẹ hơn).
4. **(mục 24)** `.doc` cũ có cần xem trực tuyến không — mặc định **chỉ tải về** (PDF xem iframe; DOCX editor là việc sau).

## 9. Giả định đã chọn trong session (người dùng có thể đổi — mỗi ý là 1 dòng code/test)

| # | Giả định | Lý do |
|---|---|---|
| 1 | TP/PP chốt = `hoan-thanh`; `da-duyet` chỉ do PGD/GĐ hoặc tự động | **Người dùng đã chốt** (§0) |
| 2 | PGD/GĐ nộp file (hiếm): giá trị hiệu lực `file:create` mặc định = ✓ ⇒ nộp là tự động chốt | Họ là cấp chốt cuối; không ai ở trên để «chờ» |
| 3 | 2 hàng file là dropdown cho cả 3 vai như hàng thường, nhưng option `⏳` chỉ có ở `file:create` × (Cán bộ, TP, PP) và `file:approve` × (TP, PP) | Đúng chữ prompt «'cho-duyet' hợp lệ ở file:create cho Cán bộ/TP/PP; ở file:approve cho TP/PP» |
| 4 | PGD «Trả về TP/PP» ⇒ trạng thái `cho-xem` (bàn của TP/PP), TP/PP từ đó nộp bản mới hoặc «Đẩy về Cán bộ» | Đúng luồng «TP/PP lúc đó tự chỉnh sửa HOẶC đẩy về nhân viên» |
| 5 | «Đẩy về Cán bộ» (`tra-ve-cbo`) KHÔNG bắt buộc nội dung | Đúng liệt kê prompt (chỉ yeu-cau-sua/tra-ve-tp/trinh-lanh-dao bắt buộc ≥ 10 ký tự) |

## 10. Test thủ công cho người dùng (bấm tay sau khi deploy)

`Ctrl+Shift+R` → Console phải thấy banner `[QLCV] app.js 20260901-3` → mở modal một nhiệm vụ có gán
cho mình → tab **«Kết quả & Luồng»**:

1. Cán bộ nộp PDF + DOCX → bản v1, trạng thái «Chờ TP/PP xem» (vàng).
2. PDF bấm 👁 mở ngay trong trình duyệt (iframe).
3. TP/PP góp ý + «Yêu cầu sửa» → Cán bộ nhận thông báo, nộp v2.
4. TP/PP «Trình Phó giám đốc» → PGD nhận thông báo, «Trả về TP/PP» kèm ý kiến → TP/PP nộp bản mình
   (về `cho-lanh-dao`, tím) hoặc «Đẩy về Cán bộ».
5. admin vào trang Quản lý tài khoản, Bảng phân quyền, đổi «Nộp kết quả (file nhiệm vụ)» cột Cán bộ
   thành **✓ Cho phép** → Cán bộ nộp file mới ở nhiệm vụ khác ⇒ **Phê duyệt luôn** (xanh đậm), bảng
   luồng có dòng «Tự động — phân quyền không yêu cầu duyệt»; đổi lại ⏳ ⇒ luồng thường.
6. admin đổi «Duyệt kết quả (file nhiệm vụ)» cột Trưởng phòng thành ⏳ ⇒ TP/PP mất nút «Hoàn thành /
   Duyệt», chỉ còn «Trình».
7. PGD «Duyệt» ⇒ khóa (xanh đậm; nộp tiếp báo 409).
8. Bảng luồng đúng thứ tự thời gian (mới nhất trên đầu), đủ người + vai + nội dung.





