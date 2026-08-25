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

**Lượt chạy lại: 2026-08-25 · Phase 6 · nhánh `vps/phase-6-stats` · HEAD `3df2e44`.**
(Lượt trước: Phase 5 · `57cfa89` · 36 ✅ · 23 ⏳.)

Môi trường lượt này: Node trên máy thật cổng 3000 với `DATABASE_URL=…/quanlycongviec_uat`
(`BASE=http://127.0.0.1:3000`, không cần Nginx cho phần API; migration đã đứng ở 004 từ
Phase 5 nên không phải migrate thêm). Bộ khói **đã mở rộng** theo đúng ghi nợ §13.5: thêm
helper `rest` (GET `/api/v1/*` bằng cookie phiên) và các điểm mới — T5–T10 gọi thẳng
`/stats/charts?type=` ×6 + `/stats/summary` + `/stats/activities`; R1–R7 gọi
`/gantt?groupBy=department|deputy|assignee` + cửa sổ from/to. Chữ lạc hậu «cả 7 còn 501» (N1)
và «getTasks N+1» (C6) cũng đã sửa.

Mọi điểm đi đúng đường thật của người dùng: `google.script.run.<tên cũ>` →
`web/assets/js/api-bridge.js` → `POST /api/rpc/<tên>` (kèm `X-CSRF-Token`) → `/api/v1` → CSDL.
Từ Phase 6, Tổng quan/Gantt còn đi đường REST MỚI: `GET /api/v1/stats|gantt`.

Chạy lại: `bash tools/smoke-8.5.sh` — in mã HTTP từng điểm, tự dọn các dòng nó tạo ra và
kết thúc bằng số dòng còn lại để đối chiếu với seed (**9 công việc / 30 đầu việc**).

Ký hiệu: ✅ xanh · ❌ **đỏ** (đã chuyển mà sai) · ⏳ chưa chuyển / chưa kiểm hết trên đường khói
· — bản cũ không có điểm này.

**Tổng: 49 ✅ · 0 ❌ · 10 ⏳ · 1 —** (đếm theo 60 ô checklist, không đếm hai lần)

- 49 ✅ = Đ1–Đ6 (6) + T1–T10 (**đủ 4 thẻ có số thật + 6 biểu đồ vẽ từ server + hoạt động có phân trang**, 10) + C1–C14 (14) + D1–D2 (2) + N1–N10 (10) + R1–R7 (**Gantt cây 4 mức nhóm 3 kiểu + cửa sổ ngày**, 7).
- 0 ❌ — không phát hiện hồi quy mới trong phase này.
- 10 ⏳ = D3–D8 nút/badge UI duyệt trên cây (6) + R8–R11 đề nghị/chat/app (4) — cả hai nhóm là Phase 7/UI sau.
- 1 — = R12 xuất Excel (Phase 7, bản cũ không có).

Đối chiếu số liệu Apps Script ↔ VPS (việc **6.9**, TC-STAT-16): hai thuật toán cũ được port 1:1
(`getSummaryStats` của Code.clean.gs và `renderStats`/`render*Chart` của app.js — **UI tự tính
lại, bỏ qua tham số summaryStats, allTasks gồm cả cấp 2**) chạy trên cùng gói legacy rồi so với
REST mới ở tầng CẤP 3: **chênh 0 từng con số** ở 4 thẻ + 6 biểu đồ. Dòng chênh duy nhất có chủ ý:
«Tổng nhiệm vụ» UI cũ đếm thêm cấp 2 (bộ dữ liệu đối chiếu: chênh đúng 2 đơn vị) — chuẩn §0.1.
Chi tiết: `server/tests/integration/stats-parity.test.js`.

### 1. Đăng nhập — 6/6 ✅

| Mã | Điểm kiểm | KQ | Bằng chứng |
|---|---|---|---|
| Đ1 | Đăng nhập admin | ✅ | `[200] authenticateUser`; nhập email **VIẾT HOA** vẫn vào được (bản cũ trượt ở đây — UAT **A1**) |
| Đ2 | Sai mật khẩu | ✅ | `[401] INVALID_CREDENTIALS` — «Email hoặc mật khẩu không đúng», không lộ email có tồn tại hay không |
| Đ3 | Đổi mật khẩu | ✅ | Trước khi đổi mọi lời gọi nghiệp vụ bị `403 MUST_CHANGE_PASSWORD` (việc 4.5); chữ ký 2 tham số của bản cũ → `400` «Thiếu tham số «Mật khẩu hiện tại»»; nhập lại không khớp → `400`; đủ 3 tham số → `200`, thu hồi 4 phiên; sau đó `getProjects` `200` |
| Đ4 | Đăng xuất | ✅ | `[200] logout` rồi `getProjects` `[401] UNAUTHENTICATED` ⇒ giao diện bật lại modal đăng nhập |
| Đ5 | Vào lại | ✅ | Mật khẩu **cũ** `401`, mật khẩu **mới** `200` |
| Đ6 | Hết phiên | ✅ | `UPDATE sessions SET expires_at = now() - interval '1 hour'` ⇒ `[401]`, không đi tiếp bằng phiên cũ |

### 2. Tổng quan — 10/10 ✅ (Phase 6: vẽ từ server)

| Mã | Điểm kiểm | KQ | Bằng chứng |
|---|---|---|---|
| T1–T4 | 4 thẻ số có **nguồn** (kèm bấm vào số mở đúng danh sách) | ✅ nguồn | `[200] getDataForUser`, `[200] getInitialDataWithAuth`, `[200] getDepartmentContext`. Gói `GET /api/v1/bootstrap` trả `summaryStats` + `chartData` + `pendingCount` + `activities` đọc qua `v_countable_*` (việc 5.4). |
| T5–T10 | 6 biểu đồ vẽ ra + «hoạt động gần đây» có dòng | ✅ Phase 6 | Bộ khói gọi thẳng REST mới, đủ 6 loại đều `[200]` với `{labels,data}` đúng hình dạng Chart.js: `status` / `project-progress` / `staff-performance` / `task-priority` / `timeline-progress` / `project-comparison`; kèm `[200] GET stats/summary` (7 công việc · 16 nhiệm vụ · 8 hoàn thành · 8 đang · 2 quá hạn trên dữ liệu khói) và `[200] GET stats/activities?page=1&limit=22` (phân trang, nút «Xem thêm»). app.js nạp bằng `napTongQuanTuServer()` khi vào Tổng quan; đếm qua `v_countable_*` — thêm mục Chờ duyệt không làm lệch một đơn vị (TC-STAT-05, TC-APR-06 ở `stats-api.test.js`). |

Khi **chưa** đăng nhập, `getInitialDataWithAuth` vẫn trả `[200] {"requireLogin":true}` chứ **không**
401/501 — giữ nguyên ngoại lệ Phase 4. Lần khói đầu session này 500 `INTERNAL` vì UAT thiếu
migration 004 (xem đầu mục); không phải lỗi code.

### 3. Công việc — 14/14 ✅ (C7 hết đỏ, việc 5.12)

| Mã | Điểm kiểm | KQ | Bằng chứng |
|---|---|---|---|
| C1 | Tạo công việc | ✅ | `[200] addProjectWithAuth` |
| C2 | Sửa | ✅ | `[200] updateProjectWithAuth` |
| C3 | Xoá | ✅ | `[200] deleteProjectWithAuth` → xoá cả cây con, `deletedCount:3` |
| C4 | Nhân bản | ✅ | `[200] copyProjectWithAuth` |
| C5 | Tìm kiếm | ✅ | Lọc chạy ở giao diện, dữ liệu do `[200] getProjects` cấp |
| C6 | Mở chi tiết | ✅ | `[200] getTasks` — **nợ N+1** vẫn còn, gộp ở việc **6.x / Phase 6** (§13.5) |
| C7 | **Tạo công việc con (cấp 2)** | ✅ | Việc 5.12 phương án (b): nút «+ công việc con» trên cây + ô ẩn `level`/`parent`. Khói gửi `level:"2", parent:""` → `csdl: CV028-093 **cấp=2 cha=NULL`**. Không thêm `<select name="level">`. Nhân viên tạo cấp 2 qua RPC → 403 (`TC-RPC-24d`). |
| C8 | Tạo nhiệm vụ (cấp 3) | ✅ | `[200] addTaskWithAuth` → `CV028-094` (không gửi level ⇒ REST mặc định 3). Có cảnh báo `ASSIGNEE_NOT_FOUND` nếu tên người không khớp — không làm đổ lệnh. |
| C9 | Kéo–thả | ✅ | `[200] reorderTasks`; mã lạ bị `skipped` |
| C10 | Nhắc việc — thêm | ✅ | `[200] addTaskReminder` |
| C11 | Nhắc việc — sửa | ✅ | `[200] updateTaskReminder` theo **số thứ tự** bản cũ (bẫy index→id) |
| C12 | Nhắc việc — xoá | ✅ | `[200] deleteTaskReminder` |
| C13 | Link kết quả | ✅ | `[200] updateTaskWithAuth`; jsonb giữ nguyên `[Tên]` và dòng rác |
| C14 | Hoàn thành nhanh | ✅ | `[200] updateTaskWithAuth` — một cú bấm: trạng thái + 100% + ngày báo cáo |

C7 **không** còn là khoảng trống giao diện: `#task-form` có hai ô ẩn `#task-create-level` /
`#task-create-parent`; bấm hàng công việc ⇒ cấp 2 không cha; bấm hàng công việc con ⇒ cấp 3
kèm `parentRef`; «+ Thêm» đứng riêng vẫn cấp 3. Test: `dom-contract.test.js`,
`task-from-legacy-level.test.js`, `subwork-button-ui.test.js`, `rpc-bridge` TC-RPC-24b/c/d.

### 4. Duyệt — D1–D2 ✅; D3–D8 máy chủ xong, nút UI ⏳

| Mã | Điểm kiểm | KQ | Bằng chứng |
|---|---|---|---|
| D1 | **Trưởng phòng tạo ra `Chờ duyệt`** | ✅ | Việc 5.1. tp01 tạo → `csdl: CV030 **duyệt=Chờ duyệt**`. |
| D2 | admin tạo ⇒ `Đã duyệt` (đối chứng) **và** nhãn vàng trên cây | ✅ máy chủ / ✅ nhãn | admin tạo → `csdl: CV031 **duyệt=Đã duyệt**`. Nhãn vàng `pendingApprovalBadge` (việc 5.6) gắn 5 chỗ vẽ (thẻ công việc, bảng nhiệm vụ, list, Gantt-hàng, chi tiết). Test `pending-badge.test.js`. |
| D3 | Badge đếm đúng | ⏳ UI | Máy chủ: `GET /api/v1/approvals/pending-count` + khoá `pendingCount` trong bootstrap (việc 5.5), có test. `app.js` **không** đọc `pendingCount` của gói bootstrap — `#projects-pending-count` / `#tasks-pending-count` đang đếm trạng thái **«Chưa bắt đầu / Tạm dừng»**, không phải chờ duyệt. Script khói `grep approveWork\|rejectWork\|duyet\|approval` in `0` vì **quá hẹp** (`pendingApprovalBadge` đã có); đừng lấy con số đó làm bằng chứng «chưa có nhãn». |
| D4 | Phó GĐ thấy nút Duyệt | ⏳ UI | REST `POST /api/v1/approvals/:entity/:id/{submit,approve,reject}` **đã có** (việc 5.2–5.3, test `approvals-api.test.js`). **Không** có tên RPC tương ứng trong 37 tên. `app.js` **không** có nút Duyệt/Từ chối trên hàng công việc / công việc con — chỉ còn chỗ duyệt **đề nghị** (Phase 7). |
| D5 | Duyệt | ⏳ UI | Như D4. Khói không gọi REST approve. Đừng tô xanh chỉ vì test máy chủ xanh. |
| D6 | Từ chối (lý do ≥ 10 ký tự) | ⏳ UI | Như D4. Service chặn lý do rỗng / ngắn; XSS lý do từ chối có test. |
| D7 | Thông báo tới | ⏳ UI | Việc 5.7 ghi bảng `notifications` khi có mục mới chờ / được duyệt / bị từ chối. Khói không đọc bảng này. Badge thông báo trên UI chưa nối lại sau mỗi lần duyệt. |
| D8 | Thống kê không đổi khi chờ duyệt | ⏳ đối chiếu | Việc 5.4: hai view + test EXPLAIN. Bootstrap thống kê đọc view. Đối chiếu **4 thẻ + 6 biểu đồ không đổi một đơn vị** trên UI là việc **6.1/6.2/6.9**. |

Script khói D3–D8 vẫn in «không có tên hàm cũ» + `grep` = 0 — đó là **nợ của bộ khói**, không
phải bằng chứng máy chủ thiếu. Máy chủ 5.1–5.7 **đã có test**; phần còn thiếu để tô xanh D3–D8
là **nút trên cây + badge đọc `pendingCount`**. Việc này **không** thuộc Phase 6 (thống kê/Gantt)
— ghi ở đây để session sau không quên, và **không** tự mở rộng Phase 6 làm luôn.

### 5. Người dùng & Phòng — RPC đã nối (việc 5.11); khói dummy args không phải 501

| Mã | Điểm kiểm | KQ | Bằng chứng |
|---|---|---|---|
| N1–N3 | Thêm / sửa / xoá người dùng | ✅ RPC | `getStaffList` `[200]` mảng thô. `addStaffWithAuth` với `{}` → `[400]` «Tên nhân viên là bắt buộc.» (validation, **không** 501). `updateStaffWithAuth`/`deleteStaffWithAuth` với `{}` → `[404]` vì id `"[object Object]"` — bộ khói gửi `'{"args":[{}]}'` cho cả 7 tên. REST `/api/v1/users` **viết ở việc 5.11** (không có từ Phase 1 — §7 câu cũ đã sửa). |
| N4 | Gán phòng | ✅ RPC | Cùng `updateStaffWithAuth` → REST PATCH users. |
| N5 | Gán vai trò phòng | ✅ RPC | như trên |
| N6–N7 | Thêm / sửa phòng | ✅ RPC | `addDepartmentWithAuth` `{}` → `[400]`; `updateDepartmentWithAuth` đã chạy từ Phase 4. |
| N8 | Gán Phó Giám đốc | ✅ RPC | `updateDepartmentWithAuth` |
| N9 | Xoá phòng còn người ⇒ bị chặn | ✅ RPC | `deleteDepartmentWithAuth` đã nối; nghiệp vụ chặn phòng còn người nằm ở service (test `users-departments-crud.test.js`). Khói không gửi mã phòng thật. |
| N10 | Xoá phòng rỗng ⇒ được | ✅ RPC | như trên; seed có `PH05` rỗng. |

Cả 7 tên **không còn `pending()`**. Bộ khói vẫn ghi chú «cả 7 còn 501» — **nợ comment**, không
phải trạng thái thật. Happy-path (thêm nhân sự đủ trường, xoá PH05) **chưa** nằm trong
`smoke-8.5.sh`; đã kiểm tay `addStaffWithAuth` thiếu tên → 400 đúng. Đừng báo N* «xong UAT tay»
chỉ vì hết 501.

### 6. Còn lại — R1–R7 ✅ Phase 6; R8–R11 ⏳ Phase 7; R12 —

| Mã | Điểm kiểm | KQ | Bằng chứng |
|---|---|---|---|
| R1–R3 | Gantt 1 / 2 / 3 tháng | ✅ Phase 6 | `GET /api/v1/gantt?from=&to=` — bộ khói gọi cửa sổ 30→90 ngày `[200]` trả cây đúng khoảng (việc ngoài hẳn biến mất, việc vắt qua còn). Ô «Xem: 1/2/3 tháng» đặt `ganttEndDate = start + n×30 − 1` (n=3 đúng 90 ngày như mặc định cũ); thanh **cắt hai đầu** / **ẩn khi ngoài khoảng** do `tests/unit/gantt-ui.test.js` canh (TC-STAT-13/14). |
| R4–R6 | Nhóm theo 3 kiểu | ✅ Phase 6 | Ba lượt khói `[200] GET gantt?groupBy=department / deputy / assignee`. Thứ tự phòng theo `sort_order` (TC-STAT-11); Phó GĐ phụ trách 2 phòng gộp MỘT nhóm (TC-STAT-12) — cả hai có test riêng trong `gantt-api.test.js`. |
| R7 | Thu gọn | ✅ Phase 6 | Việc **6.8**: nút thu gọn ở cả 3 mức Nhóm/Công việc/Công việc con, khoá lưu `localStorage` (`qlcv_gantt_collapsed`), tải lại trang vẫn giữ — TC-STAT-15 trong `gantt-ui.test.js`. |
| R8 | Đề nghị — tạo | ⏳ | `[501] getProposals`, `[501] addProposalWithAuth` — Phase 7 |
| R9 | Đề nghị — sửa | ⏳ | `[501] updateProposalWithAuth` — Phase 7 |
| R10 | Chat gửi / nhận | ⏳ | `[501] getChatMessages`, `[501] sendChatMessage` — Phase 7 |
| R11 | App mở được | ⏳ | `[501] addApp` — Phase 7. Còn `updateApp`/`deleteApp`/`addNotificationWithAuth` cũng 501. |
| R12 | Xuất 3 file Excel | — | `app.js` **không có** hàm xuất nào. Tính năng mới §2.13 / UAT **M1**, lịch Phase 7. |

RPC còn `pending()` **đúng 10 tên**: `getProposals`, `addProposalWithAuth`, `updateProposalWithAuth`,
`deleteProposalWithAuth`, `addApp`, `updateApp`, `deleteApp`, `getChatMessages`, `sendChatMessage`,
`addNotificationWithAuth`. **27/37** đã chạy thật.

### Kiểm lại tài sản tĩnh qua Nginx thật (việc 4.3 + 4.8) — giữ từ Phase 4

- `/` và `/index.html` → `200 text/html; charset=utf-8`, **không** có `Cache-Control` dài.
- `assets/js/app.js?v=20260825-512` (tăng tay sau việc 5.12).
- 5 gói tự chứa `200` kèm `cache-control: public, max-age=2592000`.
- Đủ đầu bảo vệ; 404 **không** cache 30 ngày; 0 CDN.

### Việc tiếp theo (không còn điểm đỏ)

1. **Phase 7** — đề nghị / quản lý app / chat / xuất Excel: §7 việc 7.1–7.6; 10 tên RPC còn 501;
   quyền xuất chỉ trong phạm vi được thấy (**7.6** dễ thành lỗ rò). `addNotificationWithAuth` cũng để đó.
2. **D3–D8 UI** — nút Duyệt/Từ chối trên cây + badge đọc `pendingCount`. Máy chủ REST xong từ
   Phase 5, không có tên RPC; vẫn chưa ai yêu cầu làm.
3. **Nợ nhỏ để lại của Phase 6**: modal «bấm số mở danh sách» lọc tháng/phòng **ở trình duyệt**
   trên mảng đã do máy chủ chạm phạm vi (không có đường rò); nếu muốn lọc qua server thì thêm
   `GET /stats/items` ở một session sau. Gantt nhóm `assignee` hiện đưa công việc vào nhóm của
   MỖI người có nhiệm vụ trong đó và hiện toàn cây con — nếu muốn chỉ hiện nhánh của người đó
   thì sửa `nhomTheoAssignee`.

---

## Ghi chú nghiệm thu

| Ngày | Mã | Hiện tượng | Đã xử lý |
|---|---|---|---|
| 2026-08-25 | §8.5 C7 | Biểu mẫu cũ không tạo được công việc con cấp 2: `CV019-071` vào csdl với `cấp=3 cha=NULL`; `COL.T_LEVEL`/`COL.T_PARENT` khai ở `app.js:56–57` rồi không dùng | ✅ 2026-08-25 việc **5.12** phương án (b): nút «+ công việc con» trên cây + ô ẩn; khói `CV028-093 cấp=2 cha=NULL`. Không thêm ô «Cấp». |
| 2026-08-25 | §8.5 D1 | Trưởng phòng tạo `CV021` nhưng `approval_status` ra «Đã duyệt» (mặc định cột) | ✅ 2026-08-25 việc **5.1**: tp01 → `CV030 duyệt=Chờ duyệt`; admin → `CV031 duyệt=Đã duyệt`. |


