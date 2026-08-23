# Kế hoạch phát triển — Quản lý công việc

Chốt ngày 23/08/2026. Đọc [HUONG-DAN-BAO-TRI.md](HUONG-DAN-BAO-TRI.md) trước để hiểu code hiện tại.

## 0. Tám quyết định đã chốt

| # | Vấn đề | Chốt |
|---|---|---|
| 1 | Đổi "Dự án" → "Công việc" | **Chỉ nhãn giao diện.** Tên sheet và tên cột trong Google Sheets giữ nguyên |
| 2 | Cấu trúc 3 tầng | Thêm cột **`Mã cha`** + **`Cấp`** vào sheet `Nhiệm vụ` |
| 3 | 4 phòng | Sheet mới **`Phòng`**, admin sửa được trên giao diện |
| 4 | Khoá phân quyền | Chuyển từ **Họ tên → Email** |
| 5 | Quyền Phó phòng | Giống Trưởng phòng |
| 6 | Cấp phải duyệt | Chỉ **Công việc** và **Công việc con**. Nhiệm vụ dùng ngay |
| 7 | Ai thấy mục chờ duyệt | Cả phòng, kèm nhãn "Chờ duyệt", **không tính vào thống kê** |
| 8 | Deploy | Tôi sửa file, bạn dán vào Apps Script editor |

## 1. Thay đổi dữ liệu

Tất cả đều **thêm cột mới**, không đổi và không xoá cột cũ — sheet đang chạy không vỡ.

### Sheet mới `Phòng`

| Cột | Ví dụ | Ghi chú |
|---|---|---|
| Mã phòng | `PH01` | |
| Tên phòng | `Quản lý Đào tạo` | |
| Email Phó GĐ phụ trách | `pgd.a@...` | Một Phó GĐ đứng tên nhiều dòng = phụ trách nhiều phòng (mục 2) |
| Email Trưởng phòng | `tp.a@...` | |
| Email Phó phòng | `pp.a@...` | Nhiều người thì cách nhau dấu `;` |
| Thứ tự | `1` | Quyết định thứ tự phòng trên sơ đồ Gantt |

Khởi tạo 4 dòng: Quản lý Đào tạo, Nghiên cứu Khoa học, Kế toán, Hành chính Nhân sự.

### Sheet `Người dùng` — thêm 2 cột

- **`Phòng`** — chọn từ sheet `Phòng`
- **`Vai trò phòng`** — `Trưởng phòng` / `Phó phòng` / `Nhân viên`

Cột `Phân quyền` có sẵn nhận thêm một giá trị: **`Phó Giám đốc`**.
Hàm nhận diện quyền hiện dùng `String(user.role).toLowerCase().includes(...)`
([Code.gs.moi](Code.gs.moi) `isAdmin`, `isManager`), nên chỉ cần thêm `isDeputyDirector`
khớp `"phó giám đốc"` — không đụng logic cũ.

### Sheet `Dự án/Nhiệm vụ` (= Công việc, cấp 1) — thêm 5 cột

- **`Phòng`** — phòng sở hữu công việc, dùng cho lọc ở mục 4 và nhóm ở mục 5
- **`Trạng thái duyệt`** — `Chờ duyệt` / `Đã duyệt` / `Từ chối`
- **`Người duyệt`**, **`Ngày duyệt`**, **`Lý do từ chối`**
- **`Email quản lý`** — khoá email, sinh từ cột `Quản lý dự án` đang có

### Sheet `Nhiệm vụ` — thêm 5 cột

- **`Cấp`** — `2` = Công việc con, `3` = Nhiệm vụ. Dòng cũ không có giá trị ⇒ coi là `3`
- **`Mã cha`** — cấp 2 để trống; cấp 3 trỏ tới mã công việc con
- **`Trạng thái duyệt`**, **`Người duyệt`**, **`Ngày duyệt`** — chỉ dùng cho cấp 2
- **`Email người thực hiện`** — khoá email, sinh từ cột `Người thực hiện`

Cột `Mã dự án` vẫn giữ ở **cả cấp 2 và cấp 3**, luôn trỏ về công việc gốc. Nhờ vậy toàn bộ
hàm cũ (`getTasks`, thống kê, chat, đề nghị) chạy không cần sửa; chỉ nơi nào cần cây 3 tầng
mới đọc thêm `Cấp` và `Mã cha`.

```
Dự án/Nhiệm vụ          DA001  "Xây dựng chương trình đào tạo 2026"   Phòng: QL Đào tạo
  └─ Nhiệm vụ  Cấp 2    NV010  "Khảo sát nhu cầu"      Mã dự án: DA001  Mã cha: (rỗng)
       └─ Cấp 3         NV011  "Soạn phiếu khảo sát"   Mã dự án: DA001  Mã cha: NV010
       └─ Cấp 3         NV012  "Phát phiếu 4 khoa"     Mã dự án: DA001  Mã cha: NV010
```

### Script chuyển đổi một lần (`migrateV2`)

Chạy **một lần** trong Apps Script editor, tự làm 4 việc:

1. Thêm các cột trên vào cuối từng sheet nếu chưa có (không chèn giữa, không lệch cột cũ).
2. Tạo sheet `Phòng` + 4 dòng.
3. Điền `Cấp = 3` cho mọi dòng `Nhiệm vụ` đang có, `Trạng thái duyệt = Đã duyệt` cho mọi
   công việc đang có (dữ liệu cũ coi như đã duyệt).
4. Dò `Họ tên → Email` trong sheet `Người dùng` để điền các cột email mới. Tên không tìm
   thấy hoặc **trùng nhau** thì bỏ trống và in ra log để bạn sửa tay — script không đoán.

Sau đó bạn tự điền cột `Phòng` và `Vai trò phòng` cho từng người, và điền sheet `Phòng`.

## 2. Ma trận phân quyền sau khi làm xong

`Đọc` = thấy trên danh sách và Gantt. `Tạo/Sửa` = thao tác được. `Duyệt` = đổi trạng thái duyệt.

| Vai trò | Phạm vi thấy | Tạo Công việc / Công việc con | Tạo Nhiệm vụ | Duyệt |
|---|---|---|---|---|
| `admin` | Toàn đơn vị | Có, `Đã duyệt` ngay | Có | Có, mọi phòng |
| `Phó Giám đốc` | Các phòng mình phụ trách | Có, `Đã duyệt` ngay | Có | **Có, trong phòng phụ trách** |
| `Trưởng phòng` / `Phó phòng` | Cả phòng mình | Có → **`Chờ duyệt`** | Có | Không |
| `Quản lý dự án` (cũ) | Công việc mình quản lý | Giữ nguyên như hiện tại | Có | Không |
| `Nhân viên` | Cả phòng mình (chỉ đọc), nhiệm vụ của mình (sửa được) | Không | Chỉ trong công việc được giao | Không |

Chỗ cài đặt: `checkUserPermission(action, entityType, row)` trong [Code.gs.moi](Code.gs.moi)
— thêm 2 nhánh `isDeputyDirector` và `isDepartmentHead` **phía trên** nhánh `isManager`,
giữ nguyên toàn bộ nhánh cũ để người dùng hiện tại không mất quyền.

## 3. Chia giai đoạn

Mỗi giai đoạn là một nhánh git, kết thúc bằng một bản dán được vào Apps Script và thử được
ngay. Không gộp, để nếu vỡ thì biết vỡ ở đâu.

### GĐ 0 — Chuẩn bị (nửa ngày)

- Sao lưu **cả file Google Sheets** (File → Tạo bản sao). Bắt buộc, vì `migrateV2` ghi vào
  sheet thật.
- Viết `migrateV2` + chạy trên **bản sao** trước, đối chiếu số dòng trước/sau.
- Bổ sung `tools/check-contract.js`: đọc `js.clean.html` và `Code.gs.moi`, báo hàm nào
  frontend gọi mà backend không có. Hiện việc này đang làm bằng lệnh dán tay (§4 tài liệu
  bảo trì); mỗi giai đoạn sẽ thêm hàm mới nên cần script chạy một lệnh.

### GĐ 1 — Phòng, chức vụ, Phó Giám đốc, khoá email (mục 1 + 2)

Backend: `getDepartments` / `addDepartment` / `updateDepartment` / `deleteDepartment`
(+ 4 bản `*WithAuth`, chỉ admin), `isDeputyDirector`, `isDepartmentHead`,
`getDepartmentsOfUser`, `getDepartmentsManagedBy(email)`, `canAccessDepartment`.
Sửa `getStaff` / `addStaff` / `updateStaff` để đọc-ghi 2 cột mới.

Frontend: form Người dùng thêm ô chọn **Phòng** và **Vai trò phòng**; ô `Phân quyền` thêm
`Phó Giám đốc`; bảng Người dùng thêm 2 cột; tab mới **Cấu hình phòng** (chỉ admin thấy) để
sửa sheet `Phòng` và gán Phó GĐ phụ trách.

Xong GĐ này là mục 1 và 2 hoàn thành.

### GĐ 2 — Ba tầng + đổi nhãn (mục 3)

Backend: `addTask` nhận thêm `level` và `parentId`; thêm `getWorkTree(filter)` trả về cây
3 tầng đã lồng sẵn để frontend không phải tự nối; `deleteTask` xoá **kèm con cháu** (xoá
công việc con thì xoá luôn nhiệm vụ bên trong — sẽ hỏi lại người dùng trước khi xoá).

Frontend: modal Công việc con mới; modal Nhiệm vụ thêm ô chọn công việc con cha; danh sách
công việc hiện dạng cây thu gọn được; đổi toàn bộ nhãn `Dự án` → `Công việc`
(`index.html` + các chuỗi hiển thị trong `js.clean.html`, **không** đổi khoá `COL.*`).

### GĐ 3 — Lọc tháng và lọc phòng (mục 4)

Thêm 2 ô chọn trên tab Quản lý công việc. Lọc tháng tính theo **giao nhau** với khoảng
`Ngày bắt đầu`–`Ngày kết thúc`, không phải theo ngày tạo — công việc kéo dài 3 tháng sẽ hiện
ở cả 3 tháng. Dùng lại `taskMatchesDateFilter` đang có trong [js.clean.html](js.clean.html).
Lọc phòng đọc từ cột `Phòng` mới; người không phải admin/Phó GĐ chỉ thấy phòng mình.

### GĐ 4 — Luồng duyệt (mục 6)

Backend: `submitForApproval(id, level)`, `approveWork(id, level)`,
`rejectWork(id, level, reason)` (+ `*WithAuth`). `addProject` / `addTask` tự đặt
`Trạng thái duyệt = Chờ duyệt` khi người tạo là Trưởng/Phó phòng, `Đã duyệt` khi là
admin/Phó GĐ.

Quan trọng: mọi hàm đếm và vẽ biểu đồ (`getSummaryStats`, `renderStats`, các
`render*Chart`) phải **bỏ qua dòng `Chờ duyệt`** — đây là quyết định số 7. Đây là chỗ dễ sót
nhất của cả kế hoạch, sẽ kiểm bằng cách tạo 1 công việc chờ duyệt rồi đối chiếu tổng số
trước/sau.

Frontend: nhãn vàng "Chờ duyệt" trên card và dòng bảng; nút **Duyệt** / **Từ chối** chỉ hiện
với admin và Phó GĐ phụ trách phòng đó; badge đếm số mục chờ duyệt trên menu; gửi thông báo
qua `addNotificationWithAuth` đã khôi phục — cho Phó GĐ khi có mục mới chờ, cho người tạo
khi được duyệt hoặc bị từ chối.

### GĐ 5 — Sơ đồ Gantt (mục 5) — làm cuối vì phụ thuộc tất cả phần trên

- Ô chọn **1 / 2 / 3 tháng**: giữ `ganttStartDate` / `ganttEndDate` đang có, chỉ thêm hàm
  đặt khoảng theo số tháng và nút lùi/tiến. Hai hàm vẽ thanh đã có sẵn
  (`calculateGanttBarStyle` cho chế độ tháng, `calculateGanttBarStyleRange` cho khoảng) —
  chế độ 2–3 tháng dùng bản `Range`.
- Ô chọn **nhóm theo**: Phòng / Phó Giám đốc / Người thực hiện.
- Cột nội dung là cây 4 mức, mỗi mức một icon `▸`/`▾` để thu gọn:

```
▾ Phòng Quản lý Đào tạo                    <- mức nhóm (theo ô "nhóm theo")
  ▾ Xây dựng chương trình đào tạo 2026     <- Công việc
    ▾ Khảo sát nhu cầu                     <- Công việc con
        Soạn phiếu khảo sát                <- Nhiệm vụ
        Phát phiếu 4 khoa
  ▸ Rà soát đề cương (Chờ duyệt)
```

- Trạng thái thu gọn giữ trong `localStorage` để bấm lại lần sau không phải mở lại từ đầu.

## 4. Ba việc phải giải quyết trước khi bắt tay

### 4.1 Lỗi email chữ hoa — chặn toàn bộ, làm trước tiên

`getLicenseState` ở [Code.gs.moi:44](Code.gs.moi#L44) và [:53](Code.gs.moi#L53) tự sinh key
từ `getEmail()` **chưa lowercase**, còn `isValidLicenseKey` lại hash email **đã lowercase**
([:23](Code.gs.moi#L23)). Hai hash lệch nhau ⇒ **78 cổng kiểm tra** đều `return undefined`
⇒ người dùng có email kiểu `Hoa.Pham@congty.vn` mở app ra thấy trắng, **không có thông báo
lỗi nào**. Đã mô phỏng và xác nhận.

Đường xử lý đúng: xin key hợp lệ từ gsheets.vn, kích hoạt bằng `_activateKey(key)`
([Code.gs.moi:60](Code.gs.moi#L60)), rồi khôi phục `getLicenseState` nguyên bản từ
[Code.clean.gs:26](Code.clean.gs#L26). Tôi không vá đoạn bypass. Chưa xử lý xong việc này
thì mọi tính năng mới bên dưới cũng chịu đúng rủi ro đó, vì hàm mới cũng đi qua
`checkUserPermission`.

### 4.2 Bản sao Google Sheets

`migrateV2` ghi trực tiếp vào sheet đang chạy. Bắt buộc có bản sao trước khi chạy.

### 4.3 Hai file backend đang song song

`Code.gs.moi` (bản đang dùng) và `Code.clean.gs` (bản gốc đã dịch, không bypass) hiện giống
nhau 83/83 hàm. Phát triển tiếp sẽ làm chúng lệch nhau. Chốt **`Code.gs.moi` là bản chính**;
`Code.gs` và `Code.clean.gs` để nguyên làm mốc đối chiếu, không sửa.

## 5. Tôi cần bạn cung cấp

1. **Danh sách Phó Giám đốc**: họ tên + email + phụ trách phòng nào.
2. **Trưởng phòng và Phó phòng** của từng phòng trong 4 phòng: họ tên + email.
3. **Một người có thể thuộc nhiều phòng không?** Kế hoạch trên đang giả định **một người
   một phòng**. Nếu có người kiêm nhiệm thì nói trước, vì cột `Phòng` phải đổi cách lưu.
4. **Ảnh chụp hàng tiêu đề** của sheet `Người dùng`, `Dự án/Nhiệm vụ`, `Nhiệm vụ` trong file
   thật — để `migrateV2` thêm cột đúng vị trí. Cột `Chức vụ` hiện đang điền gì cũng cần biết,
   vì nó gần trùng ý nghĩa với `Vai trò phòng` mới.
5. **Người dùng hiện có bao nhiêu, công việc/nhiệm vụ khoảng bao nhiêu dòng** — trên 5.000
   dòng thì phần Gantt cần đọc theo lô, thiết kế sẽ khác.

## 6. Thứ tự tôi đề nghị làm

`GĐ 0` → `GĐ 1` → `GĐ 2` → `GĐ 3` → `GĐ 4` → `GĐ 5`, mỗi giai đoạn một nhánh git, dán vào
Apps Script và bạn thử trước khi sang giai đoạn sau. Gantt (mục 5) làm cuối vì nó cần cả cây
3 tầng, cột `Phòng`, mapping Phó GĐ và trạng thái duyệt — làm sớm là phải viết lại hai lần.

Trả lời được 5 mục ở §5 là tôi bắt đầu GĐ 0 và GĐ 1 ngay.




