# KE HOẠCH — «KẾT QUẢ NHIỆM VỤ LÀ FILE»: NỘP → GÓP Ý → DUYỆT (2026-09-01, nhánh `vps/ket-qua-file`)

## Bổ sung 12/09/2026 lượt 2 — TP/PP HẾT NÚT «GỬI ĐI DUYỆT» KHI NHIỆM VỤ KHÔNG TRÌNH BLĐ · «HOÀN THÀNH» MỞ THÊM Ở `luu-tam` (checklist 9b.25)

Người dùng chỉ đạo nguyên văn: «Khi trưởng phòng/phó phòng duyệt file kết quả vẫn còn hiển thị gửi đi
duyệt đối với file không phải gửi lên ban lãnh đạo duyệt, tức là ko tích ô Gửi BLĐ phê duyệt đấy». Đây là
lần **THỨ HAI** họ gặp cùng một bệnh trên cùng một nhiệm vụ (**CV002**) — lần trước là «file bị đẩy lên
PGĐ dù không tích», đã sửa ở bản Q6/Q11 chiều 11/09; lần này là **nút vẫn còn đó** ở chiều ngược lại.
Một việc, **KHÔNG có migration** (CSDL giữ `029`), buster **`20260912-02`** ⇒ người đang test chỉ cần
**Ctrl+F5**. Bấm thử: `docs/HUONG-DAN-TEST-GIAO-DIEN.md` **§9b.25 mục D (bước 75 → 78)**.

### 1. Lỗ hổng gốc: `apTuDong` quyết chặng kế tiếp CHỈ BẰNG CÁCH NHÌN VAI

Bản cũ của `apTuDong` (`taskFiles/service.js:410`) là:

```js
// CŨ — sai
if (['Trưởng phòng', 'Phó phòng'].includes(user.role)) return 'cho-lanh-dao';
```

Nó **không đọc** ô `gui_bld_phe_duyet` của nhiệm vụ, nên mọi bản TP/PP đụng vào đều bị đẩy lên
`cho-lanh-dao` — trái **Q6** (tích TẮT ⇒ TP/PP chốt luôn bằng `hoan-thanh`) và **Q11** (giữ `hoan-thanh`
cho nhiệm vụ không bật tích). Hệ quả kép: bản đi **sai chặng**, và hàng nút của TP/PP vẫn hiện «Gửi đi
duyệt» cho một việc mà chính họ là **chặng cuối**.

### 2. Luật mới: theo đúng BA lý do của `phaiTrinhLanhDao`

`apTuDong` nay dựng một «người nộp giả lập» rồi hỏi đúng hàm mà mọi chỗ khác vẫn hỏi
(`phaiTrinhLanhDao`, dòng **864**) — hàm này có **đúng ba** lý do, không thêm không bớt:

1. `item.gui_bld_phe_duyet === true` — nhiệm vụ **có** tích «Gửi BLĐ phê duyệt»;
2. người bấm **chính là** `assignee_id` — chống tự duyệt (Q5, van nay chỉ canh NGƯỜI THỰC HIỆN);
3. `giaTriHieuLuc(user, 'file', 'approve') !== 'cho-phep'` — vai đó **không** có quyền duyệt file.

Có một trong ba ⇒ `cho-lanh-dao`; không có lý do nào ⇒ **`cho-xem`**. `cho-xem` chính là **hàng chờ của
TP/PP**: bản nằm đó để họ đọc và **tự chốt**.

> **⚠ Bẫy đã trả giá: `ghiDe` phải ĐỌC LẠI.** `nguoiNop` được dựng từ dòng `users` do
> `repo.nguoiTheoId` lấy ra, **không phải `req.user`** ⇒ dòng đó **không có** `ghiDe`. Nếu chuyển thẳng
> vào `phaiTrinhLanhDao` thì lý do (3) **luôn đúng** (vì `giaTriHieuLuc` rơi về mặc định) và bản lại bị
> đẩy lên `cho-lanh-dao` **y như lỗi cũ, chỉ khác lý do**. Nay `apTuDong` nạp lại qua
> `permissionsRepo.listByVai(user.role)` rồi gán vào `nguoiNop.ghiDe`.

> **⚠ R6 KHÔNG bị nới theo.** Sửa chỗ này rất dễ trượt thành «TP/PP là chặng cuối ⇒ cho `da-duyet`
> luôn». **Không**: `apTuDong` **không bao giờ** trả `'da-duyet'`. Chặng cuối nghĩa là họ **bấm tay**
> nút «Hoàn thành» / «Duyệt», có lưu mốc người duyệt và lúc duyệt (điểm bất hợp lý số 7 của ĐỢT B).

### 3. Hàng nút: tách `laChuBanNhom` để phân biệt 403 và 409

`duocGuiBanLuu(user, nhom, item, ban)` (**433**) nay là **hai điều kiện tách rời**:

```js
return laChuBanNhom(user, nhom, item, ban) && !tpPpLaChanhCuoi(user, item);
```

- `laChuBanNhom` (**442**) — nhóm `luu-tam`, có bản, `can(user,'submit','file')`, `duocGhiTheoPhanCong`,
  và người bấm là `admin` / chủ nhóm / `assignee` / người up bản đó. **Đây là vế QUYỀN.**
- `tpPpLaChanhCuoi` (**456**) — người bấm là Trưởng/Phó phòng **và** `!phaiTrinhLanhDao(user, item)`.
  **Đây là vế KHÔNG CÒN AI ĐỂ GỬI** (chính là luật mới của mục 2).

Tách ra là để `guiDiDuyet` **báo đúng lý do**: mất quyền ⇒ **403**; có quyền nhưng không còn chặng trên
⇒ **409** «không còn ai để gửi». Gộp một hàm thì chỉ còn biết «không gửi được» và chọn bừa một mã — đã
trả giá một lần khi **TC-V4-02** nhận 409 thay vì 403. **Ẩn nút chỉ là lớp một; máy chủ vẫn chặn.**

### 4. «Hoàn thành» mở thêm ở `luu-tam` — và rào «phải có ít nhất MỘT bản»

Ẩn «Gửi đi duyệt» mà không mở lối ra là **tạo thế kẹt**: bản nháp do chính TP/PP tạo sẽ không còn đường
nào ra. Người dùng đã chọn phương án **«Ẩn nút, chỉ còn «Hoàn thành»»**, nên:

- `BANG_VERDICT['hoan-thanh']` (**920–926**): `tu: ['luu-tam', 'cho-xem', 'can-sua']` — **thêm
  `luu-tam`**; `vai` vẫn đúng `['Trưởng phòng', 'Phó phòng']`.
- **Q1 vẫn giữ nguyên:** `luu-tam` là trạng thái của nhóm **vừa mới KHAI** (tên · định dạng · tỷ lệ),
  chưa chắc đã có file. Chốt một nhóm **0 bản** là cho tiến độ lên 100% mà chưa có kết quả nào để đọc ⇒
  `verdict` ném **409** nguyên văn **«Nhóm kết quả này chưa có bản nào được lưu — không có gì để chốt»**
  (**1035–1038**), và `hanhDongDuocLam` cắt nút bằng **cùng một luật** (`coBan = nhom.trang_thai !==
  'luu-tam' || Number(soBan) > 0`, **1280–1282**) để **hàng nút không bao giờ lệch rào chặn**.
- Đường «Sửa trực tuyến» (OnlyOffice) truyền `soBan = 1` (**1702–1704**) vì đang mở MỘT bản cụ thể thì
  nhóm chắc chắn có bản — nếu không, luật MỚI-6 sẽ cắt mất hàng nút của chính màn hình đó.

### 5. Test và những gì KHÔNG đổi

- `server/tests/integration/phase8c-files.test.js`: **TC-V8-01b** (nhiệm vụ **không** tích ⇒ `apTuDong` trả
  `cho-xem`, `duocGuiBanLuu === false`, gọi thẳng API ⇒ **409**) và **TC-V8-01c** (**có** tích ⇒
  `cho-lanh-dao`). **Mọi** ca đều khẳng định `apTuDong` **không bao giờ** trả `da-duyet`. Ba file
  integration của đợt (`assignments` + `phase8c-files` + `approvals-pending-da-sua`) chạy cùng nhau:
  **84 passed**. Full `npm test`: **2076/2076 · 115 file · exit 0**.
- **KHÔNG đổi:** ba lý do của `phaiTrinhLanhDao`, van chống tự duyệt (Q5 — chỉ chặn khi là NGƯỜI THỰC
  HIỆN), luật «một người duyệt là đủ ở mọi cấp» (Q7), `approval_changes` của tỷ lệ (R4/R4'/R4''), chuông
  thông báo, OnlyOffice, lịch đẩy Zalo, và **hình dạng phản hồi RPC/REST**.
- Các mục cũ của tài liệu này (bảng «Kết quả», «Tình trạng» và «Người thực hiện» ghi ở từng bản, bản đầu
  chỉ người thực hiện trực tiếp nộp — khối «Bổ sung 12/09/2026» ngay bên dưới) **giữ nguyên hiệu lực**;
  đợt này chỉ đổi **chặng kế tiếp** và **hàng nút** của TP/PP.
## Bổ sung 12/09/2026 — «TÌNH TRẠNG» VÀ «NGƯỜI THỰC HIỆN» GHI Ở TỪNG BẢN · BẢN ĐẦU CHỈ NGƯỜI THỰC HIỆN TRỰC TIẾP NỘP (checklist 9b.24)

Người dùng chỉ đạo nguyên văn: «Sửa lại, người thực hiện trực tiếp mới được upfile đầu tiên, hiện tại
đang cho Tp up file đầu tiên / ở cột Tình trạng fiel kết quả, ghi ở từng bản tình trạng, ví dụ bị trả
về hoặc tp/pp sửa trực tiếp, PGĐ/GĐ sửa trực tiếp, lưu ý thêm tên vào nhé, phần Người thực hiện sẽ là
người duyệt hoặc người sửa đối với các bản sau, chỉ hiển thị Người thực hiện trực tiếp nếu trực tiếp
sửa lại bản bị trả về hoặc tải lên lần đầu». Hai việc, **KHÔNG có migration** (CSDL giữ `029`), buster
**`20260912-01`** ⇒ người đang test chỉ cần **Ctrl+F5**.

### 1. Bản ĐẦU của một nhóm kết quả chỉ người thực hiện trực tiếp nộp được

- **Luật mới** (`assertNguoiNopBanDau`, `taskFiles/service.js:371`): `version_no === 1` ⇒ bắt buộc đúng
  `work_items.assignee_id`. **Mọi bản sau** (sửa, nộp lại sau khi bị trả về, bản do người duyệt sửa
  trực tuyến) **vẫn theo luật cũ** — TP/PP và PGĐ/GĐ vào được.
- **Lỗ hổng cũ:** `duocGhiTheoPhanCong` mở cửa cho TP/PP **là lãnh đạo phụ trách** của nhiệm vụ, nên
  TP up được bản 1 thay cán bộ — kết quả của một nhiệm vụ mang chữ của người không làm ra nó.
- **Điều kiện viết theo SỐ BẢN, không theo «`fileId == null`»**, vì Q1 tách KHAI BÁO khỏi NỘP FILE:
  `khaiKetQua` tạo nhóm **0 bản**, nên một nhóm đã khai sẵn **vẫn sinh bản số 1** khi có người nộp
  file đầu tiên vào nó. TP khai được (nút ＋ đọc `phuTrach` + `can(create,'file')`) nhưng nộp file vào
  nhóm đó thì **403**.
- **Cả hai đường sinh bản đều bị gác:** `nop` (tải file) và `nopBaoCao` (bản chữ). Đường thứ ba,
  `luuTuCallback` của OnlyOffice, đòi một `ban` có sẵn ⇒ **luôn từ bản 2 trở đi**, không cần gác.
- **Mã lỗi:** `403 FORBIDDEN` kèm **TÊN** người thực hiện; nhiệm vụ **chưa gán** người thực hiện
  (`assignee_id` NULL — cột cho phép) ⇒ `409 CONFLICT` chứ không phải 403: thiếu dữ kiện để quyết,
  không phải thiếu quyền.
- **Giao diện nói trước thay vì để bấm rồi ăn lỗi:** `quyenFile()` trả thêm `duocNop`,
  `tenNguoiThucHien`, `thieuNguoiThucHien`; `doc()` tắt `duocSua` của nhóm 0 bản với người không phải
  `assignee` ⇒ **mục «Tải lên» biến mất**, và ô «Hành động» in câu «Bản kết quả ĐẦU TIÊN chỉ «Tên» nộp
  được». Khi bảng RỖNG hẳn thì dải chú cùng ý nằm ngay dưới đầu bảng.
- **Bẫy đã trả giá:** `tenNguoiThucHien` bản đầu đọc cột gộp `work_items.assignee_name` — cột đó chỉ
  được điền khi form gửi kèm tên, còn REST ánh xạ thẳng `assigneeId` → `assignee_id`
  (`workItems/routes.js:84`) nên nó **rỗng**; và nó thành **MỒ CÔI** khi người dùng bị xoá (FK
  `ON DELETE SET NULL` hạ `assignee_id` mà không đụng `assignee_name`). Nay tra `users` bằng
  `repo.nguoiTheoId(item.assignee_id)`, giữ `assignee_name` làm dự phòng cho dòng cũ đã thôi người
  dùng — cùng nguồn với `listNhomByItem` LEFT JOIN `users`.

### 2. Cột «Tình trạng» — ghi tình trạng CỦA BẢN, luôn kèm TÊN

Ô 9 của dòng bản 1.1/1.2 **trước đây để TRỐNG**; dòng cha kể tình trạng của CẢ NHÓM
(`cauTinhTrangFile`) nên đọc bảng không biết bản nào bị trả về, ai trả, ai sửa. Nay mỗi bản tự kể, lấy
dòng luồng **CÓ Ý NGHĨA mới nhất** của đúng bản đó (`n.luong` lọc theo `version_id` — máy chủ đã gửi
kèm nhóm nên **không gọi thêm API nào**):

| Hành động của bản | Nhãn «Tình trạng» in ra | Màu |
|---|---|---|
| `tra-ve-cbo` | Bị trả về — *Tên* | đỏ |
| `tra-ve-tp` | Bị trả về TP/PP — *Tên* | đỏ |
| `sua-truc-tuyen` | TP/PP sửa trực tiếp — *Tên* · PGĐ/GĐ sửa trực tiếp — *Tên* (ghép vai) | vàng |
| `tp-phe-duyet` | TP/PP phê duyệt — *Tên* · PGĐ phê duyệt — *Tên* (ghép vai) | tím |
| `duyet` | PGĐ đã duyệt — *Tên* (ghép vai) | xanh lá |
| `hoan-thanh` | TP/PP chốt hoàn thành — *Tên* (ghép vai) | xanh lá |
| `huy-lenh-sua` | Hủy lệnh sửa — *Tên* | xám |

Bản chưa có dòng luồng nào (vừa tải lên, chưa ai đụng) thì kể đúng việc vừa xảy ra: **«Tải lên lần đầu
— Tên»** (bản 1), **«Sửa lại bản bị trả về — Tên»** (bản ngay trước có `tra-ve-cbo`/`tra-ve-tp`), còn
lại **«Nộp lại — Tên»**. Nhãn ghép vai theo `NHAN_VAI_NGAN`: TP/PP · PGĐ · GĐ · Cán bộ.

`gom-y` **cố ý KHÔNG** là tình trạng của bản: góp ý là ý kiến bên lề, đã có cột «Ghi ý kiến» đếm; để
nó vào đây thì một câu góp ý đến sau **che mất** «Bị trả về».

### 3. Cột «Người thực hiện» — bản sau là NGƯỜI DUYỆT hoặc NGƯỜI SỬA

Ô 7 của dòng bản trước đây in cứng `ten_nguoi_nop`. Nay:

- **«Người thực hiện trực tiếp» CHỈ hiện** khi đúng người được giao nhiệm vụ (`n.assignee_id` =
  `b.uploaded_by`) **và** đó là **bản 1** hoặc **bản nộp lại sau khi bản trước bị trả về**. Dòng phụ:
  «Tải lên bản đầu tiên» / «Trực tiếp sửa lại bản bị trả về».
- **Mọi trường hợp còn lại** là người duyệt hoặc người sửa, kèm **vai viết tắt** để phân biệt: «TP/PP
  sửa trực tiếp», «PGĐ sửa», «Cán bộ sửa»…
- **Dòng dữ liệu cũ** (bản 1 do người không được giao nhiệm vụ nộp — nay máy chủ không cho nữa) vẫn
  phải đọc được, nên in **«TP/PP nộp thay»** và giải thích trong `title`: «Dữ liệu cũ: bản đầu do người
  không được giao nhiệm vụ nộp. Nay máy chủ chỉ cho chính người thực hiện nộp bản đầu.»
- **Ô 7 của DÒNG CHA** đổi nguồn sang `ten_nguoi_thuc_hien`, lùi về `ten_nguoi_tao` khi nhiệm vụ chưa
  gán người thực hiện — `title` nói rõ đó là người khai báo.
- Tên đầy đủ đẩy vào **`title`** của ô để cột không phình khi tên dài; bảng mười cột vốn đã hẹp.

### 4. Test

- **MỚI `server/tests/integration/phase8d-ban-dau.test.js` — 9 ca**: người thực hiện nộp bản 1 = 200;
  TP/PP là lãnh đạo phụ trách nộp bản 1 = 403 **và không để lại vết** (`task_files`,
  `task_file_versions`, `task_file_flow` đều 0); PGĐ/GĐ cũng 403; chưa gán người thực hiện = 409; từ
  bản 2 thì TP/PP/PGĐ/GĐ nộp như cũ; nhóm KHAI trước 0 bản vẫn là bản 1; đường «Báo cáo» bị gác y như
  đường tải file; hai cờ giao diện `doc().duocSua` và `quyenFile()`.
- **Ba ca cũ phải vá** trong `phase8c-files.test.js` — chúng dựng hiện trường bằng cách cho TP/admin
  nộp bản 1: `TC-V2-04` («TP nộp hộ») nay bắt đầu bằng khẳng định **403** rồi cho cán bộ nộp bản 1, TP
  nộp hộ **bản 2** — cặp tiến độ 50 → 80 **giữ nguyên**, vì `lanh_dao_tu_lam` đọc vai của người nộp
  **BẢN CUỐI**; `TC-V5-03` ×2 cho chính TP/PP (vừa là `assigneeId` của nhiệm vụ) nộp bản 1, giữ
  `adminApi` ở bước `gui-di-duyet` vì `duocGuiBanLuu` tha `user.role === 'admin'`.
- **Pin XSS 100 sink / 969 → 978 nội suy**, KHÔNG thêm sink và KHÔNG thêm CAN-THOAT — chi tiết ở
  `docs/XSS-4.6.md` khối trên cùng.

## ĐỢT B + bản sửa Q6 — bổ sung 11/09/2026, checklist 9b.23 (mục J)

**Mọi bảng dưới mục này là thiết kế của vòng 2026-09-01. ĐỢT B đã ĐỔI TÊN HÀNH ĐỘNG và đổi LUẬT NÚT
của TP/PP — phần này thay đúng hai chỗ đó, các phần còn lại vẫn đúng.**

- **Đổi tên hành động** (ĐIỂM 7 + ĐIỂM 9 của `KE-HOACH-DUYET-CAY.md`): `trinh-lanh-dao` →
  **`tp-phe-duyet`** (nhãn **«TP/PP phê duyệt»**, CÓ lưu mốc người duyệt `tp_duyet_boi` / `tp_duyet_luc`);
  `yeu-cau-sua` **gộp vào** `tra-ve-cbo` (nhãn **«Đẩy về Cán bộ»**). Nhật ký `task_file_flow` cũ **không
  viết lại** ⇒ đọc lịch sử vẫn thấy tên cũ, đó là cố ý.
- **Tích «Gửi BLĐ phê duyệt» (`work_items.gui_bld_phe_duyet`) NAY QUYẾT ĐỊNH TP/PP CÓ NÚT NÀO (Q6 +
  Q11).** MỘT hàm `phaiTrinhLanhDao(user, item)` (`taskFiles/service.js:785`) trả lời «nhóm này **có
  phải** trình BLĐKS không» = tích **BẬT** *hoặc* người bấm là `assignee` (Q5) *hoặc* `file:approve` của
  họ **không** phải ✓. `verdict` và `hanhDongDuocLam` đọc **CÙNG** hàm ⇒ nút trên màn hình và luật máy
  chủ không bao giờ lệch nhau:
  - **tích TẮT** + không phải `assignee` + `file:approve` ✓ ⇒ TP/PP **chỉ** thấy **«Hoàn thành / Duyệt»**
    + **«Đẩy về Cán bộ»**; gọi thẳng API `tp-phe-duyet` ⇒ **409**.
  - **tích BẬT** ⇒ **chỉ** thấy **«TP/PP phê duyệt»**; `hoan-thanh` ⇒ **403**.
  - **tích TẮT nhưng người bấm là `assignee`** (Q5) ⇒ **chỉ** «TP/PP phê duyệt»; `hoan-thanh` ⇒ **403**
    «Bạn là người thực hiện nhiệm vụ này nên không được tự chốt kết quả của chính mình…».
  - **ghi đè ⏳** ở «Duyệt kết quả (file nhiệm vụ)» ⇒ nút chốt bị ẩn và `hoan-thanh` ⇒ **403** (Q9 giữ).
  - **Luật bảo đảm: ĐÚNG MỘT đường chốt trong cả bốn tổ hợp** — không ô nào ra cả hai nút hoặc mất cả hai.
- **Van chống tự duyệt đã NỚI**: bỏ hẳn điều kiện «người lưu bản cuối» (`uploaded_by` của bản mới nhất).
  TP «Sửa trực tuyến» xong **vẫn chốt được** khi tích TẮT và họ không phải `assignee`. Lý do nới: van cũ
  biến TP thành người **không còn đường kết thúc file trong phòng** — chính là lỗi người dùng bắt được
  trên nhiệm vụ `CV002-002`.
- **Nút chốt nay CÓ ô ghi chú, nhưng TUỲ CHỌN** — đọc đúng ô «Ý kiến» sẵn có của khối file, không bật hộp
  thoại hỏi thêm; máy chủ lưu vào `task_file_flow.noi_dung` và nối vào thông báo chuông (`Ghi chú: …`).
  Trang **«Hàng chờ phê duyệt»** cố ý **không** có ô này ⇒ nút chốt ở đó không gửi ghi chú.
- **Bật tích đòi BLĐKS**: `assertGuiBld` (`assignments/service.js:487`) ném **400** «Nhiệm vụ chưa có Ban
  lãnh đạo kiểm soát để gửi phê duyệt» khi tích BẬT mà cả nhiệm vụ lẫn công việc cha đều trống
  `supervisor_ids` ⇒ phải khai BLĐKS **cùng lúc** với tích, và khai lúc **TẠO** (sửa nhiệm vụ trên cây đã
  duyệt thì Q9 hạ cây về `Chờ duyệt` và Q2 **khoá luôn cửa nộp file**).
- **KHÔNG có migration cho bản sửa này.** Chỉ mã máy chủ + `app.js`, buster **`20260911-04`** ⇒ người đang
  test chỉ cần **Ctrl+F5**. Test tự động **2034/2034 · 113 file · exit 0**. Chi tiết đầy đủ:
  `KE-HOACH-DUYET-CAY.md` **§11.6**; bấm thử: `HUONG-DAN-TEST-GIAO-DIEN.md` **§9b.23 mục J**.

## Hoàn thành theo kết quả đã duyệt — bổ sung 10/09/2026, checklist 9b.18

- Nhiệm vụ hoàn thành khi **có ít nhất một nhóm kết quả**, mọi nhóm **có bản** và đều kết thúc
  ở `hoan-thanh` hoặc `da-duyet`. Bản “Báo cáo” cũng là một bản kết quả hợp lệ.
- Chưa có nhóm/chưa có bản/chưa duyệt đủ thì chưa hoàn thành. Trọng số 0 không miễn yêu cầu duyệt.
  Không suy hoàn thành từ `tien_do === 100`: mốc cấu hình và làm tròn có thể cho 100 khi chưa chốt.
- Tiến độ vẫn gia quyền theo NHÓM, không đếm phiên bản. Cấp 2 gia quyền nhiệm vụ con;
  cấp 1 gia quyền đầu mục. Cấp cha hoàn thành chỉ khi có con và tất cả con hoàn thành.
- `ganTienDo` thêm `hoan_thanh`, `hoan_thanh_luc`, `ket_qua_files`; cây/statistics/Gantt/export/cron
  không còn lấy `status`/`completion` tay làm nguồn hoàn thành. Ngày thống kê lấy lần duyệt bản mới nhất.
- `tong/xong` giữ nghĩa bộ đếm cũ; thêm `daDuyetCoBan` cho luật hoàn thành. Không migration mới.
- Bỏ checkbox hoàn thành, bộ lọc và trường chọn trạng thái tay ở cả ba cấp. Trạng thái phê duyệt
  công việc và luồng file vẫn giữ. `status`/`completion` trong DB/RPC chỉ giữ tương thích/lịch sử,
  payload hợp lệ từ client cũ không còn ghi đè chúng. Các khóa RPC cũ không bị xóa.
- Tab Nhiệm vụ có hàng file dưới từng nhiệm vụ, bỏ cột Link kết quả. Bảng modal từ **8 lên 10 cột**:
  Thời gian / Kết quả làm được / Định dạng / File đã tải lên / **Tỷ lệ công việc (%) / Tiến độ** /
  Người thực hiện / Ghi ý kiến / Tình trạng / Hành động. Phiên bản và panel thẳng cùng lưới.
- Ô ngày nhập tay đổi nhãn **Ngày báo cáo**; giữ khóa legacy “Ngày hoàn thành”, không dùng để chốt việc.
- Sửa thêm tiến độ thẻ Công việc/danh sách thống kê/modal fallback còn trung bình cả cấp 2+3:
  dùng chung `tienDoDauMucKhach`; số 25×40 + 75×80 chia 100 phải bằng 70%, không phải 40%.
- Bản giao diện **20260910-10**, XSS **98/929**. Checklist nghiệm thu mới: **9b.18**.
  Các mục bên dưới là thiết kế/kiểm chứng lịch sử; phần này thay quy tắc hoàn thành và bố cục cũ.

## Cập nhật V1–V8 — 10/09/2026 (chờ nghiệm thu)

Quy trình mới: tải file/báo cáo → **Lưu tạm (mặc định 0%)** → **Gửi đi duyệt**.
Bản nháp chỉ người tạo nhóm/admin thấy ở hàng chờ, không báo lãnh đạo. Bản đáp ứng lệnh sửa
được gửi thẳng theo lệnh. Mỗi nhóm có tỷ lệ; tiến độ gia quyền theo nhóm, không theo số phiên bản.
Mốc mặc định 0/20/40/50/80/100 lưu trong `system_settings`, admin sửa được ở Phân quyền hệ thống.

Định dạng nhận bản mới: Word (.doc/.docx), Excel (.xls/.xlsx), PPT (.ppt/.pptx), PDF (.pdf, chỉ xem),
Ảnh (.jpg/.jpeg/.png/.gif/.webp), Báo cáo (chữ nhập trực tiếp). Kiểm tại mọi cửa ghi máy chủ;
bản lịch sử sai định dạng vẫn xem/tải được. Xem bảng chi tiết và giả định trong báo cáo V1–V8.

V5 trả tên người nhận kèm vai và số lần trả lại; TP/PP là người thực hiện khác lãnh đạo phụ trách
vẫn sửa/gửi theo lệnh, nhưng không được tự Hoàn thành. V6 đặt ý kiến **trước editor**;
forcesave → callback ghi bản → receipt → verdict đúng `versionId`. TP sửa chỉ trình PGĐ.
Callback nạp quyền hiện hành trước khi ghi; không thông báo nháp.

V7: Cán bộ chọn Gửi BLĐ lúc tạo. Bật: TP/PP xem ở 40% → trình đúng `supervisor_id` ở 80% → 100%.
Tắt: TP/PP xem ở 50% → có thể chốt 100%. TP/PP trực tiếp luôn lên PGĐ nên khóa tích.
Đổi tích mặc định chờ đề nghị trong `approval_changes`; admin tắt Q2 thì ✓ áp ngay, ⏳ vẫn chờ.
Không thêm ô chọn người hoặc cột người mới.

Full **1946/1946**, lint exit 0; UAT đã UP 024–027, buster **20260910-7**, live check exit 0.
Đã thấy tài liệu thật trong OnlyOffice, không còn ý kiến đè toolbar; **chưa kiểm đủ chuỗi lưu/duyệt
với DS thật**, chưa nghiệm thu. Bấm checklist **9b.17**; không reset/seed hoặc commit/push/deploy.

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
| Nút chốt «Hoàn thành / Duyệt» của TP/PP (khi `file:approve` = ✓) ghi **trạng thái nào**? | **Ghi `hoan-thanh` + dòng flow `hoan-thanh`** — TP/PP hoàn thành luôn, không cần trình ai; **`da-duyet` (xanh đậm) chỉ do Phó GĐ/GĐ bấm «Duyệt» hoặc TỰ ĐỘNG theo phân quyền ✓**. Đúng nghĩa «Hoàn thành luôn» mục 2(c), dùng đủ 5 trạng thái. **Bổ sung 11/09/2026 (Q6/Q11):** nút này nay **chỉ tồn tại khi nhiệm vụ KHÔNG bật tích «Gửi BLĐ phê duyệt»** và người bấm không phải `assignee` — xem mục **ĐỢT B + bản sửa Q6** ở đầu tài liệu |
| Bổ sung 2026-09-01 (trả lời §13.4 mục 21–24) | **(21)** «Trình» = TP/PP **tự chọn** thời điểm — đúng cách đã làm; **(22)** 20 MB OK; **(23)** CÓ editor trực tuyến — session sau theo OnlyOffice (§7), **mọi lần sửa file phải LƯU LẠI thành bản mới trong cùng nhóm để xem được**; **(24)** các dạng Word (.doc VÀ .docx) đều cho sửa + xem trực tuyến |
| Bổ sung 2026-09-01 («cho thêm phần Ý kiến vào») | Khối file có ô **«Ý kiến»** riêng: nhập ý kiến → «Gửi ý kiến» ghi vào **BẢN MỚI NHẤT** của nhóm; các nút Yêu cầu sửa / Trình / Trả về đọc ô này trước (đủ 10 ký tự thì không hỏi lại) |

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

> **Sơ đồ trên vẽ vòng 2026-09-01, nay phải đọc thêm một điều kiện (Q6, 11/09/2026):** mũi tên
> «Trình (TP/PP)» → `cho-lanh-dao` (nay là **«TP/PP phê duyệt»**) **chỉ có** khi nhiệm vụ **bật** tích
> «Gửi BLĐ phê duyệt»; khi tích **tắt** và người bấm không phải `assignee`, TP/PP đi thẳng mũi tên
> «Hoàn thành / Duyệt» → `hoan-thanh` và **không còn** đường lên `cho-lanh-dao`.

| Trạng thái | Nghĩa | Ai đang giữ file | Nhãn / màu badge |
|---|---|---|---|
| `cho-xem` | Chờ TP/PP xem (mặc định sau nộp của Cán bộ) | TP/PP phòng của công việc | vàng |
| `can-sua` | Lệnh sửa cho đúng chủ; lưu nội dung chưa phải gửi duyệt | `lenh_sua_cho=can-bo`: người được giao; `lanh-dao`: TP/PP trong `leader_ids` | hổ phách ở tab Yêu cầu sửa; badge modal cũ giữ nguyên |
| `cho-lanh-dao` | Chờ Phó GĐ phụ trách / GĐ xử | PGD phụ trách (fallback GĐ) | tím |
| `hoan-thanh` | TP/PP chốt «Hoàn thành / Duyệt» — **chỉ khi tích «Gửi BLĐ phê duyệt» TẮT** và người chốt không phải `assignee` (Q6/Q11) | — (kết thúc) | xanh |
| `da-duyet` | PGD/GĐ bấm «Duyệt» hoặc TỰ ĐỘNG theo phân quyền | — (kết thúc) | xanh đậm |

| Từ | Hành động | Ai (điều kiện) | Đến | Flow ghi | Thông báo tới |
|---|---|---|---|---|---|
| — | nộp bản mới | người được giao nhiệm vụ / TP/PP / PGD / GĐ theo trạng thái (§2, §4) | `cho-xem` (Cán bộ ⏳) · `cho-lanh-dao` (TP/PP ⏳) · `da-duyet` (✓) | `nop` (+ `duyet-tu-dong` nếu ✓) | TP/PP phòng (`cho-xem`) · PGD phụ trách (`cho-lanh-dao`) · người nộp + TP/PP (tự động) |
| `cho-xem`/`can-sua` | góp ý | TP/PP + PGD phụ trách + GĐ/admin | giữ nguyên | `gom-y` | — (thread hiện tại chỗ) |
| `cho-xem`/`can-sua` | Yêu cầu sửa (nội dung ≥ 10 ký tự) — **ĐỢT B gộp vào «Đẩy về Cán bộ», không còn hành động riêng** | TP/PP | `can-sua`, lệnh `can-bo` | `yeu-cau-sua` (cũ) / `tra-ve-cbo` (nay) | người được giao nhiệm vụ |
| `cho-xem`/`can-sua` | **TP/PP phê duyệt** (nội dung ≥ 10 ký tự) — tên cũ «Trình Phó giám đốc», **ĐỢT B đổi tên `trinh-lanh-dao` → `tp-phe-duyet` và lưu mốc người duyệt**; **chỉ tồn tại khi nhiệm vụ PHẢI trình BLĐKS** (tích BẬT, hoặc người bấm là `assignee`, hoặc `file:approve` ≠ ✓) | TP/PP | `cho-lanh-dao` | `tp-phe-duyet` | PGD phụ trách phòng |
| `cho-xem`/`can-sua` | Hoàn thành / Duyệt (**ghi chú TUỲ CHỌN** từ 11/09/2026 — để trống vẫn chốt được) | TP/PP khi `file:approve` = ✓ **VÀ nhiệm vụ KHÔNG bật tích «Gửi BLĐ phê duyệt» VÀ người bấm không phải `assignee`** (Q5/Q6/Q11) | `hoan-thanh` | `hoan-thanh` | người nộp + TP/PP phòng |
| `cho-xem`/`cho-lanh-dao`/`can-sua` | Đẩy về Cán bộ (nội dung không bắt buộc) | TP/PP phụ trách | `can-sua`, lệnh `can-bo` | `tra-ve-cbo` | người được giao nhiệm vụ |
| `cho-lanh-dao` | Trả về TP/PP (nội dung ≥ 10 ký tự) | PGD phụ trách / GĐ/admin | `can-sua`, lệnh `lanh-dao` | `tra-ve-tp` | TP/PP trong `leader_ids` |
| `cho-lanh-dao` | Duyệt (không cần nội dung) | PGD phụ trách / GĐ/admin khi `file:approve` = ✓ | `da-duyet` — KHÓA | `duyet` | người nộp + TP/PP phòng |

## 2. Ánh xạ 2 hàng phân quyền → từng cửa

Nghĩa của giá trị **cho vai người ở ô đó**, đọc lúc hành động diễn ra (`giaTriHieuLuc` — ma trận +
`user.ghiDe`; hiệu lực NGAY vì `attachSession` nạp lại mỗi request):

| Hàng | Giá trị | Nghĩa | Hiệu ứng cụ thể |
|---|---|---|---|
| «Nộp kết quả (file nhiệm vụ)» `file:create` | `⏳ Chờ duyệt` — **mặc định Cán bộ, TP/PP** | phải gửi đi duyệt | Nộp xong: Cán bộ → `cho-xem`; TP/PP → `cho-lanh-dao` (lãnh đạo của họ là PGD/GĐ) |
| | `✓ Cho phép` | phê duyệt luôn | Nộp xong nhóm chuyển thẳng `da-duyet` + dòng flow `duyet-tu-dong` «Tự động — phân quyền không yêu cầu duyệt». KHÔNG gửi TP/PP/PGD |
| | `✕ Tắt` | không nộp được | 403 kèm câu rõ |
| «Duyệt kết quả (file nhiệm vụ)» `file:approve` | `✓ Cho phép` — **mặc định admin (GĐ), PGD, TP/PP** | nút «Duyệt kết quả»/«Hoàn thành / Duyệt» là chốt luôn | TP/PP có nút «Hoàn thành / Duyệt» (→ `hoan-thanh`) **nhưng chỉ khi nhiệm vụ KHÔNG bật tích «Gửi BLĐ phê duyệt» và họ không phải `assignee`** (Q6/Q11); ngược lại chỉ còn «TP/PP phê duyệt» (→ `cho-lanh-dao`). PGD/GĐ có nút «Duyệt» (→ `da-duyet`) |
| | `⏳ Chờ duyệt` (TP/PP) | bắt buộc qua cấp trên | Nút «Hoàn thành / Duyệt» của TP/PP **ẨN** và gọi API ⇒ **403** «Quản trị đã đặt «⏳ Chờ duyệt» ở ô «Duyệt kết quả (file nhiệm vụ)» cho vai của bạn — hãy dùng «TP/PP phê duyệt» hoặc «Đẩy về Cán bộ».» — chỉ còn **«Đẩy về Cán bộ»** + **«TP/PP phê duyệt»** (tên cũ «Yêu cầu sửa» + «Trình Phó giám đốc/GĐ»; ⏳ là **một trong ba** lý do phải trình, hai lý do kia là tích BẬT và người bấm là `assignee`) |
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
  `GET /api/v1/permissions` — khuôn `oPhanQuyenHieuLuc`): TP/PP thấy «Đẩy về Cán bộ» + **ĐÚNG MỘT** trong
  hai nút «TP/PP phê duyệt» / «Hoàn thành / Duyệt» — chọn nút nào do `phaiTrinhLanhDao` quyết (tích «Gửi
  BLĐ phê duyệt», có phải `assignee`, `file:approve`) và trạng thái; PGD/GĐ
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
trình PGD ⇒ thông báo PGD phụ trách · 08 PGD trả về TP (nội dung ≥ 10) ⇒ `can-sua` + lệnh `lanh-dao` · 09 TP nộp
chính mình (`⏳`) ⇒ `cho-lanh-dao` · 10 TP đẩy về Cán bộ ⇒ `can-sua` · 11 TP `file:approve` = ✓ ⇒
«Hoàn thành / Duyệt» chốt `hoan-thanh`; = ⏳ ⇒ 403 · 12 PGD Duyệt ⇒ `da-duyet` khóa (nộp tiếp 409)
· 13 Cán bộ không verdict ⇒ 403; vai ngoài phòng 403 · 14 sai loại file/quá 20MB ⇒ 400.

> **Cập nhật 11/09/2026 (Q6/Q11) — bốn ca trên nay chạy với `guiBldPheDuyet: true`:** TC-TF-07, 09, 11
> (nhánh ⏳) và TC-V4-09 phải **bật tích** lúc tạo nhiệm vụ (kèm `supervisorIds`, vì `assertGuiBld` đòi
> BLĐKS) thì mới còn đường `tp-phe-duyet` / mới đúng lý do 403. TC-TF-11 nhánh ✓ nay đo trên nhiệm vụ
> **tắt** tích. Lý do 403 của `hoan-thanh` **đã đổi**: không còn «người lưu bản cuối» mà là **guard Q6**
> (tích BẬT) hoặc **guard Q5** (người bấm là `assignee`) hoặc **ghi đè ⏳**. Chi tiết ở
> `KE-HOACH-DUYET-CAY.md` §11.6.3–11.6.4.

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

**Yêu cầu người dùng chốt kèm (2026-09-01):**
1. **Các dạng Word (.doc VÀ .docx) đều cho sửa + xem trực tuyến** — ONLYOFFICE mở `.docx` nguyên
   bản; `.doc` legacy đi qua **conversion service** (chuyển về `.docx` để sửa) hoặc mở hạn chế tùy
   phiên bản — kiểm trên bản dựng thật trước khi hứa với người dùng cuối.
2. **Mọi lần sửa file đều phải LƯU LẠI để xem được**: callback-save ghi thành BẢN MỚI trong cùng
   nhóm (không ghi đè, không để chỉnh sửa treo trong bộ nhớ editor) — bảng luồng ghi dòng
   «Nộp bản N» kèm người sửa, đúng luật «lưu lại để xem».

## 8. Câu hỏi chờ người dùng — đã ghi vào §13.4 `KE-HOACH-VPS.md` (mục 21–24)

1. **(mục 21)** Trình lên TỰ ĐỘNG cho PGD phụ trách (fallback GĐ) hay TP/PP tự chọn thời điểm? —
   mặc định **TỰ ĐỘNG** (`department_managers` như luồng duyệt hiện có; phòng không có PGD phụ trách
   thì không ai được báo, admin vẫn duyệt được).
2. **(mục 22)** Giới hạn file — mặc định `.doc/.docx/.pdf`, ≤ **20 MB**, mỗi lần nộp là một bản mới.
3. **(mục 23)** RAM/HTTPS của VPS cho editor trực tuyến (AIO cần domain + ~2–4 GB; OnlyOffice nhẹ hơn).
4. **(mục 24)** `.doc` cũ có cần xem trực tuyến không — mặc định **chỉ tải về** (PDF xem iframe; DOCX editor là việc sau).

## 9. Giả định đã chọn trong session (người dùng có thể đổi — mỗi ý là 1 dòng code/test)

| # | Giả định | Trạng thái |
|---|---|---|
| 1 | TP/PP chốt = `hoan-thanh`; `da-duyet` chỉ do PGD/GĐ hoặc tự động | ✅ người dùng chốt (§0) |
| 2 | PGD/GĐ nộp file (hiếm): giá trị hiệu lực `file:create` mặc định = ✓ ⇒ nộp là tự động chốt | ✅ chấp nhận 2026-09-01 |
| 3 | 2 hàng file là dropdown cho cả 3 vai như hàng thường, nhưng option `⏳` chỉ có ở `file:create` × (Cán bộ, TP, PP) và `file:approve` × (TP, PP) | ✅ chấp nhận 2026-09-01 |
| 4 | PGD «Trả về TP/PP» ⇒ `can-sua` + `lenh_sua_cho=lanh-dao`; TP/PP nhận lệnh vàng, gửi bản mới nhất hoặc đẩy tiếp về Cán bộ | ✅ đổi hành vi có chủ ý trong Phase 8b ngày 2026-09-08; thay quyết định `cho-xem` ngày 2026-09-01 |
| 5 | «Đẩy về Cán bộ» (`tra-ve-cbo`) KHÔNG bắt buộc nội dung | ✅ chấp nhận 2026-09-01 |
| 6 | «Trình» = TP/PP tự chọn (mục 21) | ✅ chốt — khớp cách đã làm |
| 7 | Ô **«Ý kiến»** trong khối file: gửi vào bản mới nhất; nút Yêu cầu sửa/Trình/Trả về đọc ô này trước khi hỏi lại (người dùng yêu cầu «cho thêm phần Ý kiến vào») | ✅ đã làm (TCKQ-14/15) |

## 11. ONLYOFFICE ĐÃ NHÚNG THẬT (2026-09-02) — theo `docs-api/get-started/basic-concepts` + `usage-api/config`

Người dùng báo **«KO THẤY MÀN HÌNH SỬA»** và đưa link tài liệu Docs API. Đo trước khi sửa (đường
`/task-file-versions/:id/editor` trả **200**, HTML đúng, `DocsAPI` khởi tạo đúng cú pháp) rồi tìm ra
**HAI lỗi xếp lớp** — cái nào cũng cho ra đúng triệu chứng «trang trắng»:

**Lỗi 1 — CSP của `helmet()` chặn `api.js` của Document Server.** `helmet()` đặt
`script-src 'self'` cho **mọi** phản hồi. Trang editor bắt buộc nạp
`http://<DS>/web-apps/apps/api/documents/api.js` (đúng đường dẫn tài liệu quy định), origin khác ⇒
trình duyệt **chặn thẻ script**, biến `DocsAPI` không tồn tại, `new DocsAPI.DocEditor(...)` ném
`ReferenceError` **trong tab Console** còn trên màn hình chỉ là khoảng trắng. Sửa: `cspEditor(dsUrl)`
+ `res.setHeader('Content-Security-Policy', …)` cho **đúng một** đường editor — nới `script-src`,
`frame-src` (DocEditor dựng `<iframe>` trỏ DS), `connect-src` (+`ws:`/`wss:` cho kết nối lưu),
`img-src`/`style-src`/`font-src`/`media-src`; đồng thời bỏ `Cross-Origin-Embedder-Policy` và đặt
`Cross-Origin-Resource-Policy: cross-origin`. Phần còn lại của API **giữ CSP chặt như trước**.

**Lỗi 2 — `/raw/:id` làm SẬP CẢ MÁY CHỦ khi file không có trên đĩa.**
`createReadStream(duong).pipe(res)` với đường dẫn không tồn tại phát sự kiện `'error'` **không ai
bắt** ⇒ Node ném «Unhandled error event» và **tiến trình chết**. Gặp ngay ở bộ seed Vòng 14: seed chỉ
tạo dòng CSDL, NV-02..05 không có file thật. Người dùng bấm ✎ → DS gọi `/raw` → máy chủ sập → mọi
thứ khác cùng chết, nên triệu chứng nhìn như «editor không mở». Sửa: `access()` kiểm trước ⇒ **404**
gọn, cộng listener `'error'` trên stream cho trường hợp file mất **giữa lúc** đang truyền.

**Sửa thêm theo tài liệu** (`usage-api/config/document`):
- `documentType` **không được ghi cứng `'word'`** — bảng `DOCUMENT_TYPE_THEO_DUOI` cho `pdf → 'pdf'`,
  `doc/docx → 'word'`. Seed có `.pdf` nên lỗi này gặp ngay ở NV-05.
- `document.key` phải **đổi khi nội dung đổi**, giới hạn 128 ký tự, chỉ `0-9 a-z A-Z -._=`
  (tài liệu nói rõ: key trùng ⇒ DS lấy lại bản trong **cache** của nó). Nay ghép
  `tf-<idBản>-<kíchThước>-<mốcNộp>` rồi `.slice(0, 128)`: mở lại cùng bản thì key ổn định (vào đúng
  phiên đang sửa), lưu ra bản mới thì id khác ⇒ key khác.
- Thêm `events.onAppReady` / `onError` / `onRequestClose` + khối `#loi` trên trang: **mọi** đường
  thất bại nay hiện một câu tiếng Việt kèm 3 bước cần kiểm, thay vì trang trắng không lời giải thích.

**Đã kiểm chứng đầu-cuối, không qua trình duyệt** (`tools/_tam-ds*.mjs`, đã xoá sau khi dùng):
nộp `.docx` thật vào NV-01 → `GET .../editor` **200** với `script-src … http://localhost` →
`docker exec busy_merkle wget <raw url>` → **HTTP 200, 7726 byte** → gọi `POST /ConvertService.ashx`
của DS với JWT ký bằng `ONLYOFFICE_JWT_SECRET` → DS trả **`fileUrl`** (không phải `error`). Ba việc
đó chứng minh cùng lúc: JWT hai bên **trùng secret**, DS **tải được** file từ app qua
`host.docker.internal:3000`, và DS **đọc được** nội dung. Editor dùng đúng ba đường ấy.

**Test canh**: TC-TF-16 (CSP có origin DS ở `script-src`/`frame-src`/`connect-src`; không có COEP;
CORP `cross-origin`; có `onerror=`/`onAppReady`; `documentType` theo đuôi cho cả docx và pdf),
TC-TF-17 (`/raw` thiếu file ⇒ 404 **và** `/healthz` vẫn 200 — tức máy chủ còn sống).
`vitest.config.js` nay đặt 3 biến `ONLYOFFICE_*` giả để tính năng **bật** trong test, nếu không thì
route trả trang «chưa bật» và lỗi màn-hình-trắng lọt qua cổng test.

**Bẫy còn lại cho người deploy**: `ONLYOFFICE_URL` là địa chỉ **trình duyệt** gọi DS;
`ONLYOFFICE_CALLBACK_BASE` là địa chỉ **DS gọi ngược** về app — hai giá trị này **khác nhau** khi DS
chạy trong Docker (`http://localhost` và `http://host.docker.internal:3000`). Và app phải nghe trên
cổng mà container với tới được: máy chủ **tắt** thì DS báo lỗi tải file, không phải lỗi cấu hình.
## 12. VÒNG CUỐI 5 (2026-09-02) — lỗi «không lưu được», tên file mất dấu, nút Lưu, hàng chờ phê duyệt

Người dùng gửi ảnh hộp thoại của ONLYOFFICE: **«Không thể lưu tài liệu. Vui lòng kiểm tra cài đặt
kết nối hoặc liên hệ với quản trị viên của bạn.»** kèm 4 yêu cầu. Từng cái một:

### 12.1 Lỗi «không lưu được» — phản hồi callback sai HÌNH DẠNG (không phải sai kết nối)

Hộp thoại nói «kiểm tra kết nối» nên rất dễ đi tìm sai chỗ (mạng, cổng, JWT). Log của Document
Server chỉ đúng nguyên nhân:

```
sendServerRequest returned an error: data = {"ok":true,"data":{"error":0,"boQua":false,"version":{…}}}
```

Route `/callback/:id` trả qua `ok()` của §5.3 ⇒ `{"ok":true,"data":{"error":0}}`. Tài liệu
«Callback handler» đòi thân phản hồi là **đúng `{"error":0}` ở CẤP CAO NHẤT**; DS không thấy khoá
`error` nên coi là **lưu thất bại**, hiện hộp cảnh báo rồi `storeForgotten`. Trong khi đó bản mới
**vẫn được lưu** (nên «Lịch sử» có bản mới) — chính điều đó làm lỗi khó lần: người dùng thấy cảnh
báo, còn dữ liệu thì đúng.

Sửa: callback trả `res.status(200).json({ error: 0 })` — **ngoại lệ có chủ ý của §5.3**, vì đây là
đường máy-đối-máy đi theo hợp đồng của DS chứ không phải API của giao diện. Ghi rõ lý do ngay trên
route để không ai «sửa cho nhất quán». Canh bằng **TC-TF-18** (status 1 ⇒ `{error:0}` và **không
có** khoá `ok`; status 2 với url rác ⇒ `{error:1, message}`; token sai ⇒ vẫn 200 + `error:1`).

### 12.2 Tên file mất dấu tiếng Việt — busboy giải bằng latin1

`BÀI 2.docx` hiển thị thành `BÃ€I 2.docx` ở khối «Kết quả», tiêu đề trang sửa và trong thông báo.
Trình duyệt gửi `filename` trong Content-Disposition của multipart dưới dạng **UTF-8**, busboy (nhân
của multer) giải bằng **latin1**. multer 2.x không có tuỳ chọn đổi bảng mã ⇒ gỡ ngược tại **một
chỗ duy nhất**: `tenGocUtf8()` trong service, gọi ở `nop()`.

Ba lớp canh để không làm hỏng tên vốn đã đúng: (1) toàn ASCII ⇒ trả nguyên; (2) có ký tự mã > 0xff
⇒ chuỗi đã là UTF-8 đúng, trả nguyên; (3) giải ra có `U+FFFD` ⇒ không phải UTF-8, trả nguyên.
Viết bằng `codePointAt` chứ không phải regex `[^\u0000-\u00ff]` — lớp phủ định đó chứa `\x00` nên
eslint `no-control-regex` chặn (đúng luật). Canh bằng **TC-TF-19**, đi qua đường thật (FormData →
multer → CSDL) nên nếu hàm gỡ hỏng thì đỏ ngay, cộng 3 phép kiểm trực tiếp cho ba lớp trên.

### 12.3 «Sửa xong lưu lại vào nhiệm vụ kiểu gì» — thêm nút «Lưu thành bản mới»

Docs API **không có** phương thức JS nào bắt editor lưu (danh sách methods chỉ có `downloadAs`,
`requestClose`, …). Cách chính thức là **command service**: `POST {dsUrl}/command` với thân
`{c:'forcesave', key, userdata}` + `token` là JWT của chính thân đó; DS lưu xong sẽ gọi
`callbackUrl` với `status=6` ⇒ `luuTuCallback` tạo **bản mới**.

Trang editor nay có **thanh trên**: tên nhiệm vụ (mã + tên) · tên file · nút **«Lưu thành bản mới»**
· nút **«Đóng»**, kèm dòng trạng thái báo «Đang lưu…» / «Đã lưu thành bản mới» / câu lỗi. Nút gọi
`POST /api/v1/task-file-versions/:id/save` (service `luuNgay`), dịch 6 mã lỗi của DS sang câu tiếng
Việt nói rõ phải làm gì; **mã 4 = «chưa có thay đổi nào»** không phải lỗi. `document.key` chuyển
thành hàm `khoaDs(ban)` dùng chung, vì lệnh forcesave **phải gửi đúng key** mà editor đang mở.
Người chỉ được xem thì không có nút này (`duocSuaTrucTiep` = false ⇒ hiện chữ «Chỉ xem»).

### 12.4 Lãnh đạo phòng phụ trách là người xem/sửa/duyệt và NHẬN THÔNG BÁO

Trước đây danh sách người nhận đọc **chỉ** từ `users` (vai TP/PP + `department_id`). Người được
**gắn phụ trách phòng** ở `department_managers` với vai `'head'`/`'vice'` mà `users.role` không phải
TP/PP thì **không hề biết** có file mới. Thêm `repo.lanhDaoPhuTrach(phongId)` gộp hai nguồn
(`DISTINCT` theo id, **không** lấy `'deputy_director'` — đó là Phó Giám đốc, đã có hàm riêng), dùng
ở cả `nop()` và `thongBaoVerdict()`.

Sửa trực tuyến cũng gửi thông báo (yêu cầu «đồng thời nhận được thông báo về sửa file»):
`luuTuCallback` đọc `users[0]`/`actions[0].userid` của DS để biết **ai vừa sửa** — trước đây bản mới
ghi cứng `uploaded_by = ban.uploaded_by` và vai `'Nhân viên'`, nên Trưởng phòng sửa file của cán bộ
thì «Lịch sử» hiện **tên cán bộ với vai Nhân viên**. Nay ghi đúng người + đúng vai, hành động mới
`'sua-truc-tuyen'` (migration **015** nới CHECK của `task_file_flow`, down hạ dữ liệu trước khi siết
— bẫy đã gặp ở 012/014), và báo cho lãnh đạo phòng + người nộp bản trước. Id lạ (phiên cũ, dữ liệu
rác) thì lùi về người nộp bản đang sửa: không bao giờ để `uploaded_by` trỏ vào id không tồn tại.

### 12.5 Tách «Hàng chờ phê duyệt» thành trang riêng, 2 tab con

Mục mới trên thanh điều hướng (`#nav-cho-duyet`, có badge số) mở trang `#cho-duyet-section`:

| Tab | Nội dung | Nguồn |
|---|---|---|
| Công việc / Nhiệm vụ | **chuyển nguyên** khối `#approvals-panel` + hộp «Yêu cầu XOÁ» từ trang Công việc sang (giữ id nên mọi hàm render/nút cũ chạy y như trước) | `GET /approvals/pending` + `/pending-deletes` |
| Phê duyệt kết quả | nhóm file 014 đang chờ **chính người này** xử | `GET /task-files/cho-duyet` (mới) |

Ai thấy gì ở tab 2 (khớp `BANG_VERDICT`, phạm vi bó trong SQL — **không** có luật quyền thứ hai):
TP/PP thấy `cho-xem`+`can-sua` của **phòng mình**; Phó GĐ thấy `cho-lanh-dao` của **các phòng mình
phụ trách**; admin thấy cả ba, mọi phòng; vai khác **rỗng**. Máy chủ trả kèm `hanhDong[]` — đúng
những nút vai đó bấm được, tính lại bằng `BANG_VERDICT` + `giaTriHieuLuc` (admin đặt ⏳ ở «Duyệt
kết quả» ⇒ mất nút chốt ngay trong hàng chờ). Mỗi dòng có ⬇ tải · ✎ sửa trực tuyến · các nút
verdict · bấm tên nhiệm vụ để mở modal nhiệm vụ. **Không** để lại bản sao `#approvals-panel` ở
trang Công việc: hai khối cùng id thì `getElementById` chỉ thấy một cái, người dùng bấm cái kia sẽ
tưởng nút chết.

Test: **TC-HCPD-01..04** (phạm vi TP · dòng chuyển sang PGD sau «Trình» và rời hàng chờ của TP ·
file đã chốt rời hàng chờ của mọi người + ⏳ làm mất nút chốt · người gắn `'head'` nhận thông báo)
và **TCKQ-16..19** (builder dòng, ONLYOFFICE tắt ⇒ ẩn ✎, escape HTML, đổi tab chỉ một panel hiện).

### 12.6 Đã kiểm chứng đầu-cuối bằng chính Document Server

Không qua trình duyệt, script tạm đã xoá sau khi dùng:

1. Nộp `.docx` có dấu → CSDL giữ **đúng** `Báo cáo KẾT QUẢ — Đợt 1 (bản chính).docx`; trang editor
   hiện đúng tên đó ở cả thanh trên và `document.title` của config.
2. `GET /raw/<ban>?token=…` → **200, 18278 byte**.
3. `POST http://127.0.0.1/ConvertService.ashx` với JWT ký bằng `ONLYOFFICE_JWT_SECRET`, `url` trỏ
   `host.docker.internal:3000` → DS trả **`fileUrl`** thật.
4. `POST /callback/<ban>` với `status=6`, `url` = `fileUrl` đó, `users=[id Trưởng phòng]` →
   **`{"error":0}`** → CSDL: **v1(Lê Thị Nhân), v2(Trần Thị Trưởng)**; dòng luồng
   `sua-truc-tuyen/Trưởng phòng/Trần Thị Trưởng`; thông báo gửi cho **Lê Thị Nhân** (người nộp bản
   trước) và **Ngô Văn Phó** (Phó phòng — lãnh đạo phòng phụ trách).

Bốn bước đó đi qua **đúng** những đường mà nút «Lưu thành bản mới» dùng.

**Bẫy mới ghi lại**: `fetch` của Node 24 phân giải `localhost` sang `::1` trước, container DS chỉ
bind IPv4 ⇒ `ECONNRESET` **dù** `/healthcheck` trả `true`. Khi gọi DS từ script Node phải dùng
`127.0.0.1`. (Trình duyệt không bị: nó thử cả hai họ địa chỉ.)

**Bẫy CSDL**: máy chủ dev có thể đang nối `quanlycongviec_uat` (như `chay.bat` đặt) hoặc
`quanlycongviec` (theo `deploy/.env`) — **hai CSDL khác nhau, hai bộ tài khoản khác nhau**. Bộ seed
Vòng 14 (`gd/pgd/tp/pp/nv1/nv2/nvb@test.local`) nằm ở `quanlycongviec`; `quanlycongviec_uat` là bộ
cũ `admin/tp01/nv01@test.local`. Đăng nhập trượt 401 mà mật khẩu đúng thì kiểm CSDL trước khi kiểm
mật khẩu. Chạy `npm run migrate:up` cho **cả hai** khi thêm migration.

Việt nói rõ phải làm gì; **mã 4 = «chưa có thay đổi nào»** không phải lỗi. `document.key` chuyển
thành hàm `khoaDs(ban)` dùng chung, vì lệnh forcesave **phải gửi đúng key** mà editor đang mở.
Người chỉ được xem thì không có nút này (`duocSuaTrucTiep` = false ⇒ hiện chữ «Chỉ xem»).


## 13. Phase 8b — lệnh sửa và gửi bản mới nhất (2026-09-08)

**Phát hành 2026-09-08:** người dùng đã test PC và nói OK; mã `63f05b0`/`4cc8bba`
đã lên VPS, migration020, ba container tạo lại. CSDL production đã được làm sạch theo
yêu cầu riêng, giữ admin/mật khẩu/liên kết Zalo; không seed lại. Chi tiết backup/reset
và kiểm chứng xem §13.3 `KE-HOACH-VPS.md` và runbook §3.1.

Migration **020_task_file_lenh_sua** thêm `lenh_sua_cho`, `lenh_sua_ly_do`,
`lenh_sua_ghi_chu`; giữ nguyên năm trạng thái. Backfill nhóm đang `can-sua` từ dòng trả về
gần nhất, không đổi các nhóm `cho-xem` cũ. Rời `can-sua` thì xóa cả ba cột lệnh.
Down xóa flow `huy-lenh-sua` trước khi siết CHECK; bản file không bị xóa.

| REST mới, có xác thực và CSRF cho đường ghi | Hợp đồng |
|---|---|
| `GET /api/v1/task-files/lenh-sua` | Chỉ lệnh của chính người gọi theo người được giao hoặc TP/PP trong `leader_ids`; kiểm lại phạm vi đọc nhiệm vụ |
| `PATCH /api/v1/task-files/:id/luu-tam` | `{ ghiChu }` tối đa 2.000 ký tự, chỉ chủ lệnh; không đổi trạng thái |
| `POST /api/v1/task-files/:id/gui-ban-moi` | `{ noiDung? }`; chủ lệnh + `duocSuaTrucTiep`; khóa nhóm, lấy bản mới nhất, dùng lại `apTuDong`; 409 khi hết lệnh/đã chốt/chưa có bản |
| `POST /api/v1/task-files/:id/huy-lenh-sua` | Chủ lệnh; giữ file, về `cho-xem` nếu lệnh Cán bộ hoặc `cho-lanh-dao` nếu lệnh TP/PP; flow `huy-lenh-sua` |

Gửi lại ghi flow `nop` với nhãn «Gửi bản mới nhất» và ý kiến. Quyền `file:create=✓`
vẫn tự duyệt; ⏳ đưa Cán bộ về TP/PP, TP/PP về PGD. Thông báo nằm cùng transaction:
ra lệnh/hủy = `approval_rejected`, gửi chờ duyệt = `approval_pending`;
hủy báo người ra lệnh gần nhất (lùi về lãnh đạo phụ trách khi dữ liệu cũ thiếu flow).
Không sửa `LOAI_DAY_ZALO`, không thêm tên file/ý kiến vào mẫu tin Zalo.

OnlyOffice: ô «Ghi ý kiến», nút «Gửi bản mới nhất đi» chỉ cho chủ lệnh có quyền sửa.
«Lưu thành bản mới» lưu ghi chú tạm khi có lệnh, lưu file nhưng không chuyển cửa.
`POST /save` chờ callback tương ứng bằng mã lượt lưu trong `userdata`, chỉ báo đã lưu
sau khi transaction lưu bản hoàn tất; quá hạn không gửi đi. Callback vẫn trả đúng
`{"error":0}`, không chứa logic gửi duyệt. Sau Ctrl+S, trang kiểm bản đã lưu qua REST đọc sẵn có
rồi hiện «Đã lưu bản mới — chưa gửi đi». Đang dirty phải lưu thành công trước khi gửi;
confirm Không/lưu lỗi không gửi và không đóng. Trang editor giữ `Cache-Control: no-store`.

Tab «Yêu cầu sửa» dùng template HTML tĩnh và `textContent`/`value` cho dữ liệu, giữ pin XSS
**106/903**. Nhân viên luôn thấy nav, mặc định tab vàng, ẩn hai tab cũ; TP/PP có ba tab.
PGD/GĐ/admin không thấy tab vàng khi không có lệnh của chính mình. Badge gồm đúng các cửa
thuộc người gọi. `GET /task-files/cho-duyet` vẫn trả danh sách rỗng cho Nhân viên;
lệnh `lanh-dao` không còn xuất hiện trong hàng chờ duyệt kết quả của TP/PP.
Chuông `task_file` mở tab vàng nếu giữ lệnh, nếu không mở tab phê duyệt kết quả
(Nhân viên vẫn về tab vàng). Buster **app.js `20260907-2`**, `project-details.js` giữ
**`20260907-1`**, CSS giữ **`20260906-1`**.

Kiểm thử: `task-files-api.test.js` TC-LS-01..10, `task-files-editor.test.js`,
`task-files-ui.test.js`, TC-NAV-04/08, TC-TBUI-07 và XSS guard.
Nghiệm thu tay **trên PC trước commit/push/deploy**: mục **9b.13** của
`docs/HUONG-DAN-TEST-GIAO-DIEN.md`. OK phát hành đợt trước không áp dụng đợt này.

## 14. TRƯỞNG/PHÓ PHÒNG LÀM NGƯỜI THỰC HIỆN TRỰC TIẾP — CHẶN TỰ DUYỆT (2026-09-09, đợt 2)

Từ đợt này ô «Người thực hiện trực tiếp» của nhiệm vụ nhận thêm **Trưởng phòng** và **Phó phòng**
(Phó GĐ/Giám đốc thì KHÔNG — họ ở lớp `supervisor_id`). Người dùng yêu cầu tìm hiểu ảnh hưởng trước
khi làm, và đây là ảnh hưởng thật:

**Vì sao luồng file là chỗ nguy hiểm, không phải luồng duyệt nhiệm vụ.** TP/PP vốn **không** có
`approve` trên `task` nên việc duyệt cây không đổi. Nhưng ở luồng file thì họ giữ
`file:approve = ✓` (họ là cửa duyệt ĐẦU TIÊN của phòng), mà `hoan-thanh` là **trạng thái kết** được
`tienDo.js` tính là XONG và cộng dồn lên cả cây theo `ty_le`. Theo `BANG_VERDICT`, `tra-ve-cbo` đi
từ `cho-lanh-dao` → `can-sua`, và `hoan-thanh` đi từ `can-sua` → `hoan-thanh`. Vậy nếu TP vừa là người
thực hiện vừa được tự chốt thì **hai lần bấm** là tự duyệt xong việc của chính mình, tiến độ lên 100%
và không ai nhìn thấy. Người dùng chốt: **«Chặn tự duyệt, buộc trình Phó GĐ»** và **«chặn cả người
thực hiện lẫn người đã tải file lên»**.

**Ba chỗ đã sửa trong `taskFiles/service.js`:**

1. `apTuDong` — `giaTri === 'cho-phep'` (✓ ở ô «Tạo file kết quả») **không còn** tự `da-duyet` khi
   `user.role` là `Trưởng phòng`/`Phó phòng`; trả `cho-lanh-dao`. Nghĩa là với hai vai này **✓ bị
   CHẶN TRẦN**: bản của họ luôn phải lên Phó GĐ phụ trách. Cán bộ giữ nguyên hành vi cũ (mục 2 ·
   TC-TF-05). Đây là thay đổi có chủ ý, `TC-LS-04` đã đổi kỳ vọng theo — ai «sửa lại cho xanh như
   cũ» là mở lại lỗ tự duyệt.
2. `verdict` — ngay sau khi lấy `banCuoi`, chặn `hoan-thanh` khi `sameId(item.assignee_id, user.id)`
   **hoặc** `sameId(banCuoi?.uploaded_by, user.id)`, trả 403 kèm câu chỉ đường
   «hãy dùng «Trình Phó giám đốc»». Chặn theo CẶP điều kiện chứ không chặn từng hành động, vì
   `tra-ve-cbo` rồi `hoan-thanh` mới là đường vòng thật.
3. `baoNguoiPhaiSua` (mới) — `bao()` LOẠI chính người hành động khỏi danh sách nhận, nên khi TP vừa
   là người thực hiện vừa tự ra lệnh sửa thì danh sách hoá **rỗng** và đầu việc nằm im không ai được
   báo. Nay lùi về `phoGiamDocPhuTrach(item.department_id)`. Dùng cho cả `yeu-cau-sua` và `tra-ve-cbo`.

**Điều kiện tiên quyết ở tầng phân công** (`assignments/service.js`): `assertTaskAssignee` **không cho
gán TP/PP khi phòng chưa có Phó Giám đốc phụ trách đang hoạt động** — mã lỗi mới
`ASSIGNEE_LEADER_NO_DEPUTY` (400), vì kết quả của họ sẽ không ai duyệt được. Kiểm ở 5 chỗ gọi (tạo
nhiệm vụ · sửa nhiệm vụ · hai nhánh sao chép · đổi phòng cấp1) và kiểm GỘP một truy vấn trong
`assertTreeAssignments` để **chuyển** công việc sang phòng chưa có Phó GĐ cũng bị chặn. Ai được gán:
admin/Phó GĐ, hoặc TP/PP **cùng phòng** gán cho nhau; vai khác 403. `listCandidates` /
`listTaskCandidates` trả THÊM `lanhDaoLamTrucTiep` + `coPhoGiamDocPhuTrach` để giao diện đọc quyết
định của máy chủ thay vì tự suy luận (chỉ thêm trường, không đổi hình dạng cũ, không mở RPC mới).

**Không migration, không cột mới** — dùng `assignee_id`/`leader_ids`/`supervisor_id` có sẵn.

Kiểm thử: `task-files-api.test.js` **TC-LDTT-01..05** (không tự `da-duyet` · `hoan-thanh` 403 · thông
báo lùi về PGĐ · PGĐ duyệt được · TP duyệt hộ Cán bộ vẫn được), `assignments.test.js` **TC-LDTT-A**
10 ca, `nhan-kem-vai.test.js`, `TC-STAT-17`, một ca `gantt-api` và một ca `export-xlsx`.
Nghiệm thu tay: mục **9b.16** của `docs/HUONG-DAN-TEST-GIAO-DIEN.md`. Buster + banner **`20260909-5`**.
**OK của các đợt trước KHÔNG áp dụng cho đợt này.**

## 10. Test thủ công cho người dùng (lịch sử; đợt mới xem mục 13–14)

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





