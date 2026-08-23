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

Tiêu đề thật (xác nhận 23/08/2026):
`Mã NV | Họ tên | Email | Mật khẩu | Chức vụ | Phân quyền | Đối tượng | Ghi chú`

- **`Phòng`** — chọn từ sheet `Phòng`
- **`Vai trò phòng`** — `Trưởng phòng` / `Phó phòng` / `Nhân viên`

Cột `Phân quyền` có sẵn nhận thêm một giá trị: **`Phó Giám đốc`**.
Hàm nhận diện quyền hiện dùng `String(user.role).toLowerCase().includes(...)`
([Code.gs.moi](Code.gs.moi) `isAdmin`, `isManager`), nên chỉ cần thêm `isDeputyDirector`
khớp `"phó giám đốc"` — không đụng logic cũ.

Cột `Chức vụ` là chữ tự do (vd "Quản trị viên"), **không** thay cho `Vai trò phòng`.
Hai cột giữ song song: `Chức vụ` để hiển thị, `Vai trò phòng` để phân quyền.

### Sheet `Dự án/Nhiệm vụ` (= Công việc, cấp 1) — thêm 5 cột

Tiêu đề thật (xác nhận 23/08/2026):
`Mã dự án | Tên dự án | Mô tả dự án | Quản lý dự án | Ngày bắt đầu | Ngày kết thúc | Trạng thái dự án | Nhiệm vụ JSON | Nhật ký JSON`

- **`Phòng`** — phòng sở hữu công việc, dùng cho lọc ở mục 4 và nhóm ở mục 5
- **`Trạng thái duyệt`** — `Chờ duyệt` / `Đã duyệt` / `Từ chối`
- **`Người duyệt`**, **`Ngày duyệt`**, **`Lý do từ chối`**
- **`Email quản lý`** — khoá email, sinh từ cột `Quản lý dự án` đang có

### Nhiệm vụ — SỬA so với bản chốt đầu: không có sheet rời

Bản chốt đầu ghi "Sheet `Nhiệm vụ` — thêm 5 cột". **Sai.** File thật chỉ có **một sheet**
`Dự án/Nhiệm vụ`; toàn bộ nhiệm vụ nằm trong cột **`Nhiệm vụ JSON`** của đúng dòng công
việc, mỗi công việc một mảng JSON. Đã xác nhận trong code: `getTasks`
([Code.gs.moi:2046](Code.gs.moi#L2046)) đọc cột JSON rồi bơm thêm `Mã dự án` vào từng phần
tử; `addTask` / `updateTask` / `deleteTask` cũng đọc–ghi mảng JSON đó.

Vì vậy 5 trường mới là **khoá trong object JSON**, không phải cột sheet:

- **`Cấp`** — `2` = Công việc con, `3` = Nhiệm vụ. Không có giá trị ⇒ coi là `3`
- **`Mã cha`** — cấp 2 để trống; cấp 3 trỏ tới mã công việc con
- **`Trạng thái duyệt`**, **`Người duyệt`**, **`Ngày duyệt`** — chỉ dùng cho cấp 2
- **`Email người thực hiện`** — khoá email, sinh từ `Người thực hiện`

Đổi kiểu lưu này **có lợi**: không phải thêm cột, không sợ lệch cột, và cấp 2 với cấp 3
nằm cùng một mảng nên đọc cây chỉ mất một lần đọc sheet. Hằng số `TASK_SHEET_NAME`
(`"Nhiệm vụ"`) giữ lại để script vẫn chạy được nếu về sau có file dùng sheet rời.

Trường `Mã dự án` vẫn có ở **cả cấp 2 và cấp 3**, luôn trỏ về công việc gốc. Nhờ vậy toàn bộ
hàm cũ (`getTasks`, thống kê, chat, đề nghị) chạy không cần sửa; chỉ nơi nào cần cây 3 tầng
mới đọc thêm `Cấp` và `Mã cha`.

```
Dự án/Nhiệm vụ          DA001  "Xây dựng chương trình đào tạo 2026"   Phòng: QL Đào tạo
  └─ (trong Nhiệm vụ JSON của chính dòng DA001)
     Cấp 2    NV010  "Khảo sát nhu cầu"      Mã dự án: DA001  Mã cha: (rỗng)
       └─ Cấp 3         NV011  "Soạn phiếu khảo sát"   Mã dự án: DA001  Mã cha: NV010
       └─ Cấp 3         NV012  "Phát phiếu 4 khoa"     Mã dự án: DA001  Mã cha: NV010
```

### Script chuyển đổi một lần (`migrateV2`)

Chạy **một lần** trong Apps Script editor, tự làm 5 việc:

1. Thêm cột mới vào `Người dùng` và `Dự án/Nhiệm vụ` (thêm vào cuối, không chèn giữa).
2. Tạo sheet `Phòng` + 4 dòng.
3. Điền `Trạng thái duyệt = Đã duyệt` cho mọi công việc đang có (dữ liệu cũ coi như đã duyệt).
4. `migrateFillTaskJson` — mở từng mảng `Nhiệm vụ JSON`, điền `Cấp = 3`, `Mã cha = ""`,
   `Trạng thái duyệt = Đã duyệt`, `Email người thực hiện` cho từng nhiệm vụ, rồi ghi lại.
5. Dò `Họ tên → Email` trong sheet `Người dùng` để điền các cột email mới. Tên không tìm
   thấy hoặc **trùng nhau** thì bỏ trống và in ra log để bạn sửa tay — script không đoán.

Chạy lại nhiều lần không hỏng: mỗi bước chỉ ghi vào ô còn rỗng (đã mô phỏng, lần 2 ghi 0 dòng).

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

| # | Cần | Trạng thái 23/08/2026 |
|---|---|---|
| 1 | **Danh sách Phó Giám đốc**: họ tên + email + phụ trách phòng nào | ⏳ chưa có |
| 2 | **Trưởng phòng và Phó phòng** của từng phòng: họ tên + email | ⏳ chưa có |
| 3 | **Một người có thể thuộc nhiều phòng không?** | ⏳ chưa có — đang giả định một người một phòng |
| 4 | **Tiêu đề cột** của các sheet thật | ✅ đã có, xem §1. Sheet `Nhiệm vụ` rời **không tồn tại** |
| 5 | **Số người dùng / số dòng công việc** | ⏳ chưa có — hiện sheet `Người dùng` chỉ có 1 dòng `NV001 Admin` |

Ghi chú mục 4: cột `Chức vụ` hiện điền chữ tự do (`Quản trị viên`). Giữ nguyên, không dùng
làm `Vai trò phòng`.

## 6. Thứ tự tôi đề nghị làm

`GĐ 0` → `GĐ 1` → `GĐ 2` → `GĐ 3` → `GĐ 4` → `GĐ 5`, mỗi giai đoạn một nhánh git, dán vào
Apps Script và bạn thử trước khi sang giai đoạn sau. Gantt (mục 5) làm cuối vì nó cần cả cây
3 tầng, cột `Phòng`, mapping Phó GĐ và trạng thái duyệt — làm sớm là phải viết lại hai lần.

Trả lời được 5 mục ở §5 là tôi bắt đầu GĐ 0 và GĐ 1 ngay.

---

## 7. Tiến độ thực tế — cập nhật 23/08/2026

Ký hiệu: ✅ xong và đã kiểm · 🟡 xong code, chưa chạy trên Google Sheets thật · ⏳ chưa làm.

### GĐ 0 — Chuẩn bị

| Việc | Trạng thái | Ghi chú |
|---|---|---|
| Sao lưu file Google Sheets | ⏳ **bạn làm** | Bắt buộc trước khi chạy `migrateV2` |
| Viết `migrateV2` | 🟡 | Xem chi tiết bên dưới |
| `tools/check-contract.js` | ⏳ | Hiện kiểm bằng một lệnh grep (ghi ở §7.4), chưa thành script |
| Chốt `Code.gs.moi` là bản chính | ✅ | `Code.gs`, `Code.clean.gs` để nguyên làm mốc |

### GĐ 1 — Phòng, chức vụ, Phó Giám đốc, khoá email — **XONG CODE**

**Backend `Code.gs.moi`** — tất cả 🟡 (parse sạch, chưa chạy trên sheet thật):

- Hằng số: `DEPARTMENT_SHEET_NAME`, `DEPT_*_COLUMN_NAME` (7 cột), `STAFF_DEPARTMENT_COLUMN_NAME`,
  `STAFF_DEPT_ROLE_COLUMN_NAME`, `ROLE_DEPUTY_DIRECTOR`, `DEPT_ROLE_HEAD/VICE/STAFF`,
  `DEPARTMENT_HEADERS`, `STAFF_HEADERS`, `DEFAULT_DEPARTMENTS` (4 phòng)
  — [Code.gs.moi:139-156](Code.gs.moi#L139-L156).
- Khai báo sớm cột của GĐ2–GĐ4 để `migrateV2` tạo hết trong một lần chạy:
  `PROJECT_DEPARTMENT/MANAGER_EMAIL/APPROVAL/APPROVER/APPROVED_DATE/REJECT_REASON`,
  `TASK_LEVEL/PARENT_ID/ASSIGNEE_EMAIL/APPROVAL/APPROVER/APPROVED_DATE`,
  `APPROVAL_PENDING/APPROVED/REJECTED`, `LEVEL_SUBWORK = 2`, `LEVEL_TASK = 3`
  — [Code.gs.moi:158-179](Code.gs.moi#L158-L179).
- Đọc sheet `Phòng`: `getDepartments` (tự tạo sheet + seed 4 phòng, sắp theo `Thứ tự`),
  `seedDefaultDepartments`, `getDepartmentNames`.
- Phân quyền: `isDeputyDirector` (khớp `"phó giám đốc"` trong `Phân quyền`),
  `getUserDeptInfo` (ưu tiên session, session cũ thì tra sheet theo email),
  `isDepartmentHead` (Trưởng **hoặc** Phó phòng — quyết định số 5; nhận cả theo cột
  `Vai trò phòng` lẫn theo email trong sheet `Phòng`), `getDepartmentsManagedBy(email)`,
  `getVisibleDepartments`, `canAccessDepartment`.
- `getDepartmentContext()` — một lần gọi trả cho frontend: `departments`, `departmentNames`,
  `visibleDepartments`, `myDepartment`, `myDeptRole`, `isDeputyDirector`, `isDepartmentHead`.
- CRUD: `addDepartment`, `updateDepartment`, `deleteDepartment` + 3 bản `*WithAuth` (chỉ admin).
  `updateDepartment` đổi tên phòng thì gọi `renameDepartmentEverywhere` cập nhật cột `Phòng`
  của sheet `Người dùng`. `deleteDepartment` **chặn** nếu còn người thuộc phòng.
- `checkUserPermission` thêm `entityType === "department"` (chỉ admin) và 2 nhánh
  `isDeputyDirector` / `isDepartmentHead` đặt **trên** nhánh `isManager`, nhánh cũ giữ nguyên
  — [Code.gs.moi:1292](Code.gs.moi#L1292).
- `authenticateUser`, `getStaffList`, `addStaff`, `updateStaff` đọc–ghi 2 cột mới.
- Tiện ích: `parseEmailList`, `normalizeEmail`, `setCellIfColumnExists`, `ensureColumns`.

**Frontend `js.clean.html` + `index.html`** — tất cả 🟡:

- `COL` thêm 7 khoá phòng (`D_ID`, `D_NAME`, `D_DIRECTOR`, `D_HEAD`, `D_VICE`, `D_ORDER`,
  `D_NOTES`), 2 khoá người dùng (`S_DEPT`, `S_DEPT_ROLE`) và các khoá GĐ2–GĐ4
  (`P_DEPT`, `P_APPROVAL`, `T_LEVEL`, `T_PARENT`, …) — [js.clean.html:35-115](js.clean.html#L35-L115).
- State toàn cục: `allDepartments`, `departmentNames`, `visibleDepartments`, `myDepartment`,
  `myDeptRole`, `isDeputyDirectorUser`, `isDepartmentHeadUser`, `departmentsAutoLoadTried`.
- `loadDepartmentContext(callback)` — gọi sau `handleSuccessfulLogin`, nạp state, bật/tắt menu
  **Cấu hình phòng** theo `isAdmin()`, vẽ lại bảng nếu đang ở tab đó.
- Form Người dùng: hàng 4 thêm ô **Phòng** (`buildDepartmentOptions`) và **Vai trò phòng**
  (`buildDeptRoleOptions`); ô `Phân quyền` thêm `Phó Giám đốc`.
- Bảng Người dùng: cột **Phòng** kèm badge vàng vai trò, badge tím cho `Phó Giám đốc`
  (`createStaffTableRow`).
- `index.html`: mục menu `nav-departments` (mặc định `hidden`), section `departments-section`
  với bảng 6 cột + nút **Thêm phòng**; `switchSection` biết tên tab `departments`.
- **Mới trong phiên này** — đóng nốt tab Cấu hình phòng
  ([js.clean.html:1430-1646](js.clean.html#L1430-L1646)):

| Hàm | Việc |
|---|---|
| `findDepartmentById` | Tra phòng trong state theo `Mã phòng` |
| `isValidEmailFormat` | Kiểm định dạng email, rỗng coi là hợp lệ |
| `parseEmailListClient` | Tách chuỗi email theo `;` hoặc `,`, lowercase |
| `describeEmailList` | Hiện **Họ tên** thay cho email; email lạ (không có trong `Người dùng`) tô cam để dễ thấy sai |
| `countStaffInDepartment` | Đếm người thuộc phòng, hiện trong bảng và dùng để chặn xoá |
| `renderDepartments` | Vẽ bảng; tự gọi `loadDepartmentContext` **một lần** nếu state rỗng (cờ `departmentsAutoLoadTried` chống lặp vô hạn khi backend lỗi) |
| `createDepartmentTableRow` | Một dòng bảng + 2 nút sửa/xoá gọi trực tiếp `openDepartmentModal` / `confirmDeleteDepartment` |
| `buildStaffEmailDatalist` | `<datalist>` gợi ý email; ô Phó GĐ ưu tiên người có `Phân quyền` = Phó Giám đốc, không có ai thì gợi ý tất cả |
| `createDepartmentModal` | HTML form: Tên phòng, Thứ tự, Email Phó GĐ, Email TP, Email PP, Ghi chú |
| `openDepartmentModal(id)` | Mở modal thêm/sửa. Không gọi `openModal()` vì `openModal` đẩy submit sang `handleAdd`/`handleEdit` — hai hàm đó không biết loại `department` |
| `showDepartmentValidationError` | Hiện lỗi ngay trong modal, không đóng form |
| `handleSaveDepartment(id)` | Kiểm tên rỗng / trùng tên / định dạng email → gọi `addDepartmentWithAuth` hoặc `updateDepartmentWithAuth(id, data)`; xong thì nạp lại state; **sửa** thì gọi thêm `refreshData()` vì đổi tên phòng ảnh hưởng cột `Phòng` của người dùng |
| `confirmDeleteDepartment(id)` | Chặn tại giao diện nếu còn người trong phòng, rồi `showConfirmDialog` → `deleteDepartmentWithAuth` |
| `showConfirmDialog` | Thêm tham số thứ 6 `options = {confirmText, iconClass}`. Cần vì nhánh `type="danger"` cũ **cố định** chữ nút là "Đăng xuất". Các nơi gọi cũ không đổi |

Cả 3 đường gọi backend đều xử lý trường hợp `response` = `undefined` — đúng bệnh §4.1
(cổng license trả `undefined` im lặng) — và hiện thông báo thay vì đứng yên.

### 7.1 `migrateV2` — đã sửa để chạy được với cấu trúc thật

Bản đầu **không chạy được**: nó đòi cả sheet `Nhiệm vụ`, mà file thật không có sheet đó, nên
`migrateV2` sẽ `return "DỪNG: thiếu sheet"` và không làm gì. Đã sửa:

- Chỉ bắt buộc `Người dùng` + `Dự án/Nhiệm vụ`. Sheet `Nhiệm vụ` rời là **tuỳ chọn** — có thì
  vẫn thêm cột, không có thì ghi rõ trong log.
- Thêm `buildStaffNameEmailMap()` — bảng tra `Họ tên → Email`, tên trùng ghi riêng.
  Dùng chung cho bước 4 và bước 5, không còn hai bản logic dò tên.
- Thêm `migrateFillTaskJson(projectSheet)` — mở từng mảng `Nhiệm vụ JSON`, điền `Cấp = 3`,
  `Mã cha = ""`, `Trạng thái duyệt = Đã duyệt`, `Email người thực hiện`, rồi ghi lại
  bằng `formatJSONCompact`. Dòng JSON hỏng thì đếm và bỏ qua, không làm vỡ cả lần chạy.

Đã mô phỏng bằng Node với sheet giả (3 nhiệm vụ, 1 dòng JSON hỏng, 1 tên trùng, 1 tên lạ):

```
LẦN 1: Nhiệm vụ JSON: ghi lại 1 công việc — Cấp=3 cho 3 nhiệm vụ, Đã duyệt cho 3, email cho 1.
  JSON lỗi không đọc được: 1 dòng.
  CẦN SỬA TAY (2): TRÙNG TÊN: Trùng C | Ai Đó Lạ
LẦN 2: Nhiệm vụ JSON: ghi lại 0 công việc — Cấp=3 cho 0 nhiệm vụ, Đã duyệt cho 0, email cho 0.
```

Lần 2 ghi 0 dòng ⇒ chạy lại nhiều lần an toàn.

### 7.2 Cách chạy thử `migrateV2` (GĐ 0, bạn làm)

1. **Tạo bản sao file Google Sheets**: `File → Tạo bản sao`. Chạy trên bản sao trước.
2. Ghi lại **số dòng hiện tại** của `Người dùng` và `Dự án/Nhiệm vụ` để đối chiếu sau khi chạy
   (migrate chỉ được thêm cột, **không** được thêm/xoá dòng).
3. Dán `Code.gs.moi` vào editor của bản sao → chọn hàm `migrateV2` → `Run`.
4. Mở `Xem → Bản ghi thực thi` (Execution log) và **gửi tôi toàn bộ log**. Log gồm 5 dòng
   tương ứng 5 bước; tôi cần nhất phần `CẦN SỬA TAY (...)` để biết tên nào phải điền email thủ công.
5. Sau khi chạy, kiểm tay 3 điểm rồi báo tôi:
   - sheet `Phòng` có đúng 4 dòng `PH01`–`PH04` không;
   - sheet `Dự án/Nhiệm vụ` có 6 cột mới ở cuối không, và cột `Trạng thái duyệt` = `Đã duyệt`;
   - mở ô `Nhiệm vụ JSON` của một công việc bất kỳ, xem trong JSON đã có `"Cấp":3` chưa.

Ba thông tin còn thiếu ở §5 (mục 1, 2, 3, 5) **không chặn** việc chạy `migrateV2` — script tự
tạo 4 phòng rỗng, bạn điền email Phó GĐ / Trưởng phòng / Phó phòng sau bằng tab **Cấu hình
phòng** vừa làm xong, không cần sửa tay trong sheet.

### 7.3 GĐ 2 — danh sách hàm phải sửa trong `Code.gs.moi` (chốt trước khi code)

Nhắc lại điểm quan trọng: nhiệm vụ nằm trong **mảng JSON** của dòng công việc, nên cấp 2 và
cấp 3 **ở cùng một mảng**, phân biệt bằng `Cấp` và `Mã cha`. Không thêm cột nào cho GĐ2.

| # | Hàm | Dòng | Phải sửa gì |
|---|---|---|---|
| 1 | `addTask` | [1603](Code.gs.moi#L1603) | Nhận thêm `taskData.level` (2 hoặc 3, thiếu ⇒ 3) và `taskData.parentId`. Ghi `Cấp`, `Mã cha` vào object JSON. Kiểm: cấp 2 thì `Mã cha` phải rỗng; cấp 3 thì `Mã cha` phải là mã của một phần tử **cấp 2 trong cùng mảng** — sai thì trả lỗi, không ghi |
| 2 | `addTaskWithAuth` | [1007](Code.gs.moi#L1007) | Không sửa chữ ký (`level`/`parentId` đi trong `taskData`). GĐ4 mới thêm nhánh quyền theo cấp |
| 3 | `updateTask` | [1660](Code.gs.moi#L1660) | **Không** cho đổi `Cấp` (đổi cấp = di chuyển cây, để sau). Cho đổi `Mã cha` nhưng phải chặn tự trỏ vào chính mình hoặc vào con cháu (kiểm vòng) |
| 4 | `deleteTask` | [1766](Code.gs.moi#L1766) | Hiện chỉ `splice` một phần tử. Cần: xoá cấp 2 thì xoá **kèm mọi phần tử có `Mã cha` = mã đó**; trả về `deletedChildren` để frontend hỏi lại người dùng trước khi xoá |
| 5 | `getTasks` | [2046](Code.gs.moi#L2046) | Khi bơm `Mã dự án` vào từng phần tử, bơm luôn mặc định `Cấp = 3` và `Mã cha = ""` nếu thiếu — để frontend không phải kiểm `undefined`, và app chạy được cả khi chưa migrate |
| 6 | `getWorkTree(filter)` | **mới** | Đọc một lượt, trả cây lồng sẵn: công việc → `children` cấp 2 → `children` cấp 3. Phần tử cấp 3 mà `Mã cha` trỏ vào mã không tồn tại thì gom vào nhóm `"(chưa gán công việc con)"` — không được rơi mất |
| 7 | `getSummaryStats` | [2245](Code.gs.moi#L2245) | **Chốt cách đếm**: chỉ đếm **cấp 3** là "nhiệm vụ"; cấp 2 là nhóm, không tính vào tổng và không tính tiến độ. Nếu không sửa, mọi con số sẽ nhảy lên sau khi có công việc con |
| 8 | `copyTask` | [2740](Code.gs.moi#L2740) | Sao chép cấp 2 phải sao cả con (mã mới, `Mã cha` mới trỏ đúng bản sao). Sao chép cấp 3 thì giữ nguyên `Mã cha` |
| 9 | `addTaskReminder` / `updateTaskReminder` / `deleteTaskReminder` | [1822](Code.gs.moi#L1822) / [1892](Code.gs.moi#L1892) / [1969](Code.gs.moi#L1969) | Nhắc việc chỉ dành cho cấp 3. Gọi trên cấp 2 thì trả lỗi rõ ràng |
| 10 | `checkUserPermission` | [1292](Code.gs.moi#L1292) | Dùng chung `entityType = "task"`, đọc `row["Cấp"]` để phân biệt. Không thêm loại thực thể mới |
| 11 | `logActivity` | [2371](Code.gs.moi#L2371) | Nhật ký ghi rõ "Công việc con" hay "Nhiệm vụ" để đọc lại phân biệt được |
| 12 | `getDataForUser` | [885](Code.gs.moi#L885) | Không bắt buộc. Nếu ghép `getDepartmentContext()` vào đây thì frontend bớt được một vòng gọi khi đăng nhập |

Không phải sửa: `generateTaskIdForProject` ([2720](Code.gs.moi#L2720)) sinh mã theo mốc thời
gian tới millisecond nên cấp 2 và cấp 3 không đụng mã nhau.

Frontend GĐ2 giữ đúng như §3 đã ghi, thêm một điểm: `allTasks` sau GĐ2 chứa **cả cấp 2 và cấp
3**, nên mọi chỗ đang đếm `allTasks.length` hoặc lọc theo `T_ASSIGNEE` phải lọc `T_LEVEL === 3`
trước. Đây là chỗ dễ sót nhất của GĐ2, tương đương chỗ `Chờ duyệt` của GĐ4.

### 7.4 Lệnh kiểm hợp đồng frontend ↔ backend (tạm thời, thay `check-contract.js`)

```bash
grep -oE '\)\.[a-zA-Z_][a-zA-Z0-9_]*\(' js.clean.html | sed 's/^)\.//;s/(//' | sort -u > /tmp/fe.txt
grep -oE '^function [a-zA-Z_][a-zA-Z0-9_]*' Code.gs.moi | sed 's/^function //' | sort -u > /tmp/be.txt
comm -23 /tmp/fe.txt /tmp/be.txt   # tên nào lạ thì kiểm bằng mắt (lẫn cả method DOM/JS chuẩn)
```

Chạy ngày 23/08/2026: không có hàm backend nào bị gọi mà thiếu. Riêng
`addDepartmentWithAuth` / `updateDepartmentWithAuth` gọi qua biến `runner` nên lệnh grep này
không thấy — đã kiểm bằng mắt, cả hai có trong `Code.gs.moi`.

Kiểm cú pháp trước khi dán vào Apps Script:

```bash
cp Code.gs.moi /tmp/c.js && node --check /tmp/c.js
sed -e '1d' -e '$d' js.clean.html > /tmp/j.js && node --check /tmp/j.js
```

Cả hai đang **PARSE OK**.

### 7.5 Việc còn nợ, theo thứ tự nên làm

1. **Bạn**: sao lưu Sheets → chạy `migrateV2` trên bản sao → gửi tôi execution log (§7.2).
2. **Bạn**: trả lời mục 1, 2, 3, 5 của §5.
3. **Bạn**: dán `Code.gs.moi` + `js.clean.html` + `index.html` vào Apps Script bản sao, đăng nhập
   bằng `admin@gmail.com` rồi thử tab **Cấu hình phòng**: thêm 1 phòng, sửa tên, gán email
   Trưởng phòng, thử xoá phòng còn người (phải bị chặn) và xoá phòng rỗng (phải xoá được).
4. **Tôi**: xử lý §4.1 (lỗi email chữ hoa) — vẫn đang chặn mọi tính năng, cần key hợp lệ.
5. **Tôi**: `tools/check-contract.js` thay cho lệnh grep ở §7.4.
6. **Tôi**: GĐ2 theo bảng §7.3.








