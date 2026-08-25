# Nghiệm thu (UAT) — bản VPS

Đây là bản in ra để **tích tay khi ngồi trước máy**, không phải test tự động. Mỗi dòng là một
mã tính năng trong §2 của `KE-HOACH-VPS.md`. Bản VPS chỉ được cắt chuyển khi **tất cả** ô dưới
đây đã tích, hoặc mục chưa tích đã được ghi rõ lý do hoãn ở §13.4.

Cách dùng:

1. Chạy trên môi trường staging đã seed **dữ liệu test tự tạo** (`npm run seed:dev`, §8.3 của
   `KE-HOACH-VPS.md`). Không dùng bản sao dữ liệu thật: nó chứa email và mật khẩu của người thật.
2. Đăng nhập lần lượt bằng **6 vai trò** rồi mới tích: `admin`, `Phó Giám đốc`, `Trưởng phòng`,
   `Phó phòng`, `Quản lý công việc`, `Nhân viên`. Nhiều lỗi phân quyền chỉ hiện ra ở vai trò thấp.
   Dữ liệu mẫu có sẵn một tài khoản cho mỗi vai trò, mật khẩu chung `Test@12345`.
3. Tích `[x]` khi tự tay thấy đúng. Không tích theo lời người khác, không tích vì "code có viết".
4. Mục nào sai: ghi vào cột **Ghi chú** ngay dưới dòng đó theo mẫu `→ LỖI: <thấy gì>` rồi mở
   một dòng mới ở §13.4 của `KE-HOACH-VPS.md`.

Tổng: **88 mã** / 13 nhóm.

| Nhóm | Số mã | Nhóm | Số mã |
|---|---|---|---|
| A. Xác thực & phiên | 7 | H. Chat nội bộ | 4 |
| B. Công việc cấp 1 | 6 | I. Quản lý App | 3 |
| C. Cấp 2 & cấp 3 | 15 | J. Thông báo & nhật ký | 3 |
| D. Người dùng & Phòng | 10 | K. Luồng duyệt (mới) | 8 |
| E. Tổng quan & thống kê | 11 | L. Lọc (mới) | 2 |
| F. Sơ đồ Gantt | 9 | M. Tiện ích mới trên VPS | 4 |
| G. Đề nghị | 6 | | |

---

## A. Xác thực & phiên

- [ ] **A1** Đăng nhập bằng email + mật khẩu. Thử email viết HOA toàn bộ — **vẫn phải vào được**
      (bản cũ trượt ở đây).
- [ ] **A2** Phiên được lưu; hết `SESSION_TTL_HOURS` thì tự đăng xuất. Thử xoá cookie ⇒ bật lại về trang đăng nhập.
- [ ] **A3** Đăng xuất: bấm xong bấm Back của trình duyệt **không** vào lại được.
- [ ] **A4** Đổi mật khẩu: mật khẩu cũ sai thì báo lỗi; đổi xong đăng nhập lại bằng mật khẩu mới.
- [ ] **A5** Đủ 6 vai trò, gán được và hiển thị đúng badge. Tạo người dùng vai trò lạ ⇒ bị chặn.
- [ ] **A6** Quyền tính theo hành động × loại thực thể × **dòng dữ liệu** (không chỉ theo vai trò).
- [ ] **A7** Nút Sửa / Xoá / Nhân bản / Thêm nhiệm vụ chỉ hiện khi thật sự có quyền. Kiểm cả bằng
      cách gọi trực tiếp API bằng vai trò thấp ⇒ phải trả 403, không chỉ ẩn nút.

## B. Công việc — cấp 1

- [ ] **B1** Thêm / sửa / xoá công việc.
- [ ] **B2** Nhân bản công việc kéo theo **toàn bộ** cấp 2 và cấp 3, không mất mục nào.
- [ ] **B3** Đủ 9 trường: mã, tên, mô tả, quản lý, ngày bắt đầu, ngày kết thúc, trạng thái, phòng, email quản lý.
- [ ] **B4** Thẻ công việc và modal chi tiết hiện đúng số liệu.
- [ ] **B5** Tìm kiếm và lọc công việc.
- [ ] **B6** Mỗi công việc có nhật ký thay đổi riêng, ghi đúng người và thời điểm.

## C. Công việc con (cấp 2) & Nhiệm vụ (cấp 3)

- [ ] **C1** Thêm / sửa / xoá, phân biệt rõ cấp 2 và cấp 3.
- [ ] **C2** Cây 3 tầng hiện lồng nhau; nhiệm vụ chưa có cha gom vào nhóm `(chưa gán công việc con)`,
      **không biến mất khỏi giao diện**.
- [ ] **C3** Chặn được cả 5 kiểu sai cấu trúc: đổi cấp, tự trỏ vào mình, trỏ vào con cháu của mình,
      cha không tồn tại, lấy cấp 3 làm cha. Lỗi phải nói rõ sai gì.
- [ ] **C4** Xoá cấp 2 xoá kèm con cháu và **hỏi lại kèm danh sách mã sắp mất** trước khi xoá.
- [ ] **C5** Chuyển nhiệm vụ sang công việc khác được; chuyển cấp 2 **đang có con** thì bị chặn.
- [ ] **C6** Nhân bản cấp 2 nhân bản cả con, `Mã cha` của bản sao trỏ vào **bản sao** chứ không trỏ
      về bản gốc (bản cũ còn nợ mục này).
- [ ] **C7** Kéo–thả đổi thứ tự nhiệm vụ; tải lại trang vẫn giữ thứ tự mới.
- [ ] **C8** Sửa được đủ 13 trường: tên, mô tả, người thực hiện, trạng thái, ưu tiên, ngày bắt đầu,
      hạn chót, tiến độ %, ngày hoàn thành, mục tiêu, link kết quả, kết quả đầu ra, ghi chú.
- [ ] **C9** Nhắc việc: thêm / sửa / xoá, mỗi nhắc việc có ngày + nội dung.
- [ ] **C10** Đặt nhắc việc trên **cấp 2** phải báo lỗi rõ ràng (bản cũ còn nợ mục này).
- [ ] **C11** Nhiều link kết quả trên một nhiệm vụ, mở ra popup, bấm được từng link.
- [ ] **C12** Hoàn thành nhanh một nhiệm vụ bằng **một** cú bấm.
- [ ] **C13** Nhiệm vụ quá hạn được cảnh báo (màu / nhãn) ở mọi nơi có hiện nhiệm vụ.
- [ ] **C14** Ngày của nhiệm vụ bị giới hạn trong khoảng ngày của công việc cha.
- [ ] **C15** Mọi con số thống kê chỉ đếm **cấp 3**; cấp 2 không bị đếm thành nhiệm vụ.

## D. Người dùng & Phòng

- [ ] **D1** Thêm / sửa / xoá người dùng.
- [ ] **D2** Đủ 10 trường: mã NV, họ tên, email, mật khẩu, chức vụ, phân quyền, đối tượng, ghi chú,
      phòng, vai trò phòng.
- [ ] **D3** Bảng và thẻ người dùng, badge vai trò đúng.
- [ ] **D4** Lưu người dùng thiếu / sai dữ liệu ⇒ báo lỗi rõ, **không** lưu nửa vời.
- [ ] **D5** Thêm / sửa / xoá phòng — chỉ `admin` làm được.
- [ ] **D6** Gán Phó GĐ phụ trách, Trưởng phòng, Phó phòng cho từng phòng.
- [ ] **D7** Đổi tên phòng cập nhật luôn người dùng thuộc phòng đó, không còn tên cũ ở đâu.
- [ ] **D8** Xoá phòng còn người ⇒ bị chặn kèm số người đang thuộc phòng.
- [ ] **D9** Thứ tự phòng quyết định thứ tự nhóm trên Gantt.
- [ ] **D10** Bảng phòng hiện **họ tên** thay vì email; email không có trong hệ thống được tô cam.

## E. Tổng quan & thống kê

- [ ] **E1** 4 thẻ số: tổng công việc, tổng nhiệm vụ, đang làm, quá hạn + tỷ lệ hoàn thành.
      Đếm tay một phòng nhỏ để đối chiếu.
- [ ] **E2** Biểu đồ trạng thái nhiệm vụ.
- [ ] **E3** Biểu đồ so sánh công việc.
- [ ] **E4** Biểu đồ tiến độ công việc.
- [ ] **E5** Biểu đồ hiệu suất nhân sự.
- [ ] **E6** Biểu đồ mức ưu tiên nhiệm vụ.
- [ ] **E7** Biểu đồ tiến độ theo thời gian.
- [ ] **E8** Danh sách nhiệm vụ ưu tiên (mini).
- [ ] **E9** Hoạt động gần đây hiện đúng việc vừa làm.
- [ ] **E10** Bấm vào từng con số ⇒ mở danh sách chi tiết **đúng bằng** con số đó.
- [ ] **E11** Lọc tổng quan theo một công việc; mọi thẻ số và biểu đồ đổi theo.

## F. Sơ đồ Gantt

- [ ] **F1** Vẽ thanh theo chế độ tháng.
- [ ] **F2** Vẽ thanh theo khoảng ngày bất kỳ.
- [ ] **F3** Lùi / tiến tháng; chọn ngày bằng ô nhập cũng đúng.
- [ ] **F4** Lọc theo người thực hiện.
- [ ] **F5** Tìm kiếm trong Gantt.
- [ ] **F6** Thu gọn / mở từng công việc.
- [ ] **F7** **Mới**: chọn khoảng 1 / 2 / 3 tháng.
- [ ] **F8** **Mới**: nhóm theo Phòng / Phó Giám đốc / Người thực hiện.
- [ ] **F9** **Mới**: cây 4 mức thu gọn được, tải lại trang vẫn nhớ trạng thái (`localStorage`).

## G. Đề nghị

- [ ] **G1** Thêm / sửa / xoá đề nghị.
- [ ] **G2** Đủ 11 trường: mã, loại, mã công việc, mã nhiệm vụ, nội dung, URL, nhà cung cấp,
      người đề nghị, ngày, trạng thái, ghi chú duyệt.
- [ ] **G3** 4 thẻ trạng thái kèm số đếm: Đề xuất mới / Chờ duyệt / Đã duyệt / Từ chối.
- [ ] **G4** 2 loại Trong kế hoạch / Ngoài kế hoạch; form đổi theo loại.
- [ ] **G5** Chọn nhiệm vụ chỉ trong phạm vi công việc đã chọn.
- [ ] **G6** Tìm kiếm đề nghị.

## H. Chat nội bộ

- [ ] **H1** Gửi tin nhắn chung cho cả đơn vị.
- [ ] **H2** Đọc tin 3 ngày gần nhất, tối đa 50 tin.
- [ ] **H3** Badge số tin mới; đọc rồi thì badge về 0.
- [ ] **H4** Link trong tin nhắn tự nhận thành liên kết bấm được.

## I. Quản lý App

- [ ] **I1** Thêm / sửa / xoá app — chỉ `admin`.
- [ ] **I2** Đủ 8 trường: mã, tên, URL, icon, mô tả, người tạo, danh mục, phân quyền.
- [ ] **I3** Lưới app; bấm mở app ở tab mới.

## J. Thông báo & nhật ký

- [ ] **J1** Tạo thông báo cho người dùng; người nhận thấy đúng.
- [ ] **J2** Nhiệm vụ quá hạn tự sinh thông báo, chạy hằng ngày theo `CRON_OVERDUE`. Đợi đúng
      một lần chạy thật, không chỉ gọi tay.
- [ ] **J3** Nhật ký hoạt động toàn hệ thống ghi đủ thêm / sửa / xoá.

## K. Luồng duyệt — hoàn toàn mới

- [ ] **K1** Trưởng phòng / Phó phòng tạo Công việc hoặc Công việc con ⇒ trạng thái `Chờ duyệt`.
- [ ] **K2** `admin` và Phó GĐ tạo ⇒ `Đã duyệt` ngay.
- [ ] **K3** Nhiệm vụ cấp 3 **không** cần duyệt, dùng được ngay.
- [ ] **K4** Duyệt / Từ chối kèm lý do; nút chỉ hiện với `admin` và Phó GĐ **phụ trách phòng đó**.
- [ ] **K5** Cả phòng thấy mục `Chờ duyệt` kèm nhãn vàng.
- [ ] **K6** Mục `Chờ duyệt` **không** cộng vào bất kỳ thẻ số hay biểu đồ nào. Kiểm bằng cách
      ghi lại 4 thẻ số, tạo một mục chờ duyệt, xem 4 số **không đổi**.
- [ ] **K7** Badge đếm số mục chờ duyệt trên menu.
- [ ] **K8** Thông báo: Phó GĐ nhận khi có mục mới chờ; người tạo nhận khi được duyệt / bị từ chối.

## L. Lọc — mới

- [ ] **L1** Lọc theo tháng tính theo **giao nhau**: việc kéo dài 3 tháng phải hiện ở cả 3 tháng.
- [ ] **L2** Lọc theo phòng; người không phải `admin` / Phó GĐ chỉ thấy phòng mình.

## M. Tiện ích mới trên VPS

- [ ] **M1** Xuất Excel: danh sách công việc 3 tầng, nhiệm vụ theo người, thống kê theo phòng.
      Mở file bằng Excel thật, kiểm tiếng Việt không lỗi phông.
- [ ] **M2** `npm run seed:dev` nạp dữ liệu mẫu; **chạy lại lần 2 không nhân đôi** bất kỳ bảng nào
      (đếm lại 12 bảng trước và sau). Thử đặt `NODE_ENV=production` ⇒ phải **từ chối và thoát**,
      không ghi một dòng nào.
- [ ] **M3** Sao lưu tự động hằng ngày **và** đã thử phục hồi thành công một lần từ bản sao lưu.
- [ ] **M4** `/healthz` trả 200 cho Nginx; `/readyz` trả 503 khi tắt cơ sở dữ liệu.

---

## Checklist khói §8.5 — 6 nhóm / 60 điểm

**Lượt chạy: 2026-08-25 · Phase 4 · nhánh `vps/phase-4-frontend`.**

Môi trường: Nginx (cổng 8099) phục vụ tệp tĩnh trong `web/` và chuyển `/api/*` sang Express 5,
PostgreSQL 16 với cơ sở dữ liệu **riêng** `quanlycongviec_uat` nạp bằng `npm run seed:dev`
(không chạm vào dữ liệu dev). Mọi điểm đi đúng đường thật của người dùng:
`google.script.run.<tên cũ>` → `web/assets/js/api-bridge.js` → `POST /api/rpc/<tên>`
(kèm `X-CSRF-Token`) → `/api/v1` → cơ sở dữ liệu.

Chạy lại: `bash tools/smoke-8.5.sh` — in mã HTTP từng điểm, tự dọn các dòng nó tạo ra và
kết thúc bằng số dòng còn lại để đối chiếu với seed (9 công việc / 30 đầu việc).

Ký hiệu: ✅ xanh · ❌ **đỏ** (đã chuyển mà sai) · ⏳ chưa chuyển, chờ Phase sau (không tính đỏ)
· — bản cũ không có điểm này.

**Tổng: 19 ✅ · 2 ❌ · 38 ⏳ · 1 —**

### 1. Đăng nhập — 6/6 ✅

| Mã | Điểm kiểm | KQ | Bằng chứng |
|---|---|---|---|
| Đ1 | Đăng nhập admin | ✅ | `[200] authenticateUser`; nhập email **VIẾT HOA** vẫn vào được (bản cũ trượt ở đây — UAT **A1**) |
| Đ2 | Sai mật khẩu | ✅ | `[401] INVALID_CREDENTIALS` — «Email hoặc mật khẩu không đúng», không lộ email có tồn tại hay không |
| Đ3 | Đổi mật khẩu | ✅ | Trước khi đổi mọi lời gọi nghiệp vụ bị `403 MUST_CHANGE_PASSWORD` (việc 4.5); chữ ký 2 tham số của bản cũ → `400` «Thiếu tham số «Mật khẩu hiện tại»»; nhập lại không khớp → `400`; đủ 3 tham số → `200`, thu hồi 4 phiên; sau đó `getProjects` `200` |
| Đ4 | Đăng xuất | ✅ | `[200] logout` rồi `getProjects` `[401] UNAUTHENTICATED` ⇒ giao diện bật lại modal đăng nhập |
| Đ5 | Vào lại | ✅ | Mật khẩu **cũ** `401`, mật khẩu **mới** `200` |
| Đ6 | Hết phiên | ✅ | `UPDATE sessions SET expires_at = now() - interval '1 hour'` ⇒ `[401]`, không đi tiếp bằng phiên cũ |

### 2. Tổng quan — 0/10, cả nhóm ⏳ (chưa chuyển)

| Mã | Điểm kiểm | KQ | Bằng chứng |
|---|---|---|---|
| T1–T4 | 4 thẻ số có số (kèm bấm vào số mở đúng danh sách) | ⏳ | `[501] getDataForUser`, `[501] getInitialDataWithAuth`, `[501] getDepartmentContext` |
| T5–T10 | 6 biểu đồ vẽ ra + «hoạt động gần đây» có dòng | ⏳ | cùng 3 tên trên; không có nguồn dữ liệu nào khác cho đầu trang |

Cả 10 điểm bị chặn bởi **một** nguyên nhân: 3 tên nạp dữ liệu đầu trang còn `pending()`.
Chúng thuộc việc **5.1** (`GET /api/v1/bootstrap`) của Phase 5. Đã kiểm được phần cầu nối
làm đúng phần của nó: khi **chưa** đăng nhập, `getInitialDataWithAuth` trả
`[200] {"requireLogin":true}` chứ **không** trả 501 — giao diện vì thế vẫn hiện modal
đăng nhập thay vì báo lỗi máy chủ.

### 3. Công việc — 13/14 ✅, 1 ❌

| Mã | Điểm kiểm | KQ | Bằng chứng |
|---|---|---|---|
| C1 | Tạo công việc | ✅ | `[200] addProjectWithAuth` → `CV019` |
| C2 | Sửa | ✅ | `[200] updateProjectWithAuth` → `CV019` |
| C3 | Xoá | ✅ | `[200] deleteProjectWithAuth` → xoá cả cây con: `deletedItems:["CV019-071","CV019-072"], deletedCount:3` |
| C4 | Nhân bản | ✅ | `[200] copyProjectWithAuth` → «Đã nhân bản thành **CV020** (kèm 9 dòng con)» |
| C5 | Tìm kiếm | ✅ | Lọc chạy ở giao diện, dữ liệu do `[200] getProjects` cấp (đủ 13 cột tên tiếng Việt bản cũ) |
| C6 | Mở chi tiết | ✅ | `[200] getTasks` (đây là chỗ N+1 lời gọi đã ghi ở §13.5) |
| C7 | **Tạo công việc con (cấp 2)** | ❌ | `[200] addTaskWithAuth` → `CV019-071`, nhưng `csdl: CV019-071 **cấp=3 cha=NULL**` |
| C8 | Tạo nhiệm vụ (cấp 3) | ✅ | `[200] addTaskWithAuth` → `CV019-072` |
| C9 | Kéo–thả | ✅ | `[200] reorderTasks` đổi đúng thứ tự 9 mã; mã lạ bị `skipped:["MÃ-KHÔNG-CÓ"]` chứ không làm đổ cả lệnh |
| C10 | Nhắc việc — thêm | ✅ | `[200] addTaskReminder` ×2 → `id:10`, `id:11` |
| C11 | Nhắc việc — sửa | ✅ | `[200] updateTaskReminder` sửa **theo số thứ tự** của bản cũ, đổi đúng dòng `id:11` (bẫy index→id, §13.5); số thứ tự ngoài danh sách → `[404]` «Không tìm thấy nhắc việc cần sửa (danh sách đã đổi)» |
| C12 | Nhắc việc — xoá | ✅ | `[200] deleteTaskReminder` → còn đúng 1 dòng |
| C13 | Link kết quả | ✅ | `[200] updateTaskWithAuth`; `csdl: 3 link: ["[Báo cáo] https://vd.local/bc.pdf", "https://vd.local/anh.png", "không-phải-link"]` — mỗi dòng một link, giữ nguyên phần `[Tên]`, dòng rác vẫn lưu chứ không chặn người dùng |
| C14 | Hoàn thành nhanh | ✅ | `[200] updateTaskWithAuth` — một cú bấm đặt trạng thái + 100% + ngày báo cáo |

**❌ C7** không phải lỗi cầu nối mà là **khoảng trống của giao diện cũ**: `#task-form` không có ô
nào tên `level` hay `Mã cha`; `COL.T_LEVEL` và `COL.T_PARENT` chỉ được khai ở bảng `COL`
([app.js:56-57](../web/assets/js/app.js#L56-L57)) rồi không chỗ nào đọc/ghi. Vì thế mọi đầu việc
do bản cũ tạo đều là **cấp 3 không cha**. Cầu nối không được phép tự thêm ô mới (điều lệ đầu
`app.js`: cấm đổi tên hàm / đổi id DOM ở Phase 4), nên điểm này ở lại đỏ và phải xử ở Phase sau
bằng cách thêm ô chọn cấp + cha vào biểu mẫu.

### 4. Duyệt — 0/8, 1 ❌ + 7 ⏳

| Mã | Điểm kiểm | KQ | Bằng chứng |
|---|---|---|---|
| D1 | **Trưởng phòng tạo ra `Chờ duyệt`** | ❌ | tp01 (Trưởng phòng, phòng 1) tạo `CV021` → `csdl: CV021 **duyệt=Đã duyệt**`. Đối chứng: admin tạo `CV022` cũng «Đã duyệt» ⇒ trạng thái không phụ thuộc vai trò |
| D2 | Nhãn vàng hiện | ⏳ | không có dòng `Chờ duyệt` nào để hiện |
| D3 | Badge đếm đúng | ⏳ | như trên |
| D4 | Phó GĐ thấy nút | ⏳ | trong 37 tên hàm cũ (§5.2) **không có** tên nào cho duyệt/từ chối |
| D5 | Duyệt | ⏳ | như trên |
| D6 | Từ chối | ⏳ | như trên |
| D7 | Thông báo tới | ⏳ | như trên |
| D8 | Thống kê không đổi khi chờ duyệt | ⏳ | phụ thuộc nhóm 2 (chưa có thẻ số) |

**❌ D1**: cột `works.approval_status` có mặc định `'Đã duyệt'::text` và **không** chỗ nào trong
Phase 3/4 đặt «Chờ duyệt» theo vai trò người tạo. Đó là việc **5.2** của Phase 5. Ghi là đỏ vì
đây là điểm §8.5 đã kiểm được và cho kết quả **sai** với nghiệp vụ, khác với D2–D8 là chưa
chuyển. Giao diện cũ cũng không có nút nào cho duyệt công việc (đếm được **0** chỗ trong
`app.js` nhắc tới duyệt công việc; cả 3 chuỗi «Chờ duyệt» đều thuộc phần **đề nghị**).

### 5. Người dùng & Phòng — 0/10, cả nhóm ⏳

| Mã | Điểm kiểm | KQ | Bằng chứng |
|---|---|---|---|
| N1–N3 | Thêm / sửa / xoá người dùng | ⏳ | `[501] addStaffWithAuth`, `updateStaffWithAuth`, `deleteStaffWithAuth` |
| N4 | Gán phòng | ⏳ | `[501] updateStaffWithAuth` |
| N5 | Gán vai trò phòng | ⏳ | như trên |
| N6–N7 | Thêm / sửa phòng | ⏳ | `[501] addDepartmentWithAuth`, `updateDepartmentWithAuth` |
| N8 | Gán Phó Giám đốc | ⏳ | `[501] updateDepartmentWithAuth` |
| N9 | Xoá phòng còn người ⇒ bị chặn | ⏳ | `[501] deleteDepartmentWithAuth` |
| N10 | Xoá phòng rỗng ⇒ được | ⏳ | như trên |

Cả 7 tên hàm của nhóm này còn `pending()` (cùng với `getStaffList`). Nghiệp vụ bên dưới **đã có
và đã có test** ở Phase 2–3 (`repo-departments.test.js`, `work-items-department.test.js`,
`rbac-matrix.test.js`); chỉ còn thiếu lớp ánh xạ tên cũ → `/api/v1`, là việc **5.5–5.6** của Phase 5.

### 6. Còn lại — 0/12, 11 ⏳ + 1 —

| Mã | Điểm kiểm | KQ | Bằng chứng |
|---|---|---|---|
| R1–R3 | Gantt 1 / 2 / 3 tháng | ⏳ | Gantt **không** có lời gọi máy chủ riêng, vẽ từ `allTasks`/`allProjects` ⇒ chặn theo nhóm 2 |
| R4–R6 | Nhóm theo 3 kiểu | ⏳ | như trên |
| R7 | Thu gọn | ⏳ | như trên |
| R8 | Đề nghị — tạo | ⏳ | `[501] getProposals`, `[501] addProposalWithAuth` |
| R9 | Đề nghị — sửa | ⏳ | `[501] updateProposalWithAuth` |
| R10 | Chat gửi / nhận | ⏳ | `[501] getChatMessages`, `[501] sendChatMessage` |
| R11 | App mở được | ⏳ | `[501] addApp` |
| R12 | Xuất 3 file Excel | — | `app.js` **không có** hàm xuất nào (không `XLSX`, không `export*`): đây là tính năng **mới** của bản VPS (§2.13, mã UAT **M1**), lịch Phase 7 |

### Kiểm lại tài sản tĩnh qua Nginx thật (việc 4.3 + 4.8)

- `/` và `/index.html` → `200 text/html; charset=utf-8`, 70 272 B, **không** có `Cache-Control` dài.
- `assets/css/app.css?v=20260825` 80 443 B · `assets/js/api-bridge.js?v=20260825` 16 933 B ·
  `assets/js/app.js?v=20260825` 304 952 B — tất cả `200`.
- 5 gói tự chứa đều `200` kèm `cache-control: public, max-age=2592000`:
  `assets/vendor/tailwind/tailwind.min.css` 39 780 B · `chartjs/chart.umd.min.js` 208 522 B ·
  `alpinejs/alpine.min.js` 54 447 B · `fontawesome/css/all.min.css` 102 025 B · `inter/inter.css` 7 263 B.
- Đủ đầu bảo vệ trên mọi phản hồi: `nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`,
  COOP, `Permissions-Policy` và CSP.
- Tệp không tồn tại → `404` **có** đầu bảo vệ nhưng **không** có cache 30 ngày (bẫy `always`, §13.5).
- Tìm `cdn.tailwindcss.com|cdnjs|googleapis` trong HTML được phục vụ: **0 chỗ**.

### Ba điểm phải làm gì tiếp

1. **C7** — thêm ô chọn cấp + công việc cha vào `#task-form` (Phase sau, vì Phase 4 bị cấm đổi DOM).
2. **D1** — đặt `approval_status = 'Chờ duyệt'` khi người tạo là Trưởng/Phó phòng: việc **5.2**.
3. **38 điểm ⏳** — đều quy về việc **5.1** (`GET /api/v1/bootstrap`, mở nhóm 2 và R1–R7) và
   **5.5–5.8** (nhân sự/phòng, đề nghị, chat, app). Không có điểm nào ⏳ vì cầu nối sai.

---

## Ghi chú nghiệm thu

| Ngày | Mã | Hiện tượng | Đã xử lý |
|---|---|---|---|
| 2026-08-25 | §8.5 C7 | Biểu mẫu cũ không tạo được công việc con cấp 2: `CV019-071` vào csdl với `cấp=3 cha=NULL`; `COL.T_LEVEL`/`COL.T_PARENT` khai ở `app.js:56–57` rồi không dùng | Chưa — chờ thêm ô cấp/cha vào `#task-form` (Phase 4 bị cấm đổi DOM) |
| 2026-08-25 | §8.5 D1 | Trưởng phòng tạo `CV021` nhưng `approval_status` ra «Đã duyệt» (mặc định cột) | Chưa — việc 5.2 của Phase 5 |


