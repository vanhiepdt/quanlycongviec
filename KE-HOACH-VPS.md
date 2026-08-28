# Kế hoạch chuyển sang VPS — Quản lý công việc

Chốt ngày 24/08/2026. Đọc [HUONG-DAN-BAO-TRI.md](HUONG-DAN-BAO-TRI.md) để hiểu code hiện tại
và [KE-HOACH-PHAT-TRIEN.md](KE-HOACH-PHAT-TRIEN.md) để biết 6 tính năng đang làm dở trên bản
Apps Script. File này thay thế §3 (chia giai đoạn) của kế hoạch cũ.

## 0. Từ vựng và bốn quyết định đã chốt

### 0.1 Từ vựng — gọi đúng tên

Hệ cũ gọi cấp 1 là **"dự án"**. Bản VPS **bỏ hẳn** cách gọi đó: một "dự án" ở đây chỉ là một
đầu việc của phòng, không phải project theo nghĩa quản trị dự án. Từ 24/08/2026, tài liệu và
code mới dùng đúng ba từ sau:

| Cấp | Gọi là | Bảng | Mã | Ghi chú |
|---|---|---|---|---|
| 1 | **Công việc** | `works` | `CV0xx` | Có phòng, quản lý, ngày bắt đầu/kết thúc. **Không gọi là "dự án"** |
| 2 | **Công việc con** | `work_items` (`level = 2`) | `CV0xx-0yy` | Có phòng (luôn bằng phòng công việc cha); `parent_id` phải NULL (`lvl2_no_parent`) |
| 3 | **Nhiệm vụ** | `work_items` (`level = 3`) | `CV0xx-0yy` | Có phòng (luôn bằng phòng công việc cha); cha là một cấp 2 cùng công việc, hoặc NULL (nhiệm vụ mồ côi) |

Kéo theo ba hệ quả bắt buộc:

- **Cả ba cấp đều gắn phòng.** `works.department_id` và `work_items.department_id`; phòng của cấp
  2 và cấp 3 luôn bằng phòng của công việc cấp 1 chứa nó, do CSDL giữ chứ không do tầng JS
  (§4.1, `002_work_items_department.sql`). Đổi phòng thì đổi ở công việc cấp 1, cả cây đi theo.
- Vai trò là **`Quản lý công việc`**, không phải `Quản lý dự án`. Đây là giá trị nằm trong ràng
  buộc `users_role_valid` của cơ sở dữ liệu, viết sai là `INSERT` bị chặn — xem §5.2 và §8.3.
- Mọi con số thống kê chỉ đếm **cấp 3**. "Số nhiệm vụ" không bao giờ gồm cấp 2 (§2.1 C15).

**Ba thứ vẫn giữ nguyên chữ "dự án"**, cố ý, không phải sót:

1. Tên sheet, tên cột và tên hàm của hệ Google Sheets đang chạy: sheet `Dự án/Nhiệm vụ`, cột
   `Mã dự án`, giá trị `Quản lý dự án` trong cột phân quyền, các hàm `getProjects` /
   `addProject`. Đổi những cái này thì mất đường đối chiếu khi nhập dữ liệu (§4.3).
2. **Mã cũ** dạng `DA001`, `DA001-01`, `ID<yymmddhhmmssSSS>` của 28 dòng nhập tay ở Phase 9:
   giữ **nguyên văn**, không đánh số lại (§13.4 mục 6). Mã cũ và mã mới sống chung trong cùng
   một cột `code`; chỉ có mã **sinh mới** mới dùng tiền tố `CV`.
3. Chữ "dự án" khi nói về **chính phần mềm này** ("thư mục gốc của dự án", "dự án dùng Node 24").

Bản Apps Script cũ chỉ đổi **nhãn giao diện**; xem dòng 1 của §0 trong
[KE-HOACH-PHAT-TRIEN.md](KE-HOACH-PHAT-TRIEN.md).

### 0.2 Bốn quyết định đã chốt

| # | Vấn đề | Chốt |
|---|---|---|
| 1 | Stack backend | **Node.js 24 + Express + PostgreSQL 16** — giữ JavaScript nên 127 hàm hiện có port gần 1:1 |
| 2 | Frontend | **Port nguyên trạng**, chỉ thay lớp gọi API. Không viết lại React |
| 3 | Google Sheets | **Cắt hẳn** — nhập dữ liệu một lần, Sheets thành bản lưu trữ chỉ đọc. Bù lại: thêm chức năng **xuất Excel** |
| 4 | Hạ tầng | **Docker Compose + Nginx + Let's Encrypt** trên VPS |

Ba tính năng đang làm dở của bản Apps Script (3 tầng công việc, lọc, duyệt, Gantt) **không
làm tiếp trên Apps Script nữa** — chuyển thẳng thành yêu cầu của bản VPS. Phần backend GĐ2 đã
viết (`addTask`/`updateTask`/`deleteTask`/`getTasks` + 40 test) vẫn dùng được: đó là **đặc tả
hành vi** đã kiểm chứng, port sang SQL chứ không viết lại từ đầu.

## 1. Vì sao rời Apps Script — đo được, không phải cảm tính

| Vấn đề hiện tại | Số đo | Trên VPS |
|---|---|---|
| Cổng kiểm license của gsheets.vn chặn mọi hàm | **96 hàm** mở đầu bằng cùng một guard; sai một ký tự là toàn bộ backend im lặng trả `undefined` | Xoá sạch. Hết luôn vấn đề pháp lý vì đang dùng bản **bypass bản quyền** (§4.1 kế hoạch cũ) |
| Sheets là "cơ sở dữ liệu" | **61 lời gọi `getRange`**, không có transaction, khoá bằng `LockService` toàn script | Transaction ACID, khoá theo dòng, index thật |
| Không có test tự động | 1 file test chạy trên sheet giả bằng `vm` | Vitest + Supertest + Playwright chạy trong CI |
| Quota Google | 6 phút/lần chạy, giới hạn lượt đọc/ghi mỗi ngày | Không giới hạn |
| Nhiệm vụ lưu dạng chuỗi JSON trong ô | Một ô JSON hỏng từng làm mất sạch nhiệm vụ của **mọi** công việc | Bảng thật, khoá ngoại, ràng buộc `CHECK` |
| Mật khẩu | Lưu **văn bản thuần** trong cột `Mật khẩu` của sheet `Người dùng` | bcrypt cost 12, bắt đổi mật khẩu lần đăng nhập đầu |
| Không tách môi trường | Sửa là chạy trực tiếp trên dữ liệu thật | dev / staging / production riêng |

## 2. Kiểm kê tính năng phải giữ — danh sách chống mất tính năng

Đây là **hợp đồng nghiệm thu**. Bản VPS chưa tích đủ 13 nhóm dưới đây thì chưa được cắt
chuyển. Cột "Nguồn" là hàm/vùng code hiện tại để đối chiếu khi port.

Đếm chính xác: **88 mã** (7+6+15+10+11+9+6+4+3+3+8+2+4). Bản tích tay ở `docs/UAT.md`.

### 2.1 Xác thực & phiên (A)

| Mã | Tính năng | Nguồn hiện tại |
|---|---|---|
| A1 | Đăng nhập bằng email + mật khẩu | `authenticateUser` |
| A2 | Lưu phiên, tự hết hạn | `storeUserSession`, `getCurrentUser` |
| A3 | Đăng xuất | `logout` |
| A4 | Đổi mật khẩu | `changePassword`, `showChangePasswordModal` |
| A5 | 6 vai trò: `admin`, `Phó Giám đốc`, `Trưởng phòng`, `Phó phòng`, `Quản lý công việc`, `Nhân viên` | `isAdmin`, `isManager`, `isDeputyDirector`, `isDepartmentHead` |
| A6 | Kiểm quyền theo hành động × loại thực thể × dòng dữ liệu | `checkUserPermission(action, entityType, row)` |
| A7 | Ẩn/hiện nút theo quyền ở giao diện | `updateUIForUser`, `showAdminButtons`, `canUserEditResource`, `canUserDeleteResource`, `canUserCopyResource`, `canUserCreateTask` |

### 2.2 Công việc — cấp 1 (B)

| Mã | Tính năng | Nguồn hiện tại |
|---|---|---|
| B1 | Thêm / sửa / xoá công việc | `addProject`, `updateProject`, `deleteProject` (+ `*WithAuth`) |
| B2 | Nhân bản công việc kèm toàn bộ nhiệm vụ | `copyProject` |
| B3 | 9 trường: mã, tên, mô tả, quản lý, ngày bắt đầu, ngày kết thúc, trạng thái, phòng, email quản lý | hằng `PROJECT_*_COLUMN_NAME` |
| B4 | Thẻ công việc + xem chi tiết dạng modal | `createProjectCard`, `showProjectDetailsModal` |
| B5 | Tìm kiếm và lọc công việc | `filterProjects`, `getFilteredProjects`, `filterCards` |
| B6 | Nhật ký thay đổi riêng của từng công việc | cột `Nhật ký JSON`, `logActivity` |
| B7 | **Mới** — hiện ai lập công việc và lập theo cách nào: lãnh đạo phòng **tự đăng ký**, hay admin / Phó Giám đốc **giao**. Người giao là **người giao ĐẦU TIÊN**, giao lại về sau không ghi đè | *chưa có* |
| B8 | **Mới** — `GET /works/:id/history`: nhật ký **từ đầu** của công việc, gồm dòng lập và mọi lần chỉnh sửa dạng `cột: từ → thành` | *chưa có* (bản cũ chỉ có nhật ký chung) |

### 2.3 Công việc con (cấp 2) & Nhiệm vụ (cấp 3) (C)

| Mã | Tính năng | Nguồn hiện tại |
|---|---|---|
| C1 | Thêm / sửa / xoá, phân biệt bằng `Cấp` 2 hoặc 3 | `addTask`, `updateTask`, `deleteTask` |
| C2 | Cây 3 tầng lồng sẵn; nhiệm vụ mồ côi gom vào nhóm `(chưa gán công việc con)` | `getWorkTree` |
| C3 | Chặn sai cấu trúc: đổi cấp, tự trỏ vào mình, trỏ vào con cháu, cha không tồn tại, lấy cấp 3 làm cha | `validateTaskParent`, `collectTaskDescendantIds` |
| C4 | Xoá cấp 2 xoá kèm con cháu, trả về danh sách mã đã xoá để hỏi lại người dùng | `deleteTask` → `deletedChildren` |
| C5 | Chuyển nhiệm vụ sang công việc khác; chặn chuyển cấp 2 đang có con | `updateTask` nhánh move |
| C6 | Nhân bản cấp 2 phải nhân bản cả con, `Mã cha` trỏ đúng bản sao | `copyTask` (**còn nợ**) |
| C7 | Kéo–thả đổi thứ tự nhiệm vụ | `reorderTasks`, `handleReorderTasks`, `getDragAfterElement` |
| C8 | 13 trường sửa được: tên, mô tả, người thực hiện, trạng thái, ưu tiên, ngày bắt đầu, hạn chót, tiến độ %, ngày hoàn thành, mục tiêu, link kết quả, kết quả đầu ra, ghi chú | `applyTaskFieldsFromInput` |
| C9 | Nhắc việc: thêm / sửa / xoá, mỗi nhắc việc gồm ngày + nội dung | `addTaskReminder`, `updateTaskReminder`, `deleteTaskReminder` |
| C10 | Nhắc việc chỉ cho cấp 3; gọi trên cấp 2 phải báo lỗi rõ | **còn nợ** |
| C11 | Link kết quả: nhiều link, hiện dạng popup | `parseLinks`, `renderLinksButton`, `showLinksPopup` |
| C12 | Hoàn thành nhanh một nhiệm vụ (1 cú bấm) | `handleQuickCompleteTask` |
| C13 | Cảnh báo quá hạn | `isTaskOverdue` |
| C14 | Giới hạn ngày nhiệm vụ trong khoảng ngày của công việc cha | `updateTaskDateLimits` |
| C15 | Chỉ **cấp 3** được tính là "nhiệm vụ" trong mọi con số thống kê | `filterLevel3Tasks` |
| C16 | **Mới** — công việc con và nhiệm vụ cũng hiện ai lập và lập theo cách nào: nhân viên / lãnh đạo phòng **tự đăng ký**, hay admin / Phó Giám đốc / lãnh đạo phòng **giao**. Người giao là **người giao ĐẦU TIÊN** | *chưa có* |
| C17 | **Mới** — `GET /work-items/:id/history`: nhật ký **từ đầu** của từng công việc con / nhiệm vụ, gồm cả lần chuyển sang công việc khác | *chưa có* |
| C18 | **Mới** — công việc con và nhiệm vụ đều gắn phòng, luôn bằng phòng của công việc cha (§0.1, §4.1) | *chưa có* |

**Nguồn gốc suy từ HÀNH VI, không từ vai trò** (C16, B7). Người nhận việc là chính người bấm Tạo — hoặc chưa gán ai — thì ghi `Tự đăng ký`; gán cho người khác thì ghi `Được giao` kèm người giao và thời điểm. Lấy vai trò làm căn cứ thì admin tự lập việc cho mình cũng bị ghi là "được giao", trong khi cùng một Trưởng phòng lại có cả hai kiểu lập việc. Người nhận việc là `manager_id` với cấp 1 và `assignee_id` với cấp 2/3.

**Người giao đầu tiên là bất biến ở CSDL** (trigger `keep_first_origin`, 003), không phải ở tầng JS: mỗi lần sửa việc frontend gửi cả object lên, nên "ai giao việc này" là thứ dễ bị ghi đè nhất. Những lần giao lại về sau nằm trong nhật ký (B8, C17), không sửa lại quá khứ.

### 2.4 Người dùng & Phòng (D)

| Mã | Tính năng | Nguồn hiện tại |
|---|---|---|
| D1 | Thêm / sửa / xoá người dùng | `addStaff`, `updateStaff`, `deleteStaff` |
| D2 | 10 trường: mã NV, họ tên, email, mật khẩu, chức vụ, phân quyền, đối tượng, ghi chú, phòng, vai trò phòng | `STAFF_HEADERS` |
| D3 | Bảng + thẻ người dùng, badge vai trò | `createStaffTableRow`, `createStaffCard` |
| D4 | Kiểm tra dữ liệu trước khi lưu | `validateStaffData`, `showStaffValidationError` |
| D5 | Thêm / sửa / xoá phòng (chỉ admin) | `addDepartment`, `updateDepartment`, `deleteDepartment` |
| D6 | Gán Phó GĐ phụ trách, Trưởng phòng, Phó phòng cho từng phòng | tab **Cấu hình phòng** |
| D7 | Đổi tên phòng cập nhật cả người dùng thuộc phòng | `renameDepartmentEverywhere` |
| D8 | Chặn xoá phòng còn người | `deleteDepartment`, `countStaffInDepartment` |
| D9 | Thứ tự phòng quyết định thứ tự trên Gantt | cột `Thứ tự` |
| D10 | Hiện **họ tên** thay email trong bảng phòng; email lạ tô cam | `describeEmailList` |

### 2.5 Tổng quan & thống kê (E)

| Mã | Tính năng | Nguồn hiện tại |
|---|---|---|
| E1 | 4 thẻ số: tổng công việc, tổng nhiệm vụ, đang làm, quá hạn — kèm tỷ lệ hoàn thành | `renderStats`, `getSummaryStats` |
| E2 | Biểu đồ trạng thái nhiệm vụ | `renderChart`, `getTaskStatusChartData` |
| E3 | Biểu đồ so sánh công việc | `renderProjectComparisonChart` |
| E4 | Biểu đồ tiến độ công việc | `renderProjectProgressChart` |
| E5 | Biểu đồ hiệu suất nhân sự | `renderStaffPerformanceChart` |
| E6 | Biểu đồ mức ưu tiên nhiệm vụ | `renderTaskPriorityChart` |
| E7 | Biểu đồ tiến độ theo thời gian | `renderTimelineProgressChart` |
| E8 | Danh sách nhiệm vụ ưu tiên (mini) | `renderPriorityTasksMini`, `createPriorityTaskCard` |
| E9 | Hoạt động gần đây | `getRecentActivities`, `renderActivity` |
| E10 | Bấm vào con số → mở danh sách chi tiết | `openStatListModal`, `renderStatListItems` |
| E11 | Lọc tổng quan theo một công việc | `setupOverviewProjectFilter`, `applyOverviewFilter` |

### 2.6 Sơ đồ Gantt (F)

| Mã | Tính năng | Nguồn hiện tại |
|---|---|---|
| F1 | Vẽ thanh theo chế độ tháng | `calculateGanttBarStyle` |
| F2 | Vẽ thanh theo khoảng ngày bất kỳ | `calculateGanttBarStyleRange` |
| F3 | Lùi / tiến tháng | `navigateGanttMonth`, `handleGanttDateChange` |
| F4 | Lọc theo người thực hiện | `filterGanttByStaff`, `populateGanttStaffFilter` |
| F5 | Tìm kiếm trong Gantt | `searchGantt`, `handleGanttSearch` |
| F6 | Thu gọn / mở từng công việc | `toggleGanttProject` |
| F7 | **Mới**: chọn khoảng 1 / 2 / 3 tháng | chưa có |
| F8 | **Mới**: nhóm theo Phòng / Phó Giám đốc / Người thực hiện | chưa có |
| F9 | **Mới**: cây 4 mức thu gọn được, nhớ trạng thái trong `localStorage` | chưa có |

### 2.7 Đề nghị (G)

| Mã | Tính năng | Nguồn hiện tại |
|---|---|---|
| G1 | Thêm / sửa / xoá đề nghị | `addProposal`, `updateProposal`, `deleteProposal` |
| G2 | 11 trường: mã, loại, mã công việc, mã nhiệm vụ, nội dung, URL, nhà cung cấp, người đề nghị, ngày, trạng thái, ghi chú duyệt | `PROPOSAL_*_COLUMN` |
| G3 | 4 thẻ trạng thái kèm số đếm: Đề xuất mới / Chờ duyệt / Đã duyệt / Từ chối | `updateProposalCounts`, `setupProposalTabEvents` |
| G4 | 2 loại: Trong kế hoạch / Ngoài kế hoạch, form đổi theo loại | `toggleProposalType` |
| G5 | Chọn nhiệm vụ theo công việc đã chọn | `updateProposalTasks` |
| G6 | Tìm kiếm đề nghị | `renderProposals` |

### 2.8 Chat nội bộ (H)

| Mã | Tính năng | Nguồn hiện tại |
|---|---|---|
| H1 | Gửi tin nhắn chung cho cả đơn vị | `sendChatMessage` |
| H2 | Đọc tin nhắn 3 ngày gần nhất, tối đa 50 tin | `getChatMessages` |
| H3 | Badge số tin mới | `updateChatBadge` |
| H4 | Tự nhận link trong tin nhắn | `linkifyText`, `formatChatMessage` |

### 2.9 Quản lý App (I)

| Mã | Tính năng | Nguồn hiện tại |
|---|---|---|
| I1 | Thêm / sửa / xoá app (chỉ admin) | `addApp`, `updateApp`, `deleteApp` |
| I2 | 8 trường: mã, tên, URL, icon, mô tả, người tạo, danh mục, phân quyền | `APP_*_COLUMN` |
| I3 | Lưới app + mở app trong tab mới | `renderApps`, `handleAppRedirect` |

### 2.10 Thông báo & nhật ký (J)

| Mã | Tính năng | Nguồn hiện tại |
|---|---|---|
| J1 | Tạo thông báo cho người dùng | `addNotification` (+ `WithAuth`) |
| J2 | Tự thông báo nhiệm vụ quá hạn, chạy hằng ngày | `checkAndNotifyOverdueTasks`, `setupDailyTrigger` |
| J3 | Nhật ký hoạt động toàn hệ thống | `logActivity`, `getRecentActivities` |

### 2.11 Luồng duyệt (K) — **hoàn toàn mới, chưa có ở bản hiện tại**

| Mã | Tính năng |
|---|---|
| K1 | Trưởng phòng / Phó phòng tạo Công việc hoặc Công việc con ⇒ trạng thái `Chờ duyệt` |
| K2 | admin và Phó GĐ tạo ⇒ `Đã duyệt` ngay |
| K3 | Nhiệm vụ (cấp 3) **không cần duyệt**, dùng ngay |
| K4 | Duyệt / Từ chối kèm lý do; chỉ admin và Phó GĐ phụ trách phòng đó thấy nút |
| K5 | Cả phòng thấy mục `Chờ duyệt` kèm nhãn vàng |
| K6 | Mục `Chờ duyệt` **không tính vào bất kỳ con số thống kê hay biểu đồ nào** |
| K7 | Badge đếm số mục chờ duyệt trên menu |
| K8 | Thông báo: cho Phó GĐ khi có mục mới chờ; cho người tạo khi được duyệt / bị từ chối |

### 2.12 Lọc (L) — **mới**

| Mã | Tính năng |
|---|---|
| L1 | Lọc theo tháng, tính theo **giao nhau** với khoảng ngày bắt đầu–kết thúc (việc kéo 3 tháng hiện ở cả 3 tháng) |
| L2 | Lọc theo phòng; người không phải admin / Phó GĐ chỉ thấy phòng mình |

### 2.13 Tiện ích mới trên VPS (M)

| Mã | Tính năng |
|---|---|
| M1 | Xuất Excel: danh sách công việc 3 tầng, nhiệm vụ theo người, thống kê theo phòng |
| M2 | Nạp dữ liệu mẫu cho dev/staging bằng một lệnh, chạy lại nhiều lần không nhân đôi; bản chính thức **từ chối** chạy (đổi hướng 2026-08-24, xem §7 Phase 2) |
| M3 | Sao lưu cơ sở dữ liệu tự động hằng ngày + kịch bản phục hồi đã thử |
| M4 | Trang `/healthz` cho Nginx và giám sát |

## 3. Kiến trúc đích

### 3.1 Thành phần

```
Người dùng ──HTTPS──> Nginx (443) ──> app:3000 (Node 24 + Express)
                        │                  │
                        │                  ├──> postgres:5432  (không mở ra Internet)
                        └── phục vụ web/ tĩnh (gzip, cache)
                                           └──> cron trong app (node-cron): nhắc quá hạn 07:00
```

4 container: `app`, `db`, `nginx`, `certbot`. Postgres **không** publish port ra ngoài, chỉ
nói chuyện trong mạng nội bộ của Docker.

### 3.2 Cây thư mục

Đánh dấu **[đã có]** là phần Phase 0 đã dựng thật (2026-08-24); phần còn lại là dự kiến.

```
quanlycongviec/
├─ server/
│  ├─ src/
│  │  ├─ server.js                # [đã có] điểm vào: thử SELECT 1 rồi mới mở cổng, tắt êm
│  │  ├─ app.js                   # [đã có] dựng Express, helmet, /healthz, /readyz, 404, lỗi
│  │  ├─ config/env.js            # [đã có] 14 biến bắt buộc (zod), thiếu là chết ngay
│  │  ├─ db/
│  │  │  ├─ pool.js               # [đã có] pg.Pool, DATE giữ dạng chuỗi, withTransaction()
│  │  │  ├─ migrations/           # [đã có] 001_init.sql — chạy bằng node-pg-migrate
│  │  │  └─ seeds/                # dev.sql: 4 phòng, 8 người dùng đủ vai
│  │  ├─ middleware/
│  │  │  ├─ session.js            # đọc cookie → user, gia hạn phiên
│  │  │  ├─ rbac.js               # cổng quyền, port từ checkUserPermission
│  │  │  ├─ csrf.js  rateLimit.js  validate.js (zod)  errorHandler.js  audit.js
│  │  ├─ modules/                 # mỗi module: routes.js + service.js + repo.js + schema.js
│  │  │  ├─ auth/  users/  departments/
│  │  │  ├─ works/                # cấp 1
│  │  │  ├─ workItems/            # cấp 2 + cấp 3 (một bảng, phân biệt bằng level)
│  │  │  ├─ reminders/  approvals/  proposals/  apps/  chat/
│  │  │  ├─ notifications/  stats/  gantt/  activity/  export/
│  │  ├─ rpc/index.js             # cầu tương thích: 37 tên hàm cũ → service
│  │  ├─ services/ cron.js  excel.js       # KHÔNG có mailer.js — §13.4 mục 4
│  │  ├─ utils/
│  │  │  ├─ logger.js             # [đã có] pino, che cookie/authorization/mật khẩu
│  │  │  └─ dates.js  ids.js  tree.js  strings.js
│  ├─ tests/
│  │  ├─ global-setup.js          # [đã có] dựng lại CSDL test từ migration, 1 lần/bộ test
│  │  ├─ helpers/db.js            # [đã có] resetTables() + make* dựng dữ liệu tối thiểu
│  │  ├─ unit/  integration/  fixtures/
│  ├─ package.json                # [đã có] ESM, engines node>=24, script migrate/test/lint
│  ├─ vitest.config.js            # [đã có] chặn test chạy vào CSDL dev
│  ├─ eslint.config.js  .prettierrc.json   # [đã có]
├─ web/                           # frontend tĩnh
│  ├─ index.html                  # từ index.html hiện tại, bỏ <?!= include(...) ?>
│  ├─ assets/css/app.css          # từ CSS.html
│  ├─ assets/js/app.js            # từ js.clean.html (bỏ 2 thẻ <script>)
│  ├─ assets/js/api-bridge.js     # MỚI — giả lập google.script.run bằng fetch
│  └─ assets/vendor/              # tailwind, chart.js, fontawesome, Inter — tự chứa
├─ data/                          # [đã có] rỗng — snapshot đã bỏ (§13.4 mục 11)
│  └─ .gitkeep                    #          (.gitignore: data/* trừ .gitkeep)
├─ tools/                         # giữ nguyên bộ tool cũ
│                                 # (dump-sheets.js và import-from-sheets.js đều đã BỎ —
│                                 #  xem §7 Phase 2 và §13.4 mục 11)
├─ deploy/
│  ├─ docker-compose.yml  Dockerfile
│  ├─ docker-compose.dev.yml      # [đã có] db + db-test (tmpfs) + adminer
│  ├─ .env.example                # [đã có] · deploy/.env là bản thật, KHÔNG commit
│  ├─ nginx/app.conf  backup.sh  restore.sh  runbook.md
└─ docs/ API.md  SCHEMA.md  UAT.md    # [đã có] UAT.md — 88 mã tính năng theo §2
```

### 3.3 Thư viện chốt trước, không đổi giữa đường

| Việc | Chọn | Lý do |
|---|---|---|
| HTTP | `express@5` | Nhóm đã quen, tài liệu nhiều nhất |
| Truy cập CSDL | `pg` (driver thuần) + SQL viết tay | Logic cây 3 tầng và thống kê là SQL đệ quy — ORM chỉ làm khó. Không dùng Prisma |
| Migration | `node-pg-migrate` | File SQL đánh số, chạy lên/xuống được |
| Kiểm dữ liệu vào | `zod` | Một chỗ khai báo, dùng cho cả kiểm tra và sinh tài liệu |
| Mật khẩu | `@node-rs/bcrypt` cost 12 | **Đổi từ `bcrypt` ngày 2026-08-24**: npm ở máy này chặn install script nên `bcrypt` cài xong vẫn thiếu file `.node`, chỉ vỡ lúc chạy. `@node-rs/bcrypt` có sẵn bản biên dịch theo nền tảng, không cần install script, vẫn sinh băm `$2y$` tương thích |
| Phiên | Cookie httpOnly + bảng `sessions` | Thu hồi được ngay, không như JWT |
| Ghi log | `pino` + `pino-http` | JSON, nhanh, ghép được với `docker logs` |
| Lịch chạy | `node-cron` | Thay `setupDailyTrigger` của Apps Script |
| Excel | `exceljs@4.4.0` (ghim chính xác) | Ghi `.xlsx` thật, có định dạng, không phải CSV đổi tên. Cài `--save-exact` ngày 2026-08-27 (việc 7.5): bản `.xlsx` viết ra là **hợp đồng với Excel**, nâng phiên bản giữa đường mà đổi cách ghi ngày/định dạng thì lỗi chỉ hiện khi người dùng mở file |
| Email | ~~`nodemailer`~~ **không dùng** | Chốt 2026-08-24 (§13.4 mục 4): không gửi email. Thông báo chỉ nằm trong bảng `notifications` + badge trên giao diện. `MAIL_ENABLED=false`, không cài gói, không viết `services/mailer.js` |
| Test | `vitest` + `supertest` + `@playwright/test` | Nhanh, cùng cú pháp cho unit và integration |

Frontend **không thêm** thư viện nào. Tailwind / Chart.js / Font Awesome / font Inter đang nạp
từ CDN sẽ được **tải về `web/assets/vendor/`** — VPS nội bộ có thể không ra được Internet, và
CDN chết là cả giao diện trắng.

## 4. Lược đồ cơ sở dữ liệu

Nguyên tắc: **bỏ hẳn cách lưu chuỗi JSON trong ô**. Chỉ giữ `jsonb` ở đúng 2 chỗ mà dữ liệu
thật sự tự do (`result_links`, `activity_logs.details`).

### 4.1 Bảng

```sql
-- Phòng
departments(
  id            bigserial PK,
  code          text UNIQUE NOT NULL,          -- PH01
  name          text UNIQUE NOT NULL,
  sort_order    int NOT NULL DEFAULT 99,
  notes         text DEFAULT '',
  created_at, updated_at timestamptz)

-- Ai phụ trách phòng nào (thay 3 cột email cách nhau dấu ; của sheet Phòng)
department_managers(
  department_id bigint FK departments ON DELETE CASCADE,
  user_id       bigint FK users ON DELETE CASCADE,
  role          text CHECK (role IN ('deputy_director','head','vice')),
  PRIMARY KEY (department_id, user_id, role))

-- Người dùng
users(
  id            bigserial PK,
  code          text UNIQUE NOT NULL,          -- NV001
  full_name     text NOT NULL,
  email         citext UNIQUE NOT NULL,        -- citext: hết hẳn bệnh email chữ hoa §4.1
  password_hash text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT false,
  position      text DEFAULT '',               -- Chức vụ, chữ tự do
  role          text NOT NULL DEFAULT 'Nhân viên',   -- Phân quyền
                -- Đã thêm ở 001_init.sql: CONSTRAINT users_role_valid CHECK (role IN
                -- ('admin','Phó Giám đốc','Trưởng phòng','Phó phòng','Quản lý công việc','Nhân viên'))
                -- Chặn thẳng ở CSDL, vì bẫy "Trợ lý admin" của bản cũ (§13.5) sinh ra từ chỗ
                -- chấp nhận chữ tự do. Phase 2 nhập dữ liệu phải chuẩn hoá giá trị "Phân quyền"
                -- lạ và **báo cáo từng dòng**, không âm thầm gán 'Nhân viên'.
  object_type   text DEFAULT '',               -- Đối tượng
  department_id bigint NULL FK departments ON DELETE SET NULL,
                -- CHỐT 2026-08-24 (§13.4 mục 1): một người thuộc ĐÚNG MỘT phòng. Không làm bảng
                -- nhiều-nhiều. Việc phụ trách nhiều phòng đi qua bảng department_managers.
                -- Xoá phòng thì người dùng ở lại, department_id về NULL (TC-DB-17).
  dept_role     text CHECK (dept_role IN ('Trưởng phòng','Phó phòng','Nhân viên') OR dept_role IS NULL),
  notes         text DEFAULT '',
  is_active     boolean NOT NULL DEFAULT true,
  failed_logins int NOT NULL DEFAULT 0,
  locked_until  timestamptz NULL,
  created_at, updated_at timestamptz)
```

```sql
-- Công việc (cấp 1) — sheet "Dự án/Nhiệm vụ"
works(
  id            bigserial PK,
  code          text UNIQUE NOT NULL,          -- CV001 (mã cũ 'DA001' nhập tay thì giữ nguyên)
  name          text NOT NULL,
  description   text DEFAULT '',
  manager_id    bigint NULL FK users,
  manager_name  text DEFAULT '',               -- giữ tên tự do cho dữ liệu cũ không dò ra người
  department_id bigint NULL FK departments,
  start_date    date, end_date date,
  status        text NOT NULL DEFAULT 'Chưa bắt đầu',
  approval_status text NOT NULL DEFAULT 'Đã duyệt'
                CHECK (approval_status IN ('Chờ duyệt','Đã duyệt','Từ chối')),
  approver_id   bigint NULL FK users,
  approved_at   timestamptz NULL,
  reject_reason text DEFAULT '',
  sort_order    int NOT NULL DEFAULT 0,
  created_by    bigint NULL FK users,
  created_by_name  text NOT NULL DEFAULT '',    -- ↓ 5 cột nguồn gốc, thêm ở 003 (mục B7)
  origin        text NOT NULL DEFAULT 'Tự đăng ký'
                CHECK (origin IN ('Tự đăng ký','Được giao')),
  assigned_by_id   bigint NULL,                 -- CỐ Ý không FK users: xoá người thì vẫn còn
  assigned_by_name text NOT NULL DEFAULT '',    -- biết ai đã giao, hệt cách làm của activity_logs
  assigned_at   timestamptz NULL,
  supervisor_id bigint NULL FK users,           -- ↓ 2 cột phân công, thêm ở 005_phan_cong.sql:
  leader_ids    bigint[] NOT NULL DEFAULT '{}', --   Ban lãnh đạo kiểm soát (admin hoặc Phó GĐ phụ
                                                --   trách phòng) và Lãnh đạo phòng phụ trách
                                                --   (mảng Trưởng/Phó phòng của phòng đã chọn).
                                                --   Nguồn hợp lệ kiểm ở modules/assignments —
                                                --   KHÔNG tin danh sách client. Backfill: Phó GĐ
                                                --   phụ trách phòng (việc chung ⇒ admin); leaders =
                                                --   mọi head/vice của phòng; việc chung ⇒ rỗng.
  created_at, updated_at timestamptz)

-- Công việc con (cấp 2) + Nhiệm vụ (cấp 3) — thay cột "Nhiệm vụ JSON"
work_items(
  id            bigserial PK,
  code          text UNIQUE NOT NULL,          -- bản cũ có 2 dạng lẫn nhau: 'DA001-01' và
                -- 'ID<yymmddhhmmssSSS>' (dạng sau chính là bẫy trùng mã ở §13.5). Mã tạo mới
                -- dùng '<mã công việc>-NNN' lấy số từ seq_work_item_code — chốt ở §13.4 mục 6.
  work_id       bigint NOT NULL FK works ON DELETE CASCADE,
  parent_id     bigint NULL FK work_items ON DELETE CASCADE,
  level         smallint NOT NULL CHECK (level IN (2,3)),
  department_id bigint NULL FK departments ON DELETE SET NULL,
                -- Thêm ở 002_work_items_department.sql: CẢ BA CẤP đều gắn phòng. Cột này LUÔN
                -- bằng works.department_id của công việc cha — để trống thì trigger tự điền, đặt
                -- phòng khác thì nổ (DEPT_MISMATCH_WORK). Nhờ vậy §6 lọc "việc của phòng tôi"
                -- đọc thẳng một cột, không JOIN works, và cấp 2/cấp 3 hiện ra trong đúng phòng.
  supervisor_id bigint NULL FK users,           -- ↓ phân công, thêm ở 005_phan_cong.sql: Ban lãnh
  leader_ids    bigint[] NOT NULL DEFAULT '{}', --   đạo kiểm soát chỉ dùng ở cấp 2 (cấp 3 gửi
                 --   khác rỗng ⇒ service chặn); leader_ids cấp 2 là mảng nhiều người thừa hưởng
                 --   cha, cấp 3 tối đa MỘT người — CHECK task_leader_single chặn; nguồn hợp lệ
                 --   kiểm ở modules/assignments (trong CV con ⇒ thuộc leader_ids của CV con
                 --   đó; dưới cha trực tiếp ⇒ thuộc Phó GĐ phụ trách phòng của công việc).
  name          text NOT NULL,
  description   text DEFAULT '',
  assignee_id   bigint NULL FK users,
  assignee_name text DEFAULT '',
  status        text NOT NULL DEFAULT 'Chưa bắt đầu',
  priority      text NOT NULL DEFAULT 'Trung bình',
  start_date    date, due_date date, report_date date NULL,
  completion    smallint NOT NULL DEFAULT 0 CHECK (completion BETWEEN 0 AND 100),
  target        text DEFAULT '', output text DEFAULT '', notes text DEFAULT '',
  result_links  jsonb NOT NULL DEFAULT '[]',
  approval_status text NOT NULL DEFAULT 'Đã duyệt'
                CHECK (approval_status IN ('Chờ duyệt','Đã duyệt','Từ chối')),
  approver_id   bigint NULL, approved_at timestamptz NULL, reject_reason text DEFAULT '',
  sort_order    int NOT NULL DEFAULT 0,
  created_by    bigint NULL,
  created_by_name  text NOT NULL DEFAULT '',    -- ↓ 5 cột nguồn gốc, thêm ở 003 (mục C16). Y
  origin        text NOT NULL DEFAULT 'Tự đăng ký'   -- hệt works: cấp 2 và cấp 3 cũng phải nói
                CHECK (origin IN ('Tự đăng ký','Được giao')),  -- được ai đăng ký / ai giao đầu tiên
  assigned_by_id   bigint NULL,
  assigned_by_name text NOT NULL DEFAULT '',
  assigned_at   timestamptz NULL,
  created_at, updated_at timestamptz,
  -- Ràng buộc thay cho 6 nhánh kiểm tay của updateTask:
  CONSTRAINT lvl2_no_parent CHECK (level <> 2 OR parent_id IS NULL),
  CONSTRAINT no_self_parent CHECK (parent_id IS NULL OR parent_id <> id),
  -- Thêm ở 001_init.sql: giữ result_links luôn là MẢNG json. Bản cũ có ô lưu chuỗi lẫn mảng,
  -- parseLinks phải đoán. Sai kiểu thì chặn ngay khi ghi, không sửa lúc đọc.
  CONSTRAINT links_is_array CHECK (jsonb_typeof(result_links) = 'array'))
```

**Đã hiện thực trong `001_init.sql`** (2026-08-24) — 3 trigger là lưới an toàn cuối:

| Trigger | Chặn gì | Lời nhắn |
|---|---|---|
| `work_items_check_parent()` BEFORE INSERT/UPDATE OF `parent_id, work_id, level` | cha không tồn tại · cha không phải cấp 2 · cha khác `work_id` · cấp 2 **đang có con** đổi `work_id` hoặc đổi `level` | "Cha phải là công việc con (cấp 2)…" · "Cha và con phải thuộc cùng một công việc" · "…không thể chuyển hoặc đổi cấp" |
| `reminders_only_level3()` BEFORE INSERT/UPDATE trên `reminders` | đặt nhắc việc cho cấp 2 (mục C10, bản cũ còn nợ) | "Chỉ nhiệm vụ (cấp 3) mới đặt được nhắc việc" |
| `set_updated_at()` trên 6 bảng | `updated_at` không được cập nhật khi sửa | — |

**Đã hiện thực trong `002_work_items_department.sql`** (2026-08-25) — gắn phòng cho cả ba cấp.
Hai trigger dưới đây giữ đúng một bất biến: *phòng của cấp 2 và cấp 3 luôn bằng phòng của công
việc cấp 1 chứa nó*. Vì bất biến do CSDL giữ, không đường ghi nào (API, nhập dữ liệu Phase 9, sửa
tay lúc bảo trì) làm nó lệch được.

| Trigger | Làm gì | Lời nhắn |
|---|---|---|
| `work_items_sync_department()` BEFORE INSERT/UPDATE OF `department_id, work_id` | để trống ⇒ điền phòng của công việc cha · chuyển sang công việc khác ⇒ phòng đi theo công việc đích · đặt phòng khác công việc cha ⇒ **chặn** | "Công việc con/nhiệm vụ phải cùng phòng với công việc cha…" → `DEPT_MISMATCH_WORK` (400) |
| `works_cascade_department()` AFTER UPDATE OF `department_id` trên `works` | đổi phòng công việc cấp 1 ⇒ lan xuống **toàn bộ** cấp 2 + cấp 3 của nó | — |

**Đã hiện thực trong `003_work_origin_and_history.sql`** (2026-08-25) — nguồn gốc đầu việc (mục
B7/C16). Trigger dưới đây giữ bất biến: *người lập và người giao ĐẦU TIÊN không bao giờ bị ghi đè*.
Phải đặt ở CSDL vì giao diện lưu bằng cách gửi **cả đối tượng** (§5.1): một lần bấm Lưu của người
khác sẽ mang theo `created_by` của chính họ và xoá dấu vết người giao ban đầu.

| Trigger | Làm gì | Lời nhắn |
|---|---|---|
| `keep_first_origin()` BEFORE UPDATE trên `works` **và** `work_items` | mọi UPDATE: `created_by`/`created_by_name` đã có thì trả về giá trị cũ · đã có `assigned_by_id` thì 4 cột `assigned_by_id, assigned_by_name, assigned_at, origin` **đều** giữ nguyên | — (âm thầm hoàn nguyên, không nổ lỗi: đây là lưới an toàn cho đường ghi cả đối tượng, không phải lỗi người dùng) |

Giao lại việc cho người khác vẫn đổi được `manager_id` / `assignee_id` như thường — chỉ *lịch sử*
là bất biến. TC-ORIGIN-04 chứng minh cả câu `UPDATE` viết tay ở psql cũng không sửa được.

`origin` chỉ nhận đúng hai giá trị (`CHECK`), và **suy từ hành vi chứ không từ vai trò**: lúc tạo,
nếu người nhận (`manager_id` ở cấp 1, `assignee_id` ở cấp 2/3) chính là người bấm Tạo thì
"Tự đăng ký", khác người thì "Được giao". Nhờ vậy Trưởng phòng vừa tự đăng ký được, vừa giao được,
mà không cần bảng ánh xạ vai trò → nguồn gốc.

Sinh mã dùng 6 sequence + hàm `next_code(p_prefix text, p_seq regclass, p_width int DEFAULT 3)`:
`seq_department_code`, `seq_user_code`, `seq_work_code`, `seq_work_item_code`, `seq_proposal_code`,
`seq_app_code`. Đã kiểm 500 lần gọi liên tiếp không trùng (TC-DB-14).

**Mã đặt tay thì phải đẩy sequence.** Dữ liệu nào chèn bằng mã viết cứng — dữ liệu mẫu, và cả
28 dòng nhập tay lúc lên bản chính thức — đều **không** làm sequence nhích, nên `next_code()` vẫn
trả về `CV001` và việc tạo mới đầu tiên đổ vì trùng `UNIQUE`. Sau mọi lần chèn kiểu đó phải chạy
`setval(seq, GREATEST((SELECT last_value FROM seq), n))`. `GREATEST` là phần bắt buộc: `setval`
thẳng sẽ **kéo lùi** sequence đã đi xa hơn và làm trùng mã lần nữa (§8.3, TC-SEED-22/23).

Vòng lặp `parent → con → cha` **chưa** chặn bằng trigger: với đúng 2 cấp thì `lvl2_no_parent` +
"cha phải là cấp 2" đã khoá hết mọi đường tạo vòng. Nếu sau này có cấp 4 thì phải viết thêm.

Ba quy tắc còn lại **không** đặt được bằng `CHECK` nên làm bằng trigger + kiểm ở service:
cha phải là cấp 2; cha phải cùng `work_id`; không được tạo vòng. Trigger là lưới an toàn cuối,
service vẫn phải trả lỗi tiếng Việt rõ ràng cho người dùng.

```sql
reminders(id bigserial PK, work_item_id bigint FK work_items ON DELETE CASCADE,
          remind_date date NOT NULL, content text DEFAULT '',
          created_by bigint NULL, created_at timestamptz)

proposals(id bigserial PK, code text UNIQUE, type text, work_id bigint NULL,
          work_item_id bigint NULL, content text, url text, supplier text,
          creator_id bigint NULL, creator_name text, proposal_date date,
          status text NOT NULL DEFAULT 'Đề xuất mới', review_note text,
          created_at, updated_at)

apps(id bigserial PK, code text UNIQUE, name text, url text, icon_url text,
     description text, category text, allowed_roles text[] DEFAULT '{}',
     created_by bigint NULL, created_at, updated_at)

chat_messages(id bigserial PK, user_id bigint FK users, user_name text,
              message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())

notifications(id bigserial PK, user_id bigint FK users ON DELETE CASCADE,
              content text, type text, is_read boolean DEFAULT false,
              ref_type text, ref_id bigint, created_at timestamptz)

activity_logs(id bigserial PK, actor_id bigint NULL, actor_name text,
              action text NOT NULL, entity_type text, entity_id bigint,
              work_id bigint NULL, details jsonb DEFAULT '{}',
              ip inet NULL, created_at timestamptz NOT NULL DEFAULT now())

sessions(id uuid PK, user_id bigint FK users ON DELETE CASCADE,
         created_at timestamptz, last_seen_at timestamptz,
         expires_at timestamptz NOT NULL, ip inet, user_agent text)
```

### 4.2 Index bắt buộc

```sql
CREATE INDEX ON work_items (work_id, level);
CREATE INDEX ON work_items (parent_id);
CREATE INDEX ON work_items (department_id, level);      -- "việc của phòng tôi" (§6), cả 2 cấp
CREATE INDEX ON work_items (assignee_id) WHERE level = 3;
CREATE INDEX ON work_items (due_date) WHERE level = 3 AND status <> 'Hoàn thành';
CREATE INDEX ON works (department_id, approval_status);
CREATE INDEX ON works (start_date, end_date);          -- lọc theo tháng (L1)
CREATE INDEX ON activity_logs (created_at DESC);
CREATE INDEX ON activity_logs (entity_type, entity_id, id DESC);   -- nhật ký MỘT đầu việc (B8/C17)
CREATE INDEX ON notifications (user_id, is_read);
CREATE INDEX ON chat_messages (created_at DESC);
CREATE INDEX ON sessions (expires_at);
```

### 4.3 Bảng đối chiếu cột Sheets → CSDL

Bảng này viết cho công cụ nhập từ Sheets — công cụ **đã bỏ** (§7 Phase 2). Vẫn giữ lại vì nó là
nơi duy nhất ghi **ý nghĩa từng cột của hệ thống cũ**: lúc nhập tay 28 dòng dữ liệu thật qua giao
diện web khi lên bản chính thức (§13.4 mục 12), và lúc mở `file tai xuong tu google sheet.xlsx`
để tra cứu, phải theo đúng bảng này. Snapshot JSON đã bỏ; số liệu của nó còn ở §13.8.

| Sheet | Cột Sheets | Bảng.cột |
|---|---|---|
| `Người dùng` | Mã NV / Họ tên / Email / Mật khẩu / Chức vụ / Phân quyền / Đối tượng / Ghi chú / Phòng / Vai trò phòng | `users.code / full_name / email / password_hash (băm lại) / position / role / object_type / notes / department_id (dò theo tên) / dept_role` |
| `Phòng` | Mã phòng / Tên phòng / Thứ tự / Ghi chú | `departments.code / name / sort_order / notes` |
| `Phòng` | Email Phó GĐ / Trưởng phòng / Phó phòng | `department_managers` — tách theo `;` và `,`, mỗi email một dòng |
| `Dự án/Nhiệm vụ` | Mã dự án / Tên dự án / Mô tả dự án / Quản lý dự án / Ngày bắt đầu / Ngày kết thúc / Trạng thái dự án / Phòng / Trạng thái duyệt | `works.code / name / description / manager_name + manager_id / start_date / end_date / status / department_id / approval_status` |
| `Dự án/Nhiệm vụ` | `Nhiệm vụ JSON` → từng phần tử | `work_items` một dòng mỗi phần tử; `Cấp`→`level`, `Mã cha`→`parent_id` (dò 2 lượt: lượt 1 chèn, lượt 2 nối cha) |
| phần tử JSON | Nhắc việc (mảng) | `reminders` |
| phần tử JSON | Link kết quả (nhiều dòng) | `work_items.result_links` (mảng chuỗi) |
| `Dự án/Nhiệm vụ` | `Nhật ký JSON` | `activity_logs` kèm `work_id` |
| `Đề nghị` | 11 cột | `proposals` |
| `Quản lý App` | 8 cột | `apps`; cột `Phân quyền` tách thành `allowed_roles[]` |
| `Chat` | `Chat JSON` theo ngày | `chat_messages`, ghép `Ngày` + `timestamp` thành `created_at` |
| `Thông báo` | 5 cột | `notifications`, `Người nhận` dò ra `user_id` |

**Ba trường hợp phải in ra báo cáo, không được đoán** (đúng như `migrateV2` đã làm): tên người
**trùng nhau**, tên **không có** trong `Người dùng`, và `Mã cha` trỏ vào mã **không tồn tại**.
Nhiệm vụ mồ côi vẫn nhập nhưng `parent_id = NULL`, hiện ở nhóm `(chưa gán công việc con)`.

## 5. Hợp đồng API

### 5.1 Cầu tương thích — cách để không phải sửa 3653 dòng frontend

Frontend hiện gọi backend qua **28 chỗ** `google.script.run.withSuccessHandler(...).tênHàm(...)`,
tổng **37 tên hàm** (kế hoạch viết 36 là **đếm sai**: đếm lại từng dòng §5.2 và đối chiếu với
`web/assets/js/app.js` lúc làm việc 4.2 thì ra 37 — xem bẫy ở §13.5). Thay vì sửa từng chỗ, thêm một file duy nhất `web/assets/js/api-bridge.js`
định nghĩa lại `window.google.script.run` với đúng giao diện cũ:

```js
// api-bridge.js — nạp TRƯỚC app.js
const RPC = ['authenticateUser','logout','getDataForUser','getInitialDataWithAuth',
  'getProjects','getTasks','getStaffList','getProposals','getChatMessages',
  'getDepartmentContext','addProjectWithAuth','updateProjectWithAuth', /* … 37 tên … */];

function makeRunner(onOk, onErr) {
  const api = {
    withSuccessHandler: fn => makeRunner(fn, onErr),
    withFailureHandler: fn => makeRunner(onOk, fn),
  };
  for (const name of RPC) {
    api[name] = (...args) =>
      fetch('/api/rpc/' + name, {
        method: 'POST', credentials: 'same-origin',
        headers: {'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken()},
        body: JSON.stringify({args}),
      })
      .then(r => r.status === 401 ? (showLoginModal(), Promise.reject(new Error('Hết phiên'))) : r.json())
      .then(res => onOk && onOk(res.data))
      .catch(err => onErr ? onErr(err) : showToast(err.message, 'error'));
  }
  return api;
}
window.google = {script: {run: makeRunner()}};
```

Kết quả: `js.clean.html` **không đổi một dòng logic nào** ở Phase 4. Đây là lý do chọn phương
án "port nguyên trạng" — rủi ro dồn hết vào backend, nơi có test tự động.

Đánh đổi phải nói rõ: `/api/rpc/*` **không phải REST**. Nó là lớp tương thích có thời hạn.
Từ Phase 6 mọi tính năng **mới** dùng `/api/v1/*` chuẩn REST; `/api/rpc/*` giữ nguyên cho phần
cũ và chỉ dọn khi frontend được tách module (ngoài phạm vi kế hoạch này).

### 5.2 Bảng 37 hàm cũ → service mới

| Tên cũ (frontend gọi) | Service mới | REST tương đương (Phase 6+) |
|---|---|---|
| `authenticateUser` | `auth.login` | `POST /api/v1/auth/login` |
| `logout` | `auth.logout` | `POST /api/v1/auth/logout` |
| `changePassword` | `auth.changePassword` | `POST /api/v1/auth/password` |
| `getDataForUser`, `getInitialDataWithAuth` | `bootstrap.get` | `GET /api/v1/bootstrap` |
| `getDepartmentContext` | `departments.context` | `GET /api/v1/departments/context` |
| `getProjects` | `works.list` | `GET /api/v1/works` |
| `addProjectWithAuth` / `updateProjectWithAuth` / `deleteProjectWithAuth` / `copyProjectWithAuth` | `works.create/update/remove/copy` | `POST/PATCH/DELETE /api/v1/works/:id`, `POST …/:id/copy` |
| `getTasks` | `workItems.list` | `GET /api/v1/work-items?workId=` |
| `addTaskWithAuth` / `updateTaskWithAuth` / `deleteTaskWithAuth` / `copyTaskWithAuth` | `workItems.create/update/remove/copy` | `POST/PATCH/DELETE /api/v1/work-items/:id` |
| `reorderTasks` | `workItems.reorder` | `POST /api/v1/works/:id/reorder` |
| `addTaskReminder` / `updateTaskReminder` / `deleteTaskReminder` | `reminders.create/update/remove` | `POST/PATCH/DELETE /api/v1/work-items/:id/reminders` |
| `getStaffList`, `addStaffWithAuth`, `updateStaffWithAuth`, `deleteStaffWithAuth` | `users.*` | `GET/POST/PATCH/DELETE /api/v1/users` |
| `addDepartmentWithAuth`, `updateDepartmentWithAuth`, `deleteDepartmentWithAuth` | `departments.*` | `/api/v1/departments` |
| `getProposals`, `addProposalWithAuth`, `updateProposalWithAuth`, `deleteProposalWithAuth` | `proposals.*` | `/api/v1/proposals` |
| `addApp`, `updateApp`, `deleteApp` | `apps.*` | `/api/v1/apps` |
| `getChatMessages`, `sendChatMessage` | `chat.list/send` | `/api/v1/chat` |
| `addNotificationWithAuth` | `notifications.create` | `POST /api/v1/notifications` |

Viết đủ từng tên chứ không gộp `add/update/delete…` — chính cách viết gộp làm kế hoạch đếm thành
36. Đếm theo dòng bảng trên: **3** (ba dòng đăng nhập/phiên) + 2 + 1 + 1 + 4 + 1 + 4 + 1 + 3 + 4 +
3 + 4 + 3 + 2 + 1 = **37**.

**Tình trạng sau Phase 5** (`server/src/rpc/table.js` là nguồn sự thật, `api-bridge.test.js` chốt
cứng cả 37 tên): **27 tên đã chạy thật**, **10 tên trả `501 NOT_IMPLEMENTED`** kèm câu tiếng Việt
nói rõ chức năng nào chưa có — cố ý thất bại rõ ràng, vì tên thiếu hẳn khỏi bảng thì lời gọi im
lặng trả `undefined` và giao diện hỏng ở chỗ không ai đoán được.

| | Tên |
|---|---|
| Đã chạy (27) | `authenticateUser`, `logout`, `changePassword`, `getDataForUser`, `getInitialDataWithAuth`, `getDepartmentContext`, `getProjects`, `addProjectWithAuth`, `updateProjectWithAuth`, `deleteProjectWithAuth`, `copyProjectWithAuth`, `getTasks`, `addTaskWithAuth`, `updateTaskWithAuth`, `deleteTaskWithAuth`, `copyTaskWithAuth`, `reorderTasks`, `addTaskReminder`, `updateTaskReminder`, `deleteTaskReminder`, `getStaffList`, `addStaffWithAuth`, `updateStaffWithAuth`, `deleteStaffWithAuth`, `addDepartmentWithAuth`, `updateDepartmentWithAuth`, `deleteDepartmentWithAuth` |
| 501 (10) — Phase 7 | `getProposals`, `addProposalWithAuth`, `updateProposalWithAuth`, `deleteProposalWithAuth`, `addApp`, `updateApp`, `deleteApp`, `getChatMessages`, `sendChatMessage`, `addNotificationWithAuth` |

Ngoại lệ hẹp giữ nguyên: `getInitialDataWithAuth` khi **chưa** có phiên vẫn trả `{requireLogin:true}`
thay vì 401/501, nếu không thì khách vào trang chỉ thấy lỗi thay vì ô đăng nhập.

**`GET /api/v1/bootstrap` — chốt là CÓ, làm ở Phase 5** (việc **5.10**; §7 Phase 5 đã thêm hai
việc 5.10 và 5.11 sau lượt khói §8.5 của Phase 4). Một lời gọi trả về gói dữ liệu
đầu trang: người đăng nhập, danh sách phòng, danh sách người, số đếm chờ duyệt, thống kê tổng quan.
Lý do gộp thay vì để giao diện gọi 5 đường REST: bản cũ mở trang là một lần `getDataForUser`, và
`app.js` **không được sửa logic** ở Phase 4 — muốn giữ đúng một lần gọi thì máy chủ phải có đúng
một đường. `getDataForUser` và `getInitialDataWithAuth` cùng ánh xạ vào nó, khác nhau ở chỗ bản
"WithAuth" trả thêm phần phiên.

**Bổ sung mới, không có tên cũ:**

| Việc | REST |
|---|---|
| Cây 3 tầng | `GET /api/v1/works/tree?month=&departmentId=` |
| Nhật ký **từ đầu** của một công việc (B8) | `GET /api/v1/works/:id/history?limit=` |
| Nhật ký **từ đầu** của một công việc con / nhiệm vụ (C17) | `GET /api/v1/work-items/:id/history?limit=` |
| Gửi duyệt / Duyệt / Từ chối | `POST /api/v1/approvals/:entity/:id/{submit,approve,reject}` |
| Số đếm chờ duyệt cho badge | `GET /api/v1/approvals/pending-count` |
| Thống kê + dữ liệu 6 biểu đồ | `GET /api/v1/stats/summary`, `/stats/charts?type=` |
| Dữ liệu Gantt đã nhóm | `GET /api/v1/gantt?from=&to=&groupBy=department\|deputy\|assignee` |
| Ứng viên phân công (Ban kiểm soát / Lãnh đạo phòng) — thêm 2026-08-26 | `GET /api/v1/departments/assignment-options?departmentId=&parentRef=` |
| Hoạt động gần đây có phân trang | `GET /api/v1/stats/activities?page=` |
| Xuất Excel — 3 mẫu (việc 7.5) | `GET /api/v1/export/works.xlsx?month=`, `/export/tasks.xlsx?month=`, `/export/stats.xlsx?from=&to=` |
| Sức khoẻ hệ thống | `GET /healthz` |

**Hình dáng phần nguồn gốc và nhật ký** (B7/B8, C16/C17). Mọi phản hồi trả về *một* đầu việc —
`GET /works/:id`, `POST /works`, và cả hai `/history` — đều kèm khoá `originInfo`. Cố ý **không**
đặt tên là `origin`: dòng dữ liệu đã có sẵn cột chữ `origin` mang đúng hai giá trị, để cùng một tên
thì giao diện dễ lẫn chuỗi với đối tượng.

```json
{ "ok": true, "data": {
  "work": { "code": "CV003", "origin": "Được giao", "…": "…" },
  "originInfo": { "origin": "Được giao", "selfRegistered": false,
                  "createdById": 1, "createdByName": "Quản trị hệ thống",
                  "assignedById": 1, "assignedByName": "Quản trị hệ thống",
                  "assignedAt": "2026-08-25T01:00:00.000Z" },
  "entries": [
    { "action": "works.create", "actor_name": "Quản trị hệ thống",
      "details": { "code": "CV003", "name": "Việc A", "origin": "Được giao" } },
    { "action": "works.update", "actor_name": "Trần Thị Trưởng",
      "details": { "code": "CV003",
                   "changes": { "name": { "from": "Việc A", "to": "Việc A2" } } } }
  ] } }
```

Dòng nhật ký giữ nguyên tên cột CSDL (`actor_name`, `entity_type`, `created_at`) như mọi dòng dữ
liệu khác trong `data`; chỉ `originInfo` là bó camelCase vì nó là thứ tính ra, không phải một dòng.

`entries` xếp **cũ trước, mới sau** — đọc nhật ký là lần lại từ lúc lập, không phải xem tin mới
nhất. `details.changes` chỉ có những cột **thật sự đổi**, dạng `từ → thành`, và lần Lưu không đổi gì
thì **không** có khoá `changes` (§13.3). Bộ lọc luôn gồm `entity_type`, vì `works.id = 5` và
`work_items.id = 5` là hai dòng khác nhau (TC-ORIGIN-12).

### 5.3 Quy ước chung của mọi phản hồi

```json
{ "ok": true,  "data": … }
{ "ok": false, "error": { "code": "PARENT_NOT_FOUND", "message": "Không tìm thấy công việc con cha", "field": "parentId" } }
```

`code` để frontend xử lý, `message` **tiếng Việt** để hiện thẳng cho người dùng. Lỗi không lường
trước trả `code: "INTERNAL"` kèm `traceId` và ghi log đầy đủ phía server — **không** trả stack
trace ra trình duyệt.

Mã HTTP: `200` thành công · `400` dữ liệu sai · `401` chưa đăng nhập / hết phiên · `403` không
đủ quyền · `404` không tìm thấy · `409` xung đột (trùng mã, xoá phòng còn người) · `429` bị chặn
vì gọi quá nhiều · **`501` tên hàm cũ có thật nhưng nghiệp vụ chưa chuyển sang máy chủ mới** ·
`500` lỗi hệ thống.

`501 NOT_IMPLEMENTED` thêm vào từ Phase 4 và **chỉ dùng cho `/api/rpc/*`**: cầu tương thích phải
có đủ 37 tên ngay từ đầu (thiếu tên là lời gọi im lặng trả `undefined`), nên 18 tên chưa có nghiệp
vụ vẫn có dòng trong bảng và trả 501 kèm câu tiếng Việt chỉ đúng chức năng còn thiếu. Đường
`/api/v1/*` **không bao giờ** trả 501: đường nào chưa có thì chưa khai báo, và Express trả 404.

Cầu tương thích ở §5.1 trả `res.data` cho `withSuccessHandler`, nên các hàm cũ vẫn nhận đúng
hình dạng `{success: true, …}` mà chúng đang mong đợi — service mới giữ nguyên hình dạng đó
trong `data` cho **37** hàm cũ.

## 6. Ma trận phân quyền — port sang `middleware/rbac.js`

`Đọc` = thấy trên danh sách và Gantt · `Tạo/Sửa` = thao tác được · `Duyệt` = đổi trạng thái duyệt.

| Vai trò | Phạm vi thấy | Tạo Công việc / Công việc con | Tạo Nhiệm vụ | Duyệt |
|---|---|---|---|---|
| `admin` | Toàn đơn vị | Có, `Đã duyệt` ngay | Có | Có, mọi phòng |
| `Phó Giám đốc` | Các phòng mình phụ trách | Có, `Đã duyệt` ngay | Có | **Có, trong phòng phụ trách** |
| `Trưởng phòng` / `Phó phòng` | Cả phòng mình | Có → **`Chờ duyệt`** | Có | Không |
| `Quản lý công việc` | Công việc mình quản lý | Như hiện tại | Có | Không |
| `Nhân viên` | Cả phòng mình (chỉ đọc); nhiệm vụ của mình (sửa được) | Không | Chỉ trong công việc được giao | Không |

Cài đặt: **một hàm duy nhất** `can(user, action, entityType, row)` — cùng chữ ký với
`checkUserPermission` hiện tại để port thẳng, và **được gọi ở cả hai nơi**: middleware chặn
request, và service kiểm lại trước khi ghi. Frontend chỉ ẩn/hiện nút cho đẹp, **không** được
coi là lớp bảo vệ.

"Phạm vi thấy" theo phòng đọc **`department_id` của chính dòng đó**, ở cả ba cấp: `works` và
`work_items` đều có cột này và chúng luôn khớp nhau (§4.1). Vì vậy Trưởng phòng/Phó phòng/Nhân
viên thấy được công việc con và nhiệm vụ của phòng mình mà `can()` không phải JOIN sang `works`
— `normalizeRow` chỉ còn dùng `work_department_id` làm đường dự phòng cho các truy vấn chỉ lấy
phòng của công việc cha.

**Nhật ký đi cùng quyền đọc dữ liệu**, không có quyền riêng: `/history` gọi đúng `can(user,'read',…)`
trên chính đầu việc đó, nên ai không thấy được công việc thì cũng không đọc được nhật ký của nó
(TC-ORIGIN-14). Ngược lại, ai đã thấy được thì thấy **toàn bộ** nhật ký từ đầu — kể cả những lần
sửa của người khác — vì đó chính là điều mục B8/C17 yêu cầu.

**Một ngoại lệ HẸP HƠN bảng trên: nhắc việc** (§13.4 mục 13 + mục 15, người dùng chốt 2026-08-25).
Thêm / sửa / xoá nhắc việc chỉ dành cho **`admin` + `Phó Giám đốc` PHỤ TRÁCH phòng đó +
`Trưởng phòng` / `Phó phòng` của phòng chứa nhiệm vụ đó**; `Quản lý công việc` và `Nhân viên`
**không** đặt được nhắc việc dù bảng trên cho họ sửa nhiệm vụ. Đọc thì vẫn theo bảng (ai thấy nhiệm
vụ thì thấy lời nhắc của nó). Ma trận không có thực thể `reminder`: chỗ siết nằm ở `assertCanManage`
trong `modules/reminders/service.js`, gọi `can(...,'update',...)` trước để giữ nguyên mã lỗi chung
và phần "đúng phòng mình", rồi mới lọc theo vai. Chữ "phụ trách phòng đó" của `Phó Giám đốc` KHÔNG
cần dòng mã nào riêng: `inScope()` đã bó vai này theo `managedDepartmentIds`, tức chỉ những phòng có
dòng `department_managers.role = 'deputy_director'` (rbac.js:161) — Phó Giám đốc phụ trách phòng
khác nhận 403 "ngoài phạm vi", không phải 403 vì vai.

## 7. Kế hoạch từng Phase

10 phase, mỗi phase một nhánh git, kết thúc bằng một bản chạy được và test xanh. Thời lượng
tính cho **một người làm toàn thời gian**; con số trong ngoặc là ngày làm việc.

Tổng: **38–47 ngày làm việc ≈ 8–10 tuần**.

---

### Phase 0 — Chuẩn bị & chốt hợp đồng dữ liệu (3 ngày)

**Mục tiêu**: có bộ xương chạy được và một bản chụp dữ liệu bất biến để đối chiếu về sau.

| # | Việc | Đầu ra |
|---|---|---|
| 0.1 | Tạo nhánh `vps/phase-0-setup`, dựng cây thư mục §3.2 | thư mục `server/`, `web/`, `deploy/`, `data/`, `docs/` |
| 0.2 | `server/package.json`, ESLint + Prettier, `vitest.config.js` | `npm test` chạy được (0 test) |
| 0.3 | `docker-compose.dev.yml`: Postgres 16 + adminer, **thêm `db-test`** dùng tmpfs cho bộ test (§8.2 buộc CSDL test tách riêng, không dùng chung với dev) | `docker compose -f deploy/docker-compose.dev.yml up -d` |
| 0.4 | `config/env.js` — thiếu biến môi trường là **chết ngay khi khởi động**, không chạy tiếp | `.env.example` đủ 14 biến |
| 0.5 | Viết `001_init.sql` theo §4 | `npm run migrate:up` và `:down` đều sạch |
| 0.6 | ~~`tools/dump-sheets.js` — xuất 8 sheet ra `data/snapshot-YYYYMMDD.json`, **chỉ đọc**~~ | ~~1 file JSON, ghi lại số dòng từng sheet~~ · **đã chạy 2026-08-24 rồi BỎ cả công cụ lẫn snapshot** (§13.4 mục 11); số liệu còn ở §13.8 |
| 0.7 | Chốt §2 thành `docs/UAT.md` — 13 nhóm, mỗi mã một dòng có ô tích | checklist nghiệm thu |

**Xong khi**: `npm run migrate:up` tạo đủ **12 bảng nghiệp vụ + bảng `pgmigrations`** của
node-pg-migrate (13 bảng trong `information_schema`) · `npm test` xanh · ~~có file snapshot kèm
bảng đếm số dòng~~ (bảng đếm đã chuyển vào §13.8) · `docs/UAT.md` có đủ **88** mã tính năng (đếm lại từ §2: 7+6+15+10+11+9+6+4+3+3+8+2+4).

**Kết quả thật 2026-08-24**: xong, 28 test xanh (18 lược đồ + 6 env + 4 health). Việc 0.6 đã chạy
trên `.xlsx` thật ngày 2026-08-24 (số liệu §13.8), rồi **cả công cụ lẫn snapshot đều bị bỏ**
ngày 2026-08-25 theo §13.4 mục 11 — không còn việc nợ nào của Phase 0.

**Rủi ro** (đã hết hiệu lực cùng việc 0.6): Sheets có ô JSON hỏng (đã biết là **có**), nên
`dump-sheets.js` xuất **nguyên văn chuỗi**, không `JSON.parse`. Giữ lại dòng này vì Phase 9 nhập
tay cũng gặp đúng mấy ô đó — đọc bằng mắt thì cũng phải chép nguyên văn rồi tự sửa, không tin ô
JSON của bản cũ là hợp lệ.

---

### Phase 1 — Nền tảng: xác thực, phiên, phân quyền, nhật ký (5 ngày)

**Mục tiêu**: đăng nhập được, quyền đúng, mọi thao tác ghi đều để lại dấu. Đây là phần **không
được làm sau** — mọi module về sau đều dựa vào nó.

| # | Việc | Chi tiết |
|---|---|---|
| 1.1 | `db/pool.js` + `withTransaction()` | **Đã làm ở Phase 0** — chỉ cần dùng. Mọi hàm ghi chạy trong một transaction; lỗi là rollback toàn bộ |
| 1.2 | `users` + `departments` + `department_managers` repo | SQL viết tay, tham số hoá 100% (không nối chuỗi) |
| 1.3 | `auth.login` | `@node-rs/bcrypt` cost 12 (xem §3.3); sai 5 lần khoá tài khoản 15 phút (`failed_logins`, `locked_until`); thông báo lỗi **không** phân biệt "sai email" và "sai mật khẩu" |
| 1.4 | Phiên | Cookie `sid` httpOnly + Secure + SameSite=Lax; bảng `sessions`; hạn 8 giờ, tự gia hạn khi còn hoạt động; đăng xuất xoá dòng |
| 1.5 | CSRF | Token trong cookie đọc được + header `X-CSRF-Token`; bắt buộc cho mọi `POST/PATCH/DELETE` |
| 1.6 | `middleware/rbac.js` | Port `checkUserPermission` theo §6; hàm `can()` thuần, không phụ thuộc Express để test dễ |
| 1.7 | `auth.changePassword` | Bắt nhập mật khẩu cũ; tối thiểu 8 ký tự; `must_change_password = false` sau khi đổi |
| 1.8 | Bắt đổi mật khẩu lần đầu | `must_change_password = true` ⇒ mọi API trừ `/auth/*` trả `403 MUST_CHANGE_PASSWORD` |
| 1.9 | `middleware/audit.js` | Ghi `activity_logs` cho mọi request ghi thành công: ai, làm gì, thực thể nào, IP |
| 1.10 | `rateLimit` | `/api/rpc/authenticateUser` và `/auth/login`: 5 lần / 15 phút / IP |
| 1.11 | `middleware/errorHandler.js` | Hình dạng lỗi §5.3, `traceId`, không lộ stack |
| 1.12 | `GET /healthz` | **Đã làm ở Phase 0**: `/healthz` chỉ trả `{ok, uptime_s}` (công khai cho Nginx, không lộ gì), `/readyz` kiểm kết nối Postgres và trả 503 nếu CSDL chết |

**Xong khi**: bộ test Phase 1 (≥45 test) xanh, gồm **ma trận quyền đầy đủ** 6 vai × 5 loại thực
thể × 4 hành động = 120 phép kiểm sinh tự động từ một bảng khai báo.

**Rủi ro**: `checkUserPermission` hiện tại đọc quyền bằng `String(role).toLowerCase().includes(...)`.
Port thẳng sẽ **giữ luôn cái bẫy**: `"Phó Giám đốc"` chứa cả `"giám đốc"`, và một người có
`Phân quyền = "Trợ lý admin"` sẽ được coi là **admin**. Bản VPS phải so **khớp chính xác** với
danh sách vai trò cho phép, và Phase 2 in ra mọi giá trị `Phân quyền` lạ để sửa tay trước khi nhập.

---

### Phase 2 — Dữ liệu test tự tạo (1 ngày) · ĐÃ ĐỔI HƯỚNG

> **Đổi hướng ngày 2026-08-24** (người dùng chốt): "bỏ qua đồng bộ data cũ đi, tự tạo data test".
> Phase 2 bản đầu là **nhập dữ liệu thật từ Google Sheets** (`tools/import-from-sheets.js`, việc
> 2.1–2.7, TC-IMP-01..14). Công cụ đó đã viết xong, chạy thật đúng 28/28 dòng, rồi **bị xoá hẳn
> khỏi kho** cùng toàn bộ test của nó. Lý do đổi: dữ liệu thật chỉ có **28 dòng** (§13.8) — ít
> hơn cả dữ liệu mẫu — mà kéo theo email và mật khẩu văn bản thuần của người thật vào máy dev,
> vào CSDL dev và vào mọi bản sao lưu. Nhập tay lại 28 dòng khi lên bản chính thức rẻ hơn nhiều.
>
> **Bỏ luôn cả `tools/dump-sheets.js` và `data/snapshot-20260824.json`** (2026-08-25, §13.4 mục
> 11): công cụ đã làm xong việc của nó, và giữ một file JSON có email + mật khẩu văn bản thuần của
> người thật trên máy dev là rủi ro không đổi lấy gì. Phần **§13.8 phân tích dữ liệu thật vẫn còn
> giá trị** — đó là nơi biết được vai trò viết hoa/thường lẫn lộn, mật khẩu rỗng, `Trạng thái
> duyệt` rỗng: những cái đó thành ràng buộc của lược đồ, không cần công cụ nhập mới học được. Bản
> `.xlsx` gốc vẫn nằm ngoài kho, đủ để đối chiếu khi nhập tay ở Phase 9.

**Mục tiêu**: một lệnh `npm run seed:dev` dựng đủ dữ liệu để bấm thử tay hết Phase 3, **không có
một dòng nào là nhân sự thật**.

| # | Việc | Chi tiết |
|---|---|---|
| 2.1 | `src/db/seeds/dev.sql` | Một file, một `BEGIN … COMMIT`. Nội dung và số lượng: **§8.3** |
| 2.2 | Chạy lại không sinh trùng | Bảng có `code` ⇒ `ON CONFLICT (code) DO UPDATE`; bảng không có khoá tự nhiên (nhắc việc, chat, thông báo, nhật ký) ⇒ `INSERT … WHERE NOT EXISTS` theo nội dung |
| 2.3 | Chốt an toàn | `src/db/seeds/run.js` **từ chối** khi `NODE_ENV=production` **hoặc** tên CSDL chứa `prod`, thoát mã 1 |
| 2.4 | Đẩy sequence sinh mã | `setval(seq, GREATEST(last_value, n))` cho cả 6 sequence — xem đoạn cuối §8.3 |
| 2.5 | Dữ liệu bẩn có chủ ý | Email chữ hoa, trùng họ tên, nhiệm vụ mồ côi, link sai định dạng, nhắc việc rỗng, ngày vắt qua năm, ngày 29/02 |
| 2.6 | Test đi kèm | `tests/integration/seed-dev.test.js` — hằng `EXPECTED` là **chỗ duy nhất** ghi số lượng; mỗi test khẳng định một điều kiện mà API Phase 3 sẽ dựa vào |

**Xong khi**: `npm run seed:dev` xanh trên CSDL dev · chạy lần 2 ra **đúng cùng số dòng** · mã do
`next_code()` sinh ra không đụng mã đặt tay trong seed · `seed-dev.test.js` xanh.

**Rủi ro**: dữ liệu mẫu "sạch quá". Seed toàn dòng đẹp thì test Phase 3 xanh mà chẳng đi qua
nhánh nào — không có `NULL`, không có mồ côi, không có ngày biên. Chống bằng cách để mỗi trường
hợp bẩn ở §8.3 có **một test riêng khẳng định nó còn đó**, để lần sau ai "dọn cho sạch" thì test
đỏ ngay chứ không âm thầm mất.

---

### Phase 3 — API công việc 3 tầng (6 ngày)

**Mục tiêu**: phần lõi của cả hệ thống. Toàn bộ nhóm B và C ở §2 chạy được qua API.

| # | Việc | Chi tiết |
|---|---|---|
| 3.1 | `works` CRUD + copy | Copy công việc nhân bản cả cây con, sinh mã mới, `parent_id` trỏ đúng bản sao |
| 3.2 | `workItems` CRUD | Một service cho cả cấp 2 và cấp 3, phân biệt bằng `level` |
| 3.3 | 6 nhánh chặn của `updateTask` | Không đổi cấp · không tự trỏ vào mình · không trỏ vào con cháu · cha phải tồn tại · cha phải là cấp 2 · cấp 2 không có cha |
| 3.4 | Chuyển sang công việc khác | Chặn chuyển cấp 2 **đang có con**; chuyển cấp 3 thì bỏ `parent_id` và trả `parentCleared: true` |
| 3.5 | Xoá đệ quy | `ON DELETE CASCADE` lo phần dữ liệu; service trả về **danh sách mã đã xoá** để frontend hỏi lại trước khi xoá |
| 3.6 | `GET /works/tree` | Truy vấn `WITH RECURSIVE`; nhiệm vụ có `parent_id IS NULL` gom vào nhóm `(chưa gán công việc con)` |
| 3.7 | `reorder` | Cập nhật `sort_order` trong **một** transaction |
| 3.8 | `reminders` CRUD | Chỉ cho `level = 3`; gọi trên cấp 2 trả `409 REMINDER_ON_SUBWORK` |
| 3.9 | Sinh mã | `CV001`, `NV010` — sinh bằng chuỗi tăng dần trong CSDL (`next_code`, §0.1), **không** dựa mốc thời gian như `generateTaskIdForProject` |
| 3.10 | Ràng buộc ngày | Ngày nhiệm vụ nằm trong khoảng ngày công việc cha; vi phạm là cảnh báo (không chặn), đúng như hiện tại |
| 3.11 | **Mới** — gắn phòng cho **cả ba cấp** | `work_items.department_id` là cột thật, nhưng **luôn** bằng phòng của công việc cha: để trống thì trigger điền, đặt lệch thì `DEPT_MISMATCH_WORK` (400), đổi phòng cấp 1 thì lan xuống toàn cây (§4.1 bảng trigger `002`) |
| 3.12 | **Mới** — nguồn gốc từng đầu việc | 5 cột `created_by_name, origin, assigned_by_id, assigned_by_name, assigned_at` trên `works` **và** `work_items`; suy từ hành vi (`deriveOrigin`), người giao **đầu tiên** bất biến nhờ trigger `keep_first_origin`; phơi ra dưới khoá `originInfo` (§5.2) |
| 3.13 | **Mới** — nhật ký từng đầu việc | `GET /works/:id/history` và `GET /work-items/:id/history` đọc `activity_logs` lọc theo `(entity_type, entity_id)`, cũ trước mới sau; mỗi lần sửa ghi `details.changes` dạng `cột: từ → thành` do `diffRows` tính giữa dòng trước và sau khi ghi |

**Xong khi**: **toàn bộ 40 phép kiểm** của `tools/test-tasks-gd2.js` được port thành integration
test chạy trên Postgres thật và xanh · thêm ≥25 test mới cho tree, reorder, cascade, đồng thời ·
TC-TREE-36 (phòng cả ba cấp) và TC-ORIGIN-01..14 xanh.


**Rủi ro**: mã nhiệm vụ hiện sinh theo mốc thời gian tới millisecond. Hai người bấm cùng lúc trên
VPS sẽ nhanh hơn Apps Script rất nhiều ⇒ **có thể trùng mã**. Bắt buộc đổi sang chuỗi tăng dần
trong CSDL + `UNIQUE` trên `code`, và có test 20 request đồng thời.

---

### Phase 4 — Cắt frontend sang API (5 ngày)

**Mục tiêu**: 9 màn hình hiện tại chạy trên VPS, giao diện **không đổi một pixel**.

| # | Việc | Chi tiết |
|---|---|---|
| 4.1 | Tách file | `index.html` bỏ `<?!= include('js') ?>` / `include('CSS')`, thay bằng `<script src>` và `<link>`; `js.clean.html` → `web/assets/js/app.js` (bỏ 2 thẻ `<script>` bọc ngoài); `CSS.html` → `web/assets/css/app.css` |
| 4.2 | `api-bridge.js` | Theo §5.1, đủ **37** tên hàm (kế hoạch viết 36 là đếm sai — §13.5); nạp **trước** `app.js` |
| 4.3 | Tự chứa thư viện ngoài | Tải Tailwind (bản build sẵn, không dùng `cdn.tailwindcss.com` trên production), Chart.js, Font Awesome, font Inter về `web/assets/vendor/` |
| 4.4 | Đăng nhập | Trang đăng nhập dùng cookie phiên; hết phiên (401) ⇒ hiện lại modal đăng nhập, không đứng im |
| 4.5 | Bắt buộc đổi mật khẩu | Nhận `403 MUST_CHANGE_PASSWORD` ⇒ mở thẳng modal đổi mật khẩu, không cho vào app |
| 4.6 | Chống XSS | Soát **53 chỗ `innerHTML`**; mọi giá trị do người dùng nhập phải qua hàm thoát ký tự. Có sẵn `escapeHtmlAttr`, cần thêm `escapeHtml` cho nội dung |
| 4.7 | Bỏ code chết | Listener `#add-notification-btn` không có nút tương ứng trong `index.html`; hoặc thêm nút, hoặc bỏ listener |
| 4.8 | Phục vụ tĩnh | Nginx phục vụ `web/`, cache `assets/` 30 ngày, `index.html` không cache |

**Xong khi**: chạy hết **checklist khói 60 điểm** (§8.5) trên Chrome + Edge + 1 điện thoại · console
không có lỗi đỏ · so ảnh chụp 9 màn hình với bản Apps Script, khác biệt chỉ ở dữ liệu.

**Rủi ro cao nhất của cả kế hoạch**: `js.clean.html` không có build step, mọi thứ là chuỗi
template và `?.` nên **lỗi im lặng**. Giảm nhẹ: Phase 4 chỉ được sửa 4 việc (tách file, bridge,
vendor, escape) — **cấm** đổi tên hàm, đổi id DOM, dọn code. Ai muốn dọn thì để phase sau.

---

### Phase 5 — Luồng duyệt + thông báo + lịch chạy (4 ngày)

**Mục tiêu**: nhóm K của §2 chạy đủ. Đây là tính năng nghiệp vụ **mới** quan trọng nhất.

| # | Việc | Chi tiết |
|---|---|---|
| 5.1 | Đặt trạng thái khi tạo | Trưởng/Phó phòng tạo cấp 1 hoặc cấp 2 ⇒ `Chờ duyệt`; admin / Phó GĐ ⇒ `Đã duyệt`. Cấp 3 luôn `Đã duyệt` |
| 5.2 | 3 hành động | `submit` / `approve` / `reject` (kèm lý do bắt buộc, ≥10 ký tự) |
| 5.3 | Quyền duyệt | admin: mọi phòng. Phó GĐ: chỉ phòng có tên mình trong `department_managers` |
| 5.4 | **Loại khỏi thống kê** | Mọi truy vấn đếm và biểu đồ thêm `AND approval_status <> 'Chờ duyệt'`. Làm bằng **một view** `v_countable_works` / `v_countable_items` để không thể sót chỗ nào |
| 5.5 | Badge chờ duyệt | `GET /approvals/pending-count`, gọi lại sau mỗi lần duyệt |
| 5.6 | Nhãn vàng | Cả phòng thấy mục `Chờ duyệt`, có nhãn, không sửa được nếu không phải người tạo |
| 5.7 | Thông báo | Có mục mới chờ ⇒ thông báo cho Phó GĐ phụ trách; được duyệt / bị từ chối ⇒ thông báo cho người tạo |
| 5.8 | `services/cron.js` | 07:00 hằng ngày: quét nhiệm vụ quá hạn, tạo thông báo (thay `setupDailyTrigger`). Chạy trong container `app`, có cờ `CRON_ENABLED` để staging tắt |
| 5.9 | ~~Email~~ | **Bỏ** — chốt 2026-08-24 (§13.4 mục 4): không gửi email, không cài `nodemailer`. Thông báo chỉ trong bảng `notifications` + badge |
| 5.10 | **`GET /api/v1/bootstrap`** | Thêm 2026-08-25 sau lượt khói §8.5 của Phase 4 (§5.2 đã chốt đường này). Một lời gọi trả gói dữ liệu đầu trang: người đăng nhập, danh sách phòng, danh sách người, số đếm chờ duyệt, thống kê tổng quan. Mở `getDataForUser` + `getInitialDataWithAuth` + `getDepartmentContext` trong cầu RPC ⇒ **mở 17 điểm ⏳** của §8.5 (cả nhóm Tổng quan 10 điểm và R1–R7 Gantt). Thống kê trong gói này đọc qua view của việc 5.4; phần biểu đồ đầy đủ vẫn là Phase 6. **Phải xử luôn lệch tên trường** `full_name` (máy chủ) ↔ `currentUser.name` (57 chỗ ở `app.js`) + `currentUser.role` (4 chỗ) — nay `updateUIForUser` nổ `TypeError … reading 'split'` ngay sau đăng nhập (§13.5 nhóm cầu RPC) |
| 5.11 | Nối 7 tên nhân sự / phòng vào cầu RPC | `getStaffList`, `addStaffWithAuth`, `updateStaffWithAuth`, `deleteStaffWithAuth`, `deleteDepartmentWithAuth` (+ 2 tên phòng đã chạy từ Phase 4). Repo `users`/`departments` có từ Phase 1; **route HTTP `/api/v1/users` và CRUD `DELETE /departments` viết ở việc 5.11** — câu cũ «nghiệp vụ REST đã có từ Phase 1» là **sai**. `getStaffList` trả **mảng thô** (không bọc `{staff:[…]}`); thêm nhân sự trả `{success:true, staffId: code}`. Không nới quyền §6 (ghi user/department chỉ admin). Mở 10 điểm nhóm Người dùng & Phòng của §8.5. `getProposals`/`addApp`/`getChatMessages`… vẫn `501` tới **Phase 7** |

| 5.12 | Nút «+ công việc con» trên cây (mở điểm đỏ **C7**) | Thêm 2026-08-25 theo §13.4 mục 14 — người dùng chốt **phương án (b)**. Mỗi hàng trên cây có nút «+ công việc con»: bấm ở hàng **công việc** ⇒ mở `#task-form` ở chế độ tạo **cấp 2** (không cha); bấm ở hàng **công việc con** ⇒ tạo **cấp 3** với `parentRef` là hàng đó. Biểu mẫu **không** thêm ô «Cấp» cho người dùng chọn — cấp suy ra từ chỗ bấm; `COL.T_LEVEL`/`COL.T_PARENT` (`web/assets/js/app.js:56–57`) đang khai rồi bỏ không, việc này mới dùng đến. Đây là việc **được phép đổi DOM** (Phase 4 bị cấm), nên phải bổ sung `dom-contract.test.js` cho id mới. Xong thì điểm **C7** của §8.5 hết đỏ |

**Xong khi**: test "tạo 1 công việc `Chờ duyệt` ⇒ **cả 4 thẻ số và 6 biểu đồ không đổi một đơn
vị nào**" xanh · Phó GĐ phòng A không duyệt được mục của phòng B (403) · lý do từ chối rỗng bị chặn
· tạo được **cấp 2** từ giao diện (điểm C7).

**Rủi ro**: đây là chỗ dễ sót nhất — quyết định số 7 của kế hoạch cũ. Dùng **view** thay vì thêm
điều kiện ở từng truy vấn là cách duy nhất không sót. Kèm một test đặc biệt: chạy `EXPLAIN` mọi
truy vấn thống kê, khẳng định đều đọc qua view.

---

### Phase 6 — Thống kê, lọc, Gantt (5 ngày)

**Mục tiêu**: nhóm E, F, L của §2. Tính ở server, không tính ở trình duyệt.

| # | Việc | Chi tiết |
|---|---|---|
| 6.1 | `GET /stats/summary` | 4 thẻ số + tỷ lệ; chỉ đếm `level = 3`; loại `Chờ duyệt` |
| 6.2 | `GET /stats/charts?type=` | 6 loại biểu đồ, trả đúng hình dạng `{labels, data}` mà Chart.js đang nhận |
| 6.3 | Hoạt động gần đây | Đọc `activity_logs` có phân trang |
| 6.4 | Lọc theo tháng | **Giao nhau** khoảng ngày: `daterange(start,end) && daterange(:from,:to)`; việc kéo 3 tháng hiện ở cả 3 tháng |
| 6.5 | Lọc theo phòng | admin/Phó GĐ chọn được nhiều phòng; vai khác bị ép về phòng mình **ở server** |
| 6.6 | `GET /gantt` | Trả cây đã nhóm sẵn theo `groupBy = department \| deputy \| assignee`, thứ tự phòng theo `sort_order` |
| 6.7 | Chọn 1 / 2 / 3 tháng | Giữ `calculateGanttBarStyle` (1 tháng) và `calculateGanttBarStyleRange` (2–3 tháng) đang có |
| 6.8 | Cây 4 mức thu gọn | Nhóm → Công việc → Công việc con → Nhiệm vụ; trạng thái thu gọn lưu `localStorage` |
| 6.9 | Đối chiếu số liệu | Chạy song song bản Apps Script và bản VPS trên **cùng dữ liệu**, so từng con số |

**Xong khi**: bảng đối chiếu 4 thẻ số + 6 biểu đồ giữa hai bản **chênh 0** · Gantt 3 tháng vẽ
đúng cho việc bắt đầu trước khoảng và kết thúc sau khoảng (thanh phải bị cắt hai đầu, không mất).

**Rủi ro**: bản Apps Script đang tính thống kê ở **cả hai** phía (backend `getSummaryStats` và
frontend `renderStats`). Nếu hai bên đang lệch nhau thì "đối chiếu chênh 0" là bất khả. Việc đầu
tiên của Phase 6 là xác định con số nào đang hiện thật trên giao diện và lấy đó làm chuẩn.

---

### Phase 7 — Đề nghị, Quản lý App, Chat, xuất Excel (4 ngày)

**Mục tiêu**: nhóm G, H, I, M1 của §2.

| # | Việc | Chi tiết |
|---|---|---|
| 7.1 | `proposals` CRUD | 11 trường, 4 trạng thái + số đếm, 2 loại, tìm kiếm, chọn nhiệm vụ theo công việc |
| 7.2 | `apps` CRUD | Chỉ admin thêm/sửa/xoá; `allowed_roles[]` quyết định ai thấy app nào |
| 7.3 | Chat | Bảng thật thay cột JSON theo ngày; `GET /chat?since=` + hỏi lại mỗi 10 giây; giữ 3 ngày gần nhất, 50 tin cuối như hiện tại |
| 7.4 | Dọn chat cũ | Cron hằng tuần xoá tin cũ hơn 90 ngày |
| 7.5 | Xuất Excel | 3 mẫu: (a) Công việc 3 tầng có thụt lề, (b) Nhiệm vụ theo người thực hiện, (c) Thống kê theo phòng. Có tiêu đề, khoá dòng đầu, định dạng ngày `dd/mm/yyyy` |
| 7.6 | Quyền khi xuất | Xuất **chỉ trong phạm vi được thấy** của người bấm — không phải cứ xuất là ra toàn đơn vị |

**Xong khi**: 3 file `.xlsx` mở bằng Excel không cảnh báo · chat mở 2 tab thấy tin của nhau trong
≤10 giây · người dùng vai `Nhân viên` xuất file chỉ thấy phòng mình.

**Rủi ro**: 7.6 dễ bị bỏ qua và thành lỗ hổng rò rỉ dữ liệu. Xuất Excel phải dùng **đúng** hàm
lọc phạm vi của API danh sách, không viết truy vấn riêng.

---

### Phase 8 — Hạ tầng VPS, bảo mật, sao lưu (3 ngày)

**Mục tiêu**: dựng lại toàn bộ hệ thống trên một VPS trắng trong 30 phút theo runbook.

| # | Việc | Chi tiết |
|---|---|---|
| 8.1 | `Dockerfile` | Multi-stage, `node:24-alpine`, chạy bằng user không phải root, `HEALTHCHECK` gọi `/healthz` |
| 8.2 | `docker-compose.yml` | 4 service: `app`, `db`, `nginx`, `certbot`. `db` **không** publish port. Volume `pgdata` |
| 8.3 | Nginx | Reverse proxy, gzip, `client_max_body_size 10m`, timeout, phục vụ `web/` tĩnh |
| 8.4 | HTTPS | Let's Encrypt qua certbot, tự gia hạn bằng cron, chuyển hướng 80 → 443 |
| 8.5 | Header bảo mật | HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, CSP (bắt đầu ở chế độ chỉ báo cáo vì frontend dùng nhiều `onclick` nội tuyến) |
| 8.6 | Bí mật | Toàn bộ trong `.env` (chmod 600, **không** vào git); `deploy/.env.example` có mẫu; mật khẩu Postgres sinh ngẫu nhiên ≥32 ký tự |
| 8.7 | Sao lưu | `backup.sh`: `pg_dump -Fc` mỗi ngày 02:00, giữ 14 bản, nén, ghi log; tuỳ chọn đẩy sang nơi khác |
| 8.8 | Phục hồi | `restore.sh` + **đã thử phục hồi thật** vào CSDL rỗng, ghi lại thời gian mất bao lâu |
| 8.9 | Nhật ký | `pino` ra stdout, `docker compose logs` + xoay vòng log của Docker (`max-size=10m, max-file=5`) |
| 8.10 | Tường lửa VPS | `ufw`: chỉ mở 22, 80, 443. `fail2ban` cho SSH. SSH chỉ dùng khoá, tắt đăng nhập mật khẩu |
| 8.11 | Runbook | `deploy/runbook.md`: dựng mới, lên bản mới, lùi bản, phục hồi CSDL, xử lý 5 sự cố thường gặp |

**Xong khi**: dựng từ VPS trắng theo runbook, không phải hỏi ai, ≤30 phút · `nginx -t` sạch ·
điểm A trên SSL Labs · thử phục hồi từ bản sao lưu thành công · `docker compose down && up -d`
không mất dữ liệu.

**Cảnh báo**: hệ thống này có dữ liệu nhân sự và công việc nội bộ. Nếu VPS đặt công khai trên
Internet thì §8.4, §8.5, §8.10 là **bắt buộc**, không phải tuỳ chọn. Nếu chỉ dùng trong mạng nội
bộ thì vẫn nên có HTTPS bằng chứng thư tự ký hoặc CA nội bộ.

---

### Phase 9 — Nghiệm thu, chạy song song, cắt chuyển (4 ngày + 1 tuần theo dõi)

**Mục tiêu**: người dùng thật dùng được, và có đường lùi nếu vỡ.

| # | Việc | Chi tiết |
|---|---|---|
| 9.1 | Dựng dữ liệu bản cuối | **Nhập tay** 28 dòng thật của Sheets vào CSDL production theo bảng đối chiếu §4.3 (không còn công cụ nhập — §7 Phase 2). Số dòng phải khớp §13.8. CSDL production **không** chạy `seed:dev` (bộ chạy tự từ chối) |
| 9.1b | Đổi mật khẩu người thật | Mật khẩu cũ của Sheets là **văn bản thuần**: không mang sang. Mỗi người được đặt một mật khẩu tạm riêng, `must_change_password = true`, giao trực tiếp cho từng người — không gửi qua chat nhóm, không ghi vào file trong kho |
| 9.2 | UAT theo vai | 5 người, mỗi vai một người, chạy `docs/UAT.md` (~90 mã tính năng) |
| 9.3 | Chạy song song 1 tuần | Bản VPS là **bản chính**; Sheets đặt **chỉ đọc** để không ai sửa hai nơi |
| 9.4 | Đào tạo | 1 buổi 60 phút + tài liệu 2 trang: đăng nhập, đổi mật khẩu, tạo việc, gửi duyệt, xuất Excel |
| 9.5 | Theo dõi | Mỗi ngày xem log lỗi, thời gian phản hồi, số phiên; xử lý lỗi mức chặn trong 24 giờ |
| 9.6 | Kế hoạch lùi | Sheets + bản Apps Script giữ nguyên 30 ngày. Vỡ nặng ⇒ mở lại quyền ghi cho Sheets, nhập tay phần đã tạo trên VPS (ghi lại danh sách hằng ngày để việc này khả thi) |
| 9.7 | Đóng | Sau 30 ngày ổn định: xoá bản Apps Script, lưu Sheets làm bản lưu trữ, ghi lại quyết định vào `HUONG-DAN-BAO-TRI.md` |

**Xong khi**: `docs/UAT.md` tích đủ, 0 lỗi mức chặn, có người ký nhận · sao lưu tự động đã chạy
đủ 7 ngày liên tiếp · runbook đã được **người khác** (không phải người viết) làm thử thành công.

---

### 7.11 Bảng tổng hợp phase

| Phase | Nội dung | Ngày | Nhánh git | Chặn phase nào |
|---|---|---|---|---|
| 0 | Chuẩn bị, schema, snapshot | 3 | `vps/phase-0-setup` | tất cả |
| 1 | Auth, phiên, quyền, nhật ký | 5 | `vps/phase-1-auth` | 2–9 |
| 2 | Nhập dữ liệu từ Sheets | 3 | `vps/phase-2-import` | 9 |
| 3 | API công việc 3 tầng | 6 | `vps/phase-3-works` | 4, 5, 6 |
| 4 | Cắt frontend sang API | 5 | `vps/phase-4-frontend` | 9 |
| 5 | Duyệt, thông báo, cron | 4 | `vps/phase-5-approval` | 6 |
| 6 | Thống kê, lọc, Gantt | 5 | `vps/phase-6-stats-gantt` | 9 |
| 7 | Đề nghị, App, Chat, Excel | 4 | `vps/phase-7-misc` | 9 |
| 8 | Hạ tầng, bảo mật, sao lưu | 3 | `vps/phase-8-deploy` | 9 |
| 9 | UAT, chạy song song, cắt chuyển | 4 (+1 tuần theo dõi) | `main` | – |
| | **Tổng** | **42 ngày ± 5** | | |

Hai phase làm song song được nếu có 2 người: **3 và 4** (một người backend, một người frontend,
gặp nhau ở cầu tương thích §5.1), và **7 và 8**.

Điểm dừng an toàn để đánh giá lại: **hết Phase 4**. Lúc đó hệ thống đã chạy được đủ chức năng cũ
trên VPS; nếu cần dừng vì hết thời gian hay ngân sách thì vẫn có sản phẩm dùng được, chỉ thiếu
các tính năng mới (duyệt, Gantt nâng cao, Excel).

## 8. Kế hoạch test

Hiện tại dự án **không có test tự động** (§9 tài liệu bảo trì: "Apps Script không có test tự
động ở đây"), trừ một file duy nhất `tools/test-tasks-gd2.js` chạy trên sheet giả. Đây là lý do
mỗi lần sửa đều phải thử tay và vẫn sót lỗi im lặng. Bản VPS phải đảo ngược việc đó.

### 8.1 Tháp test và chỉ tiêu

| Tầng | Công cụ | Số test mục tiêu | Chạy khi nào | Thời gian cho phép |
|---|---|---|---|---|
| Unit — hàm thuần: quyền, ngày tháng, cây, kiểm dữ liệu | `vitest` | ~180 | mỗi lần lưu file | < 10 giây |
| Integration — API + Postgres thật | `vitest` + `supertest` | ~150 | trước mỗi commit + CI | < 3 phút |
| E2E — trình duyệt thật | `@playwright/test` | ~35 luồng | CI + trước mỗi lần phát hành | < 8 phút |
| Thủ công — UAT theo vai | `docs/UAT.md` | ~90 mã tính năng | cuối Phase 4 và Phase 9 | 1 ngày |

**Cổng chất lượng** (CI đỏ là không merge được):

- Bao phủ câu lệnh ≥ **85%** cho `middleware/rbac.js`, `modules/workItems`, `modules/approvals`,
  `modules/stats`. Đây là 4 nơi lỗi gây hậu quả nặng nhất.
- Bao phủ chung ≥ **70%**.
- **0** test bị `skip` mà không có mã lỗi kèm lý do trong tên.

### 8.2 Môi trường test

| Môi trường | Dữ liệu | Dùng để |
|---|---|---|
| `test` (máy dev + CI) | Postgres trong Docker, tạo lại từ migration + seed **trước mỗi file test** | unit + integration |
| `dev` (máy dev) | **Dữ liệu test tự tạo** (`npm run seed:dev`) — bịa hết, không có nhân sự thật | thử tay khi làm |
| `staging` (VPS, subdomain riêng) | Cùng bộ dữ liệu test đó, seed lại khi cần | E2E, UAT, thử lên bản mới |
| `production` (VPS) | Dữ liệu thật | không test trên đây, trừ smoke sau khi lên bản |

Mỗi file integration test chạy trong **một transaction rồi rollback**, hoặc `TRUNCATE … CASCADE`
rồi seed lại. Không được để test này ảnh hưởng test kia.

> **Không dùng bản sao dữ liệu thật ở dev/staging.** Bản kế hoạch đầu ghi "bản sao dữ liệu thật
> đã làm mờ" và "nhập từ snapshot Sheets"; hướng đó đã bỏ (§7 Phase 2, §13.3 ngày 2026-08-24).
> Dữ liệu thật có email và mật khẩu văn bản thuần của người thật, làm mờ thì vẫn còn cấu trúc
> nhân sự — không đáng để đánh đổi lấy chút "giống thật".

### 8.3 Dữ liệu mẫu — `src/db/seeds/dev.sql`

Một file duy nhất, một câu `BEGIN … COMMIT`, chạy bằng `npm run seed:dev`, **chạy lại bao nhiêu
lần cũng không sinh bản trùng** (bảng có `code` thì `ON CONFLICT`; bảng không có khoá tự nhiên —
nhắc việc, chat, thông báo, nhật ký — thì `INSERT … WHERE NOT EXISTS`). Bộ chạy TỪ CHỐI khi
`NODE_ENV=production` hoặc tên CSDL chứa `prod`.

Số lượng thật (kiểm bằng `seed-dev.test.js`, hằng `EXPECTED` là chỗ duy nhất phải sửa khi đổi):

| Nhóm | Nội dung |
|---|---|
| Phòng | **5**: `PH01`–`PH04` đúng tên và thứ tự file thật · `PH05` **rỗng hoàn toàn** (không người, không việc, không ai phụ trách) để nhánh "xoá phòng thành công" có dòng mà xoá |
| Người dùng | **13**, mật khẩu chung `Test@12345`, ai cũng `must_change_password`: 1 admin · 2 Phó GĐ (Một phụ trách PH01+PH02, Hai phụ trách PH03+PH04) · 2 Trưởng phòng · 1 Phó phòng · 1 **Quản lý công việc** · 5 Nhân viên · 1 Nhà cung cấp. **2 người không thuộc phòng nào** vì hai lý do khác nhau: `TEST010` nội bộ chưa xếp phòng, `TEST012` ngoài cơ quan |
| Bẫy email | `TEST011` có email **chữ hoa** (`Nghien.Cuu@test.local`) — đúng bệnh §4.1 của bản cũ, TC-AUTH-03 |
| Bẫy tên | `TEST008` và `TEST013` **trùng đúng họ tên**, khác email ⇒ dò người theo tên là sai |
| Công việc | **9** trải đủ 4 phòng, đủ 3 trạng thái duyệt (6 `Đã duyệt` · 2 `Chờ duyệt` · 1 `Từ chối` **kèm lý do**) · `CV005` **chưa có người phụ trách** · `CV003`/`CV006` kéo dài nhiều tháng |
| Cây | **13 công việc con + 17 nhiệm vụ**. `CV001-008` là công việc con **rỗng** (tính tiến độ chia cho 0) · `CV001-030` là nhiệm vụ **mồ côi** (`parent_id` NULL — CSDL cho phép, dữ liệu cũ có thật) · nhiệm vụ đủ 4 trạng thái, 2 nhiệm vụ **quá hạn** ở 2 trạng thái khác nhau (TC-STAT-03) |
| Nhắc việc | **7**, chỉ nằm trên nhiệm vụ cấp 3 · `CV006-022` có **3 nhắc** · 1 nhắc **nội dung rỗng** |
| Link | `CV002-029` có **4 link kết quả**, trong đó 1 link **sai định dạng** (thiếu `http`) |
| Ngày biên | `CV009` bắt đầu 31/12/2026 kết thúc 01/01/2027 · `CV003-028` hạn **29/02/2028** (năm nhuận) |
| Nguồn gốc | Cả **9 công việc và 30 dòng cấp 2/cấp 3** đều có `created_by_name`, và có **cả hai** nguồn gốc ở **cả ba cấp**: 3 công việc **được giao** (`CV001`, `CV004`, `CV009`), 6 công việc **tự đăng ký** — kể cả `CV005` chưa phân ai (không có người nhận thì không thể gọi là được giao) |
| Khác | **5 đề nghị** đủ 2 loại và đủ 4 trạng thái, 1 dòng không gắn công việc nào · **4 app**, 2 app mở cho mọi người (`allowed_roles` rỗng) · **12 tin chat** trải nhiều ngày, 1 tin của người đã nghỉ (`user_id` NULL) · **6 thông báo** (4 chưa đọc / 2 đã đọc, 1 không trỏ tới bản ghi nào) · **20 dòng nhật ký** dạng `<nhóm>.<việc>`, 1 dòng của tài khoản đã xoá |

Cuối file **đẩy 6 sequence sinh mã** vượt qua dữ liệu mẫu bằng
`setval(seq, GREATEST(last_value, n))`. Mã trong seed là mã **đặt tay** nên `next_code()` vẫn ở
1: không đẩy thì việc đầu tiên tạo bằng API sinh ra `CV001` và đổ vì trùng `UNIQUE`. Dùng
`GREATEST` để seed chạy lại không kéo lùi sequence đã đi xa hơn.

### 8.4 Test case theo module

Mã test đi vào tên hàm test để tra ngược được. `E2E` = phải có bản Playwright.

#### A. Xác thực & phiên (Phase 1)

| Mã | Tình huống | Kết quả mong đợi |
|---|---|---|
| TC-AUTH-01 | Email + mật khẩu đúng | 200, có cookie `sid`, có dòng trong `sessions` |
| TC-AUTH-02 | Mật khẩu sai | 401, thông báo **không** cho biết email có tồn tại hay không |
| TC-AUTH-03 | Email viết **chữ hoa** so với lúc tạo | Đăng nhập **được** (cột `citext`) — bệnh §4.1 phải hết |
| TC-AUTH-04 | Email có dấu cách đầu/cuối | Đăng nhập được |
| TC-AUTH-05 | Sai 5 lần liên tiếp | Lần 6 trả 429/423, khoá 15 phút, **kể cả** khi nhập đúng |
| TC-AUTH-06 | Người dùng `is_active = false` | 401 dù mật khẩu đúng |
| TC-AUTH-07 | Cookie giả / đã sửa | 401, không xử lý tiếp |
| TC-AUTH-08 | Phiên quá 8 giờ | 401, dòng `sessions` bị xoá |
| TC-AUTH-09 | Đăng xuất rồi gọi lại API | 401 |
| TC-AUTH-10 | `must_change_password = true` | Mọi API trừ `/auth/*` trả 403 `MUST_CHANGE_PASSWORD` |
| TC-AUTH-11 | Đổi mật khẩu sai mật khẩu cũ | 400, không đổi |
| TC-AUTH-12 | Đổi mật khẩu < 8 ký tự | 400 |
| TC-AUTH-13 | Đổi mật khẩu thành công | Băm mới khác băm cũ, các phiên **khác** bị thu hồi |
| TC-AUTH-14 | Ghi mật khẩu vào log | **Không** xuất hiện trong bất kỳ dòng log nào (test đọc log) |
| TC-AUTH-15 `E2E` | Hết phiên khi đang dùng | Hiện lại modal đăng nhập, không đứng im (bệnh cũ) |

#### B. Phân quyền (Phase 1) — sinh tự động từ bảng khai báo

| Mã | Tình huống | Kết quả mong đợi |
|---|---|---|
| TC-RBAC-01 | Ma trận 6 vai × 5 thực thể × 4 hành động | 120 phép kiểm khớp §6 |
| TC-RBAC-02 | Nhân viên sửa công việc của phòng mình | 403 |
| TC-RBAC-03 | Nhân viên sửa nhiệm vụ **của mình** | 200 |
| TC-RBAC-04 | Nhân viên đọc dữ liệu phòng khác | Không có trong kết quả trả về (không phải chỉ ẩn ở giao diện) |
| TC-RBAC-05 | Phó GĐ A duyệt mục của phòng PH03 (do B phụ trách) | 403 |
| TC-RBAC-06 | Phó phòng có đúng quyền như Trưởng phòng | Giống hệt (quyết định số 5) |
| TC-RBAC-07 | `Phân quyền = "Trợ lý admin"` | **Không** được coi là admin (bẫy `includes` của bản cũ) |
| TC-RBAC-08 | `Phân quyền = "Phó Giám đốc"` | Không bị nhận nhầm thành `Giám đốc`/admin |
| TC-RBAC-09 | Người không thuộc phòng nào | Chỉ thấy nhiệm vụ của mình, không lỗi 500 |
| TC-RBAC-10 | Gọi API bằng `id` của thực thể ngoài phạm vi (IDOR) | 403 hoặc 404, **không** trả dữ liệu |

#### C. Cây 3 tầng (Phase 3) — nặng nhất, port từ 40 test hiện có

| Mã | Tình huống | Kết quả mong đợi |
|---|---|---|
| TC-TREE-01 | Tạo cấp 2 không có `parentId` | 200, `parent_id = NULL` |
| TC-TREE-02 | Tạo cấp 2 **có** `parentId` | 400, ràng buộc `lvl2_no_parent` |
| TC-TREE-03 | Tạo cấp 3 với cha là cấp 2 cùng công việc | 200 |
| TC-TREE-04 | Tạo cấp 3 với cha là **cấp 3** | 400 `PARENT_NOT_SUBWORK` |
| TC-TREE-05 | Tạo cấp 3 với cha ở **công việc khác** | 400 `PARENT_OTHER_WORK` |
| TC-TREE-06 | Tạo cấp 3 với cha không tồn tại | 400 `PARENT_NOT_FOUND` |
| TC-TREE-07 | Tạo không truyền `level` | Mặc định `3` |
| TC-TREE-08 | Sửa để **đổi cấp** 3→2 | 400, thông báo "hãy xoá rồi tạo lại" |
| TC-TREE-09 | Đặt `parentId` trỏ vào **chính mình** | 400 `SELF_PARENT` |
| TC-TREE-10 | Đặt `parentId` trỏ vào **con cháu** của mình | 400 `CYCLE` |
| TC-TREE-11 | Dữ liệu đã trỏ vòng sẵn (A↔B) | Không treo, trả lỗi trong < 1 giây |
| TC-TREE-12 | Sửa không truyền `parentId` | Giữ cha cũ |
| TC-TREE-13 | Xoá cấp 2 có 4 con | Xoá 5 dòng, trả `deletedChildren` đủ 4 mã |
| TC-TREE-14 | Xoá cấp 3 | Chỉ xoá 1 dòng, không kéo theo ai |
| TC-TREE-15 | Xoá cấp 2 | Nhắc việc của các con **cũng bị xoá** (`CASCADE`) |
| TC-TREE-16 | Chuyển cấp 2 **đang có con** sang công việc khác | 400 `MOVE_PARENT_HAS_CHILDREN` |
| TC-TREE-17 | Chuyển cấp 2 **không có con** | 200 |
| TC-TREE-18 | Chuyển cấp 3 sang công việc khác | 200, `parent_id = NULL`, trả `parentCleared: true` |
| TC-TREE-19 | Chuyển sang công việc **không tồn tại** | 400 và **nhiệm vụ vẫn còn nguyên** (lỗi có sẵn ở bản cũ) |
| TC-TREE-20 | Sửa nhiệm vụ | `Nhắc việc`, `Cấp`, `Mã cha`, email người thực hiện **không bị mất** (lỗi có sẵn ở bản cũ) |
| TC-TREE-21 | Đổi tên người thực hiện sang tên **trùng** | `assignee_id = NULL`, giữ tên, ghi báo cáo |
| TC-TREE-22 | **Không** đổi tên người thực hiện | Giữ nguyên `assignee_id` (không tra lại, không ghi đè) |
| TC-TREE-23 | `getWorkTree` | 3 tầng lồng đúng, thứ tự theo `sort_order` |
| TC-TREE-24 | Nhiệm vụ mồ côi | Nằm trong nhóm `(chưa gán công việc con)`, **không bị mất** |
| TC-TREE-25 | Công việc không có nhiệm vụ | `children: []`, không lỗi |
| TC-TREE-26 | Nhân bản cấp 2 có 3 con | Ra 4 dòng mới, mã mới, `parent_id` trỏ vào **bản sao** của cha |
| TC-TREE-27 | Nhân bản công việc cấp 1 | Nhân bản cả cây, không dòng nào trỏ sang cây gốc |
| TC-TREE-28 | Thêm nhắc việc cho **cấp 2** | 409 `REMINDER_ON_SUBWORK` |
| TC-TREE-29 | Kéo–thả đổi thứ tự | `sort_order` đúng, chạy trong 1 transaction |
| TC-TREE-30 | `reorder` với mã lạ trong danh sách | Bỏ qua mã lạ, các mã còn lại vẫn đúng thứ tự |
| TC-TREE-31 | **20 request tạo nhiệm vụ đồng thời** | 20 mã khác nhau, không trùng, không lỗi |
| TC-TREE-32 | Tiến độ ngoài 0–100 (`-5`, `150`, `"abc"`) | Ép về 0–100 hoặc 400, không ghi giá trị lạ |
| TC-TREE-33 | Hạn chót trước ngày bắt đầu | Cảnh báo, cho lưu (giữ hành vi hiện tại) |
| TC-TREE-34 | Ngày nhiệm vụ ngoài khoảng ngày công việc | Cảnh báo, cho lưu |
| TC-TREE-35 | Lỗi giữa transaction (giả lập) | Rollback sạch, không còn dòng nửa vời |
| TC-TREE-36 | Tạo cấp 2/3 với `departmentId` **khác** phòng công việc cha | 400 `DEPT_MISMATCH_WORK`, **không** tạo dòng nào |
| TC-TREE-37 | Tạo cấp 2/3 **không** truyền phòng | Nhận phòng của công việc cha; công việc chưa có phòng thì để trống, không nổ |
| TC-TREE-38 | Đổi phòng công việc cấp 1 (và gỡ phòng, và xoá phòng) | Toàn bộ cấp 2 + cấp 3 đổi theo / về trống theo; lần Lưu không đổi phòng thì không chạm dòng con |
| TC-TREE-39 | Chuyển nhiệm vụ sang công việc **khác phòng** | Phòng đi theo công việc đích, không giữ phòng cũ |
| TC-TREE-40 | Nhân bản công việc | Bản sao và cả cây con cùng phòng với bản gốc |

**Nguồn gốc và nhật ký từng đầu việc** (mục B7/B8, C16/C17 — `tests/integration/work-origin-history.test.js`
và `tests/unit/origin.test.js`):

| Mã | Tình huống | Kết quả mong đợi |
|---|---|---|
| TC-ORIGIN-01 | Trưởng phòng tạo công việc và tự nhận quản lý | `origin = 'Tự đăng ký'`, `created_by_name` là tên họ, `assigned_by_id = NULL`, `originInfo.selfRegistered = true` |
| TC-ORIGIN-02 | Admin tạo công việc, gán Trưởng phòng làm quản lý | `origin = 'Được giao'`, `assigned_by_id` là admin, `assigned_at` có giá trị |
| TC-ORIGIN-03 | Trưởng phòng giao **lại** việc đó cho nhân viên | `manager_id` đổi, nhưng `assigned_by_id` **vẫn là admin** — người giao đầu tiên |
| TC-ORIGIN-04 | `UPDATE works SET created_by=…, assigned_by_id=…, origin=…` viết tay ở psql | Trigger `keep_first_origin` âm thầm hoàn nguyên cả 5 cột |
| TC-ORIGIN-05..08 | Bốn tình huống trên, lặp lại cho `work_items` cấp 2 **và** cấp 3, kể cả trường hợp chỉ có **tên** người thực hiện (chưa dò ra `assignee_id`) | Giống cấp 1; nhiệm vụ tự đăng ký rồi giao lại **không** đổi sang "Được giao" |
| TC-ORIGIN-09 | Tạo rồi sửa hai lần, đọc `/history` | Đúng thứ tự `create, update, update`; `details.changes.name = { from, to }`; lần sau chỉ có khoá `status` |
| TC-ORIGIN-10 | PATCH không đổi gì | **Không** có khoá `details.changes` |
| TC-ORIGIN-11 | Dump `details::text` của mọi dòng nhật ký | Không chứa mật khẩu mẫu, cũng không chứa chữ `password` (§8.7) |
| TC-ORIGIN-12 | Cắm sẵn một dòng nhật ký `entity_type = 'work'` có **cùng id số** với nhiệm vụ | `/work-items/:id/history` chỉ trả các dòng `'task'`, không trả dòng `'work'` |
| TC-ORIGIN-13 | Chuyển nhiệm vụ sang công việc khác | `changes.work_id = { from, to }`, và **không** có `changes.code` — mã không bao giờ đổi (§13.4 mục 6) |
| TC-ORIGIN-14 | Nhân viên đọc `/history` của công việc **phòng khác** | 403, nhật ký cũng phải qua đúng lưới phân quyền như dữ liệu |
| TC-ORIGIN-15 | `deriveOrigin` / `diffRows` / `originOf` — 19 test đơn vị | Trong đó: `recipientId = '7'` dạng chuỗi vẫn là chính mình · số ra dạng chuỗi (`50` vs `'50'`) không bị coi là đã đổi · `Date` và chuỗi ISO cùng thời điểm là một · cột ngoài danh sách trắng (`password_hash`) bị bỏ qua · không đổi gì ⇒ `null`, không phải `{}` |

#### D. Dữ liệu test tự tạo (Phase 2)

> **TC-IMP-01..14 đã bỏ** cùng công cụ nhập từ Sheets (§7 Phase 2, đổi hướng 2026-08-24). Chỗ nào
> trong tài liệu còn nhắc TC-IMP thì đọc là "đã rút". Những điều TC-IMP kiểm mà **vẫn còn cần**
> — ngày biên 31/12–01/01, ngày 29/02, họ tên trùng, email chữ hoa — chuyển thành yêu cầu về
> **nội dung dữ liệu mẫu** dưới đây, vì Phase 3 cần chúng để có nhánh mà đi.

| Mã | Tình huống | Kết quả mong đợi |
|---|---|---|
| TC-SEED-01 | `npm run seed:dev` trên CSDL rỗng | Đúng số dòng của §8.3, không lỗi |
| TC-SEED-02 | Chạy lần 2 | **Đúng cùng số dòng** — không sinh bản trùng ở cả 4 bảng không có khoá tự nhiên |
| TC-SEED-03 | `NODE_ENV=production` | Từ chối chạy, thoát mã 1, **không ghi gì** |
| TC-SEED-04 | Tên CSDL chứa `prod` | Từ chối chạy, kể cả khi `NODE_ENV` là `development` |
| TC-SEED-05 | Mật khẩu mẫu | `verifyPassword('Test@12345', hash)` đúng · mọi người `must_change_password = true` |
| TC-SEED-06 | Đủ 6 vai trò | 6 giá trị của `users_role_valid` đều có người thật mang, nhập được (không vi phạm CHECK) |
| TC-SEED-07 | Email chữ hoa | Có ít nhất 1 người, và tra bằng chữ thường vẫn ra đúng người đó (`citext`) |
| TC-SEED-08 | Trùng họ tên | Có đúng 1 cặp trùng tên khác email |
| TC-SEED-09 | Phòng rỗng hoàn toàn | Có đúng 1 phòng không người, không việc, không ai phụ trách |
| TC-SEED-10 | Cây 3 cấp hợp lệ | Không cấp 2 nào có cha · không con nào có cha khác công việc hoặc cha cấp 3 |
| TC-SEED-11 | Nhiệm vụ mồ côi | Có **đúng 1** nhiệm vụ cấp 3 `parent_id` NULL, vẫn còn `work_id` |
| TC-SEED-12 | Công việc con rỗng | Có công việc con không có nhiệm vụ nào (tính tiến độ chia cho 0) |
| TC-SEED-13 | Quá hạn | Có ≥2 nhiệm vụ quá hạn ở **2 trạng thái khác nhau**; việc `Hoàn thành` không bị tính quá hạn |
| TC-SEED-14 | Chưa phân người | Có dòng `assignee_id` NULL mà `assignee_name` **không rỗng** |
| TC-SEED-15 | Nhắc việc | Chỉ nằm trên cấp 3 · có nhiệm vụ nhiều nhắc · có 1 nhắc nội dung rỗng |
| TC-SEED-16 | Link kết quả | Có nhiệm vụ 4 link, trong đó 1 link thiếu giao thức `http` |
| TC-SEED-17 | Ngày biên | Có công việc vắt qua năm (31/12 → 01/01) và nhiệm vụ hạn 29/02 năm nhuận |
| TC-SEED-18 | `allowed_roles` của app | Chỉ chứa tên vai trò hợp lệ · có app mảng rỗng (mọi người thấy) |
| TC-SEED-19 | Người đã xoá | Chat và nhật ký có dòng `*_id` NULL mà vẫn còn tên |
| TC-SEED-20 | Thông báo | Có cả đã đọc và chưa đọc · có dòng không trỏ bản ghi nào · không dòng nào `ref_type` có chữ mà `ref_id` NULL |
| TC-SEED-21 | Dạng `action` nhật ký | Mọi dòng khớp `<nhóm>.<việc>` đúng như `middleware/audit.js` sinh ra |
| TC-SEED-22 | Sequence sinh mã | `next_code()` cho cả 6 loại mã ra mã **chưa tồn tại** trong dữ liệu mẫu |
| TC-SEED-23 | Không kéo lùi sequence | Đẩy `seq_work_code` lên 50 rồi seed lại ⇒ mã kế tiếp là `CV051`, không phải `CV009` |

#### E. Luồng duyệt (Phase 5)

| Mã | Tình huống | Kết quả mong đợi |
|---|---|---|
| TC-APR-01 | Trưởng phòng tạo công việc | `approval_status = 'Chờ duyệt'` |
| TC-APR-02 | Phó phòng tạo công việc con | `Chờ duyệt` |
| TC-APR-03 | admin tạo | `Đã duyệt` ngay |
| TC-APR-04 | Phó GĐ tạo | `Đã duyệt` ngay |
| TC-APR-05 | Ai tạo nhiệm vụ (cấp 3) | Luôn `Đã duyệt`, không có bước duyệt |
| TC-APR-06 | **Có 1 mục `Chờ duyệt`** | 4 thẻ số và **cả 6 biểu đồ** giống hệt lúc chưa có mục đó |
| TC-APR-07 | Duyệt mục đó | Con số tăng đúng 1 đơn vị |
| TC-APR-08 | Từ chối không có lý do | 400 |
| TC-APR-09 | Từ chối có lý do | `Từ chối` + lưu lý do + thông báo cho người tạo |
| TC-APR-10 | Phó GĐ duyệt phòng **không** phụ trách | 403 |
| TC-APR-11 | Nhân viên bấm duyệt (gọi thẳng API) | 403 |
| TC-APR-12 | Người trong phòng xem mục `Chờ duyệt` | Thấy, có nhãn `Chờ duyệt` |
| TC-APR-13 | Người phòng khác | Không thấy |
| TC-APR-14 | Duyệt 2 lần | Lần 2 trả 409, không tạo thông báo trùng |
| TC-APR-15 | Badge chờ duyệt | Đúng số, giảm ngay sau khi duyệt |
| TC-APR-16 | Duyệt công việc cấp 1 | Các công việc con `Chờ duyệt` bên trong **không** tự được duyệt theo |
| TC-APR-17 `E2E` | Luồng đủ: TP tạo → Phó GĐ nhận thông báo → duyệt → TP nhận thông báo | Chạy trọn vẹn trên trình duyệt |

#### F. Thống kê, lọc, Gantt (Phase 6)

| Mã | Tình huống | Kết quả mong đợi |
|---|---|---|
| TC-STAT-01 | Tổng nhiệm vụ khi có công việc con | **Chỉ** đếm cấp 3; cấp 2 là nhóm, không cộng vào |
| TC-STAT-02 | Tỷ lệ hoàn thành khi có 0 nhiệm vụ | `0%`, không `NaN`, không chia cho 0 |
| TC-STAT-03 | Nhiệm vụ quá hạn | Đúng số; nhiệm vụ đã `Hoàn thành` **không** tính quá hạn |
| TC-STAT-04 | Nhiệm vụ hạn chót **hôm nay** | Chưa tính quá hạn |
| TC-STAT-05 | 6 biểu đồ khi không có dữ liệu | Trả `{labels: [], data: []}` + thông báo, không lỗi |
| TC-STAT-06 | Bấm vào con số → danh sách | Số dòng trong danh sách **bằng đúng** con số vừa bấm |
| TC-STAT-07 | Lọc tháng 3 cho việc kéo từ tháng 2 đến tháng 4 | **Có** trong kết quả (giao nhau, không theo ngày tạo) |
| TC-STAT-08 | Việc kết thúc đúng ngày 01 của tháng lọc | Có trong kết quả |
| TC-STAT-09 | Việc thiếu ngày bắt đầu hoặc ngày kết thúc | Không làm mất dòng, không lỗi |
| TC-STAT-10 | Nhân viên lọc phòng khác qua API | Bị ép về phòng mình ở **server** |
| TC-STAT-11 | Gantt nhóm theo Phòng | Thứ tự phòng theo `sort_order` của sheet `Phòng` |
| TC-STAT-12 | Gantt nhóm theo Phó GĐ | Một Phó GĐ phụ trách 2 phòng ⇒ gộp cả 2 vào nhóm của người đó |
| TC-STAT-13 | Gantt chế độ 3 tháng, việc dài hơn khoảng | Thanh bị cắt hai đầu, **không mất** |
| TC-STAT-14 | Gantt việc nằm ngoài hẳn khoảng | Không hiện thanh |
| TC-STAT-15 | Thu gọn rồi tải lại trang | Giữ đúng trạng thái thu gọn (`localStorage`) |
| TC-STAT-16 | **Đối chiếu bản cũ** | Chạy cùng dữ liệu trên Apps Script và VPS: 4 thẻ số + 6 biểu đồ **chênh 0** |

#### G. Đề nghị, App, Chat, Excel (Phase 7)

| Mã | Tình huống | Kết quả mong đợi |
|---|---|---|
| TC-MISC-01 | Số đếm 4 thẻ trạng thái đề nghị | Tổng 4 thẻ = số đề nghị thấy được |
| TC-MISC-02 | Đổi loại đề nghị | Trường của form đổi theo, dữ liệu cũ không mất |
| TC-MISC-03 | Chọn công việc → danh sách nhiệm vụ | Chỉ nhiệm vụ của công việc đó |
| TC-MISC-04 | Xoá công việc còn đề nghị tham chiếu | Đề nghị **không bị xoá theo**, `work_id = NULL` |
| TC-MISC-05 | Nhân viên thêm app | 403 |
| TC-MISC-06 | App có `allowed_roles` | Chỉ đúng vai trò đó thấy trong lưới |
| TC-MISC-07 | Gửi chat từ 2 tab | Cả 2 thấy trong ≤10 giây |
| TC-MISC-08 | Chat chứa mã HTML `<script>` | Hiện thành **chữ**, không chạy (XSS) |
| TC-MISC-09 | Chat lấy tin | Chỉ 3 ngày gần nhất, tối đa 50 tin, thứ tự đúng |
| TC-MISC-10 | Xuất Excel công việc 3 tầng | Mở bằng Excel không cảnh báo; số dòng = số mục thấy được |
| TC-MISC-11 | Nhân viên xuất Excel | Chỉ ra dữ liệu phòng mình |
| TC-MISC-12 | Xuất Excel khi có 5.000 dòng | Xong trong < 15 giây, không hết bộ nhớ |
| TC-MISC-13 | Ngày trong file Excel | Định dạng `dd/mm/yyyy`, Excel nhận là **ngày** không phải chữ |

### 8.5 Checklist khói — chạy tay sau mỗi lần lên bản mới (15 phút)

Chia 6 nhóm, 60 điểm. Mở `docs/UAT.md` để tích. Bản đầy đủ nằm trong file đó; bản ngắn:

| Nhóm | Điểm kiểm |
|---|---|
| Đăng nhập (6) | Đăng nhập admin · sai mật khẩu · đổi mật khẩu · đăng xuất · vào lại · hết phiên |
| Tổng quan (10) | 4 thẻ số có số · 6 biểu đồ vẽ ra · bấm số mở danh sách · hoạt động gần đây có dòng |
| Công việc (14) | Tạo · sửa · xoá · nhân bản · tìm kiếm · mở chi tiết · tạo công việc con · tạo nhiệm vụ · kéo–thả · nhắc việc thêm/sửa/xoá · link kết quả · hoàn thành nhanh |
| Duyệt (8) | TP tạo ra `Chờ duyệt` · nhãn vàng hiện · badge đếm đúng · Phó GĐ thấy nút · duyệt · từ chối · thông báo tới · thống kê không đổi khi chờ duyệt |
| Người dùng & Phòng (10) | Thêm/sửa/xoá người dùng · gán phòng · gán vai trò phòng · thêm/sửa phòng · gán Phó GĐ · xoá phòng còn người bị chặn · xoá phòng rỗng được |
| Còn lại (12) | Gantt 1/2/3 tháng · nhóm theo 3 kiểu · thu gọn · đề nghị tạo/sửa · chat gửi/nhận · app mở được · xuất 3 file Excel |

### 8.6 Test hiệu năng

Quy mô hiện tại nhỏ (sheet `Người dùng` mới có 1 dòng), nhưng phải biết ngưỡng trước khi vỡ.

| Mã | Phép thử | Ngưỡng đạt |
|---|---|---|
| TC-PERF-01 | 50 người dùng đồng thời mở tab Tổng quan (`autocannon`) | p95 < 400 ms, 0 lỗi |
| TC-PERF-02 | `GET /works/tree` với 200 công việc × 5 con × 5 nhiệm vụ (5.000 dòng) | < 600 ms |
| TC-PERF-03 | Gantt 3 tháng, 5.000 dòng | < 800 ms phía server |
| TC-PERF-04 | Thống kê tổng quan, 5.000 dòng | < 300 ms |
| TC-PERF-05 | 20 lệnh ghi đồng thời vào cùng một công việc | Không mất dữ liệu, không deadlock |
| TC-PERF-06 | `EXPLAIN ANALYZE` 10 truy vấn nặng nhất | Không có `Seq Scan` trên bảng > 1.000 dòng |
| TC-PERF-07 | Bộ nhớ container `app` sau 1 giờ chịu tải | Không tăng đơn điệu (rò rỉ) |

Dữ liệu 5.000 dòng sinh bằng `tools/gen-load-data.js` — cùng hình dạng dữ liệu thật.

### 8.7 Test bảo mật

Bắt buộc, vì hệ thống chứa dữ liệu nhân sự và sẽ mở ra Internet.

| Mã | Phép thử | Ngưỡng đạt |
|---|---|---|
| TC-SEC-01 | Chèn SQL vào mọi trường chuỗi (`' OR 1=1--`, `"; DROP TABLE`) | Lưu thành **chữ**, không thực thi. Kiểm 100% truy vấn dùng tham số hoá |
| TC-SEC-02 | XSS: `<img src=x onerror=alert(1)>` vào tên công việc, tên nhiệm vụ, ghi chú, tin chat | Hiện thành chữ. **Soát cả 53 chỗ `innerHTML`** |
| TC-SEC-03 | XSS lưu trữ qua trường mô tả nhiều dòng | Như trên |
| TC-SEC-04 | Gửi `POST` không có CSRF token | 403 |
| TC-SEC-05 | Cookie phiên | Có `HttpOnly`, `Secure`, `SameSite=Lax`; **không** đọc được bằng `document.cookie` |
| TC-SEC-06 | IDOR: đổi `id` trong URL sang thực thể phòng khác | 403/404 với mọi vai trò |
| TC-SEC-07 | Leo thang quyền: nhân viên tự gửi `role: "admin"` khi sửa hồ sơ mình | Bị bỏ qua, vai trò không đổi |
| TC-SEC-08 | Rò rỉ trong phản hồi lỗi | Không có stack trace, không có tên bảng, không có câu SQL |
| TC-SEC-09 | Rò rỉ trong log | Không có mật khẩu, không có nội dung cookie. Áp cho **cả nhật ký nghiệp vụ**: dump `activity_logs.details::text` không được chứa mật khẩu mẫu, cũng không chứa chữ `password` — `details` do handler chọn tay từng trường, **không** bao giờ nhận cả `req.body` (TC-ORIGIN-11) |
| TC-SEC-10 | Cổng 5432 từ Internet | Đóng (`nmap` xác nhận) |
| TC-SEC-11 | Header bảo mật | Có HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` |
| TC-SEC-12 | HTTP → HTTPS | Chuyển hướng 301, không phục vụ nội dung qua HTTP |
| TC-SEC-13 | `npm audit` | 0 lỗ hổng mức `high` và `critical` |
| TC-SEC-14 | Bí mật trong git | `git log -p` không có mật khẩu, khoá, chuỗi kết nối |
| TC-SEC-15 | Người dùng bị vô hiệu hoá | Phiên đang mở bị chấm dứt ở request tiếp theo |

### 8.8 Test sao lưu & phục hồi (Phase 8)

Một bản sao lưu chưa từng được phục hồi thử thì **không phải bản sao lưu**.

| Mã | Phép thử | Ngưỡng đạt |
|---|---|---|
| TC-BAK-01 | `backup.sh` chạy tay | Ra file `.dump`, kích thước > 0, có trong log |
| TC-BAK-02 | Cron 02:00 | Chạy đủ 7 ngày liên tiếp, đủ 7 file |
| TC-BAK-03 | Giữ 14 bản | Bản thứ 15 làm file cũ nhất bị xoá |
| TC-BAK-04 | `restore.sh` vào CSDL rỗng | Phục hồi đủ 13 bảng, số dòng khớp |
| TC-BAK-05 | Phục hồi rồi đăng nhập | Đăng nhập được, dữ liệu đúng |
| TC-BAK-06 | Đo thời gian phục hồi | Ghi lại con số thật vào runbook (RTO) |
| TC-BAK-07 | Xoá container rồi `up -d` | Dữ liệu còn (volume `pgdata`) |
| TC-BAK-08 | Migration lùi rồi tiến lại | Schema về đúng trạng thái, không mất bảng |

### 8.9 Test tích hợp liên tục (CI)

`.github/workflows/ci.yml` — hoặc GitLab CI nếu dùng GitLab. Chạy trên mỗi push và mỗi PR:

```
1. checkout + node 24 + npm ci
2. npm run lint                    # ESLint + Prettier --check
3. npm run test:unit               # vitest, < 10s
4. dựng service postgres:16
5. npm run migrate:up && npm run seed:test
6. npm run test:integration        # supertest, < 3 phút
7. npx playwright test             # E2E, < 8 phút
8. npm audit --audit-level=high
9. docker build (chỉ kiểm dựng được, không đẩy)
```

Nhánh `main` được bảo vệ: **không** push trực tiếp, phải qua PR có CI xanh.

### 8.10 Tiêu chí phát hành — cả 6 điều, không thương lượng

1. CI xanh trên nhánh đang phát hành.
2. `docs/UAT.md` tích đủ 13 nhóm tính năng của §2.
3. 0 lỗi mức **chặn** và mức **nặng** đang mở.
4. Checklist khói 60 điểm (§8.5) chạy trên **staging** đạt.
5. Đã thử phục hồi từ bản sao lưu thành công (TC-BAK-04, TC-BAK-05).
6. Có runbook và **một người khác** đã làm thử theo runbook thành công.

Phân loại lỗi: **Chặn** = không đăng nhập được, mất dữ liệu, rò rỉ dữ liệu giữa các phòng ·
**Nặng** = một tính năng của §2 không dùng được, con số thống kê sai · **Nhẹ** = giao diện lệch,
chữ sai, thiếu thông báo. Chỉ lỗi **Nhẹ** được phép mang sang bản sau.

## 9. Rủi ro và cách giảm nhẹ

| # | Rủi ro | Mức | Cách giảm nhẹ |
|---|---|---|---|
| 1 | Frontend 3653 dòng không có build step, lỗi im lặng | **Cao** | Cầu tương thích §5.1 để không sửa logic; Phase 4 chỉ được làm 4 việc đã liệt kê; 35 luồng E2E Playwright thay cho việc bấm tay |
| 2 | Sót chỗ loại `Chờ duyệt` khỏi thống kê | **Cao** | Dùng **view** `v_countable_*`, không thêm điều kiện rải rác; TC-APR-06 kiểm cả 4 thẻ số và 6 biểu đồ |
| 3 | Sót chỗ chỉ đếm cấp 3 | **Cao** | `filterLevel3Tasks` đã có ở backend; ở SQL thì đặt `level = 3` **trong view**, không ở từng truy vấn |
| 4 | Dữ liệu nhập lệch mà không ai biết | **Cao** | 28 dòng thật **nhập tay** ở Phase 9 theo bảng đối chiếu §4.3, đối chiếu từng dòng với chính `file tai xuong tu google sheet.xlsx` (số liệu tổng ở §13.8; snapshot JSON đã bỏ — §13.4 mục 11) và giữ Sheets làm bản đọc lại. ~~TC-IMP-14~~ đã rút cùng công cụ nhập tự động |
| 5 | Trùng mã nhiệm vụ khi nhiều người bấm cùng lúc | Trung bình | Đổi cách sinh mã sang chuỗi tăng dần trong CSDL + `UNIQUE`; TC-TREE-31 |
| 6 | Bẫy `role.includes()` cho quyền quá rộng | Trung bình | So khớp chính xác; TC-RBAC-07, TC-RBAC-08; ràng buộc `users_role_valid` chặn ngay ở CSDL nên giá trị `Phân quyền` lạ không vào được bảng |
| 7 | XSS qua 53 chỗ `innerHTML` | Trung bình | Soát toàn bộ ở Phase 4; TC-SEC-02, TC-SEC-03, TC-MISC-08 |
| 8 | Mất dữ liệu do VPS chết | Trung bình | Sao lưu hằng ngày + **đã thử phục hồi**; giữ Sheets 30 ngày làm đường lùi |
| 9 | Người dùng không quen giao diện web mới | Thấp | Giao diện **không đổi** — đó là lý do chọn port nguyên trạng; thêm 1 buổi đào tạo |
| 10 | Ước lượng 42 ngày bị trượt | Trung bình | Điểm dừng an toàn hết Phase 4; Phase 5–7 là tính năng mới, cắt bớt được mà vẫn dùng được hệ thống |
| 11 | CDN chết ⇒ giao diện trắng | Thấp | Tự chứa toàn bộ thư viện ngoài (4.3) |
| 12 | Chỉ một người biết cách vận hành | Trung bình | Runbook + tiêu chí phát hành số 6: người khác phải làm thử được |

## 10. Vận hành sau khi lên

| Việc | Tần suất | Cách làm |
|---|---|---|
| Xem log lỗi | Hằng ngày tuần đầu, sau đó hằng tuần | `docker compose logs app \| grep '"level":50'` |
| Kiểm sao lưu | Hằng tuần | Có đủ file? Kích thước có bất thường? |
| Thử phục hồi | Hằng quý | Phục hồi vào CSDL tạm, đăng nhập kiểm |
| Cập nhật thư viện | Hằng tháng | `npm audit fix`, chạy CI, lên staging trước |
| `VACUUM ANALYZE` | Tự động | Autovacuum của Postgres; kiểm `pg_stat_user_tables` hằng quý |
| Dọn phiên hết hạn | Hằng ngày | Cron `DELETE FROM sessions WHERE expires_at < now()` |
| Dọn nhật ký cũ | Hằng năm | Chuyển `activity_logs` > 2 năm sang bảng lưu trữ |
| Gia hạn chứng thư HTTPS | Tự động | certbot; đặt cảnh báo nếu còn < 14 ngày |

## 11. Việc cần bạn cung cấp trước khi bắt đầu

| # | Cần | Vì sao chặn | Chặn phase |
|---|---|---|---|
| 1 | **Thông số VPS**: RAM, CPU, dung lượng, hệ điều hành, nhà cung cấp | Postgres + Node cần tối thiểu 2 GB RAM; dưới mức đó phải đổi cấu hình | 8 |
| 2 | **Tên miền** (hoặc quyết định dùng IP) + quyền trỏ DNS | Không có tên miền thì không xin được chứng thư Let's Encrypt | 8 |
| 3 | **Quyền SSH** vào VPS | Không có thì không dựng được | 8 |
| 4 | Hệ thống **chỉ dùng trong mạng nội bộ** hay **mở ra Internet**? | Quyết định mức bảo mật bắt buộc ở §8.7 | 8 |
| 5 | **Danh sách Phó Giám đốc**: họ tên + email + phụ trách phòng nào | Không có thì không test được luồng duyệt trên dữ liệu thật | 5, 9 |
| 6 | **Trưởng phòng / Phó phòng** từng phòng: họ tên + email | Như trên | 5, 9 |
| 7 | **Một người có thể thuộc nhiều phòng không?** | Đang thiết kế **một người một phòng** (`users.department_id`). Nếu nhiều phòng thì phải thêm bảng nối — sửa ở Phase 0 rẻ, sửa ở Phase 5 đắt | 0 |
| 8 | **Số người dùng thật** và **số dòng công việc thật** | Quyết định cấu hình VPS và ngưỡng hiệu năng | 8 |
| 9 | **Có SMTP để gửi email không?** (máy chủ, cổng, tài khoản) | Không có thì thông báo chỉ hiện trong app, không gửi email | 5 |
| 10 | Ai là **người thử theo runbook** (tiêu chí phát hành số 6) | Không có người thứ hai thì chỉ một người biết vận hành | 9 |

Mục 7 là mục **cần trả lời sớm nhất** — nó thay đổi lược đồ CSDL.

Mục 1–4 chỉ chặn Phase 8, nên **Phase 0 đến Phase 7 làm được ngay** trên máy dev mà không cần
VPS. Đây là lý do đặt hạ tầng ở Phase 8 chứ không phải Phase 1.

## 12. Việc làm ngay khi bạn duyệt kế hoạch này

1. ~~Trả lời mục 7 của §11 (một người một phòng, hay nhiều phòng).~~ **Xong 2026-08-24: một
   người thuộc MỘT phòng** (§13.4 mục 1).
2. ~~Tôi tạo nhánh `vps/phase-0-setup` và làm trọn Phase 0.~~ **Xong 2026-08-24**, 28 test xanh
   (§13.3). Phase kế tiếp là Phase 1 — prompt dán sẵn ở `docs/BAT-DAU-SESSION.md` mục 3.
3. ~~Bạn chạy `node tools/dump-sheets.js <file.xlsx>` để có snapshot thật.~~ **Xong 2026-08-24**,
   số liệu chép vào §13.8; **2026-08-25 bỏ cả công cụ lẫn snapshot** (§13.4 mục 11). Việc nhập tay
   ở Phase 9 đối chiếu trực tiếp với `.xlsx` gốc và §13.8.
4. Bản Apps Script **đóng băng** từ lúc này: chỉ sửa lỗi chặn, không thêm tính năng. Mọi tính
   năng mới đi vào bản VPS.
5. ~~Trả lời §13.4 mục 6 (dạng mã công việc con/nhiệm vụ tạo mới) trước khi làm Phase 3.~~
   **Xong 2026-08-24.** Còn cần trước Phase 3: **§13.4 mục 10** (tiền tố mã `CV` hay `DA`) —
   không chặn, đang làm theo giả định `CV`. Mục 2, 3, 4 trả lời trước Phase 5 và Phase 8.

---

**Ghi chú về bản Apps Script hiện tại**: `Code.gs.moi` đang dùng bản **bypass bản quyền** của
gsheets.vn (§4.1 và §7 của hai tài liệu kia). Chuyển sang VPS **xoá hẳn vấn đề này** vì toàn bộ
96 cổng kiểm license bị bỏ và không còn phụ thuộc mã của bên thứ ba. Đây là một lý do đáng kể
để chuyển, ngoài lý do kỹ thuật.

---

## 13. Sổ tiến độ — đọc mục này TRƯỚC KHI làm bất cứ việc gì

> **Mục đích**: hội thoại với AI bị giới hạn ngữ cảnh, mỗi session mới là một trang giấy trắng.
> Mục 13 là **bộ nhớ ngoài** của dự án. Nó phải luôn đúng, luôn ngắn, luôn là nguồn sự thật duy
> nhất về "đang làm đến đâu". Nếu §13 nói khác code, **code đúng** — sửa §13 lại.

### 13.1 Quy tắc làm việc qua nhiều session

**Đầu session — làm đúng 3 bước này, không đọc lan ra:**

0. Nếu đang mở một session **hoàn toàn mới**: dán prompt sẵn có ở `docs/BAT-DAU-SESSION.md`
   mục 3 (đã điền phase kế tiếp). File đó cũng chứa lệnh chạy môi trường dev và bẫy riêng
   của máy đang dùng. Nó là bàn đạp, **§13 vẫn là nguồn sự thật**.
1. Đọc **§13** (mục này) trước tiên — trạng thái, việc đang dở, quyết định đang chờ.
2. Đọc **đúng phase đang làm** ở §7 và **đúng module test tương ứng** ở §8.4. Không đọc cả §7.
3. Chỉ đọc thêm mục §2/§4/§5/§6 khi **phase hiện tại cần**. Ví dụ đang làm Phase 3 thì đọc §4.1
   (bảng `work_items`) + §5.2 (hàm cây) + §2.3 (tính năng C) — bỏ qua phần còn lại.

**Không đọc `Code.gs.moi` (3645 dòng) hay `js.clean.html` (3653 dòng) toàn file.** Chỉ Grep đúng
tên hàm cần port. Đọc tràn hai file này là nguyên nhân cháy ngữ cảnh phổ biến nhất của dự án này.

**Cuối session — bắt buộc, làm trước khi trả lời tổng kết:**

1. Cập nhật bảng **§13.2** (trạng thái phase).
2. Thêm một dòng vào **§13.3** (nhật ký session): ngày · làm được gì · file nào · việc kế tiếp.
3. Nếu phát sinh quyết định cần người dùng trả lời → thêm vào **§13.4**.
4. Nếu phát hiện bẫy/lỗi có sẵn mới → thêm vào **§13.5** kèm số test case.
5. Nếu thiết kế đổi (khác §4/§5/§6) → **sửa luôn mục gốc**, đừng chỉ ghi ở §13. Kế hoạch phải
   phản ánh hệ thống thật; kế hoạch lệch code là kế hoạch vô dụng.
6. Cập nhật `docs/BAT-DAU-SESSION.md`: **mục 1** (đang ở đâu) và **mục 3** (prompt đã điền sẵn
   cho phase kế tiếp). Session sau chỉ cần dán là chạy được, không phải dò lại.

**Trong session — chống cháy ngữ cảnh:**

- Làm **một phase một lần**. Đang dở phase thì không nhảy sang phase khác.
- Việc quét rộng (tìm toàn bộ chỗ gọi, kiểm kê hàm) thì giao subagent, chỉ nhận kết luận về.
- Viết file dài thì viết theo từng khối ≤ 50 dòng, không viết một cục.
- Chạy test **ngay sau mỗi hàm**, không dồn đến cuối phase mới chạy.
- Commit theo từng việc nhỏ, thông điệp có mã phase: `phase-3: thêm API cây 3 tầng`.

### 13.2 Trạng thái phase — CẬP NHẬT MỖI SESSION

Trạng thái: ⬜ chưa làm · 🟡 đang làm · ✅ xong (đã có test xanh) · ⏸️ tạm dừng vì chờ §13.4

| Phase | Nội dung | Trạng thái | Ghi chú |
|---|---|---|---|
| — | Kế hoạch `KE-HOACH-VPS.md` | ✅ | Xong 2026-08-24, §0–§13 |
| 0 | Chuẩn bị & chốt hợp đồng dữ liệu | ✅ | Xong 2026-08-24 · 28 test xanh · **hết nợ**: `dump-sheets.js` đã chạy trên `.xlsx` thật (§13.4 mục 5, số liệu §13.8), rồi cả công cụ lẫn snapshot **đã bỏ** 2026-08-25 (§13.4 mục 11) |
| 1 | Xác thực, phiên, phân quyền, nhật ký | ✅ | Xong 2026-08-24 trên nhánh `vps/phase-1-auth` — **12/12 việc** (1.1 và 1.12 làm từ Phase 0). **299 test xanh** (243 cũ + 56 mới), lint + prettier sạch. Còn **một** việc treo sang Phase 4: gắn `loginRateLimiter` cho `/api/rpc/authenticateUser` — đường dẫn đó chưa tồn tại (§13.5, dòng cuối bảng bẫy Phase 1) |
| 2 | **Dữ liệu test tự tạo** (đã đổi hướng — không nhập từ Sheets) | ✅ | Xong 2026-08-24 trên nhánh `vps/phase-2-import` (giữ tên cũ dù đã đổi hướng) · `src/db/seeds/dev.sql` = 1 phòng rỗng + 5 phòng, 13 người, 9 công việc, 13 công việc con, 17 nhiệm vụ, 7 nhắc việc, 5 đề nghị, 4 app, 12 tin nhắn, 6 thông báo, 20 dòng nhật ký (§8.3) · chạy lại **không nhân đôi** · 2 chốt an toàn có test tiến trình con · **322 test xanh**. `tools/import-from-sheets.js` **đã bỏ**, TC-IMP-01..14 khai tử |
| 3 | API công việc 3 tầng | ✅ | Xong 2026-08-25 trên nhánh `vps/phase-3-works` (tách từ `vps/phase-2-import`) — **13/13 việc** 3.1–3.13. **495 test xanh** (322 của Phase 2 + 173 mới), lint + prettier sạch. **TC-TREE-01..40** và **TC-ORIGIN-01..15** xanh; **cả 40 phép kiểm** của `tools/test-tasks-gd2.js` đã port sang `legacy-gd2-parity.test.js` (21 test, giữ nguyên cách chia mục [1]..[4] của file cũ) — **một** phép bị đảo có chủ ý: chuyển nhiệm vụ sang công việc khác **không** sinh mã mới nữa (§13.4 mục 6). Chờ người dùng: §13.4 mục 13 (ai được đặt nhắc việc) |
| 4 | Cắt frontend sang API | ✅ | Xong 2026-08-25 trên nhánh `vps/phase-4-frontend` — **8/8 việc** 4.1–4.8 + lượt khói §8.5. **675 test xanh** (495 của Phase 3 + 180 mới), lint + prettier sạch. `web/` tách khỏi Apps Script (`index.html` + `app.js` + `app.css`); `api-bridge.js` phủ **đủ 37** tên hàm cũ (17 chạy thật, 20 trả `501 NOT_IMPLEMENTED` kèm câu tiếng Việt); đăng nhập bằng cookie phiên + CSRF double-submit, `401` thì bật lại modal rồi **phát lại** lời gọi đang dở; `403 MUST_CHANGE_PASSWORD` mở modal đổi mật khẩu bắt buộc; **soát đủ 55 dòng / 70 chỗ / 474 giá trị `innerHTML`** (rủi ro số 1 của phase, TC-SEC-02/03 xanh); Tailwind + Chart.js + Font Awesome + Inter + Alpine **tự chứa** trong `web/assets/vendor/`, 0 CDN; Nginx phục vụ `web/` (tài sản cache 30 ngày, `index.html` không cache); `loginRateLimiter` đã gắn cho `/api/rpc/authenticateUser` — **hết nợ Phase 1**. Còn **2 điểm đỏ** §8.5, cả hai đã có chủ: C7 (biểu mẫu cũ không tạo được cấp 2 — §13.4 mục 14 chốt **phương án (b)** ⇒ **việc 5.12**) và D1 (Trưởng phòng tạo ra «Đã duyệt» — việc 5.2). Cuối phase làm thêm **§13.4 mục 15**: nới quyền đặt nhắc việc cho `Phó Giám đốc` phụ trách phòng (+2 test). **Điểm dừng an toàn** |
| 5 | Luồng duyệt + thông báo + lịch chạy | ✅ | Xong 2026-08-25 trên nhánh `vps/phase-5-approval` (tách từ `vps/phase-4-frontend`) — **11/11 việc** 5.1–5.8 + 5.10 + 5.11 + 5.12 (5.9 email **bỏ**). **835 test xanh / 44 file**, lint + prettier sạch. RPC **27 chạy / 10 còn 501** (đề nghị/chat/app/`addNotificationWithAuth` → Phase 7). Điểm đỏ §8.5 **C7** và **D1** hết đỏ. Khói: 9 công việc / 30 đầu việc. **Không** báo «Phase 5 xong mọi ô UAT»: D3–D8 nút Duyệt/Từ chối trên cây + badge đọc `pendingCount` vẫn ⏳ (máy chủ REST xong, không có tên RPC); T5–T10/R1–R7 mới có **nguồn**, vẽ đủ 6 biểu đồ / Gantt nhóm / lọc tháng là Phase 6. XSS pin TC-SEC-17 = **498** giá trị / 70 chỗ. |
| 6 | Thống kê, lọc, Gantt | ✅ | Xong 2026-08-25 trên nhánh `vps/phase-6-stats` (tách từ `vps/phase-5-approval`) — **9/9 việc 6.1–6.9 + trả nợ N+1 của `getTasks`**. **879 test xanh / 49 file**, lint + prettier sạch. REST mới: `GET /stats/summary` (4 thẻ+tỷ lệ, chỉ cấp 3) · `/stats/charts?type=` đủ 6 loại `{labels,data}` · `/stats/activities` có phân trang · `/gantt?groupBy=department\\|deputy\\|assignee` cây 4 mức nhóm sẵn; lọc tháng là **giao nhau** khoảng ngày (thiếu một ngày ⇒ giữ dòng), vai khác truyền `departmentIds` bị ÉP về phòng mình ở server. Frontend: Tổng quan nạp 6 biểu đồ+hoạt động từ REST (`napTongQuanTuServer`, T5–T10 ✅); Gantt vẽ từ cây máy chủ với ô 1/2/3 tháng, nhóm 3 kiểu, thu gọn nhớ `localStorage` (R1–R7 ✅); pin XSS 70 chỗ/498 giá trị → **74/541** (`docs/XSS-4.6.md`). Đối chiếu 6.9: port thuật toán cũ chạy cùng dữ liệu — **chênh 0 ở tầng cấp 3**; dòng chênh duy nhất «UI cũ đếm thêm cấp 2» ghi rõ trong `stats-parity.test.js`. Khói lại trọn lượt: **49 ✅ · 0 ❌ · 10 ⏳ · 1 —** (còn D3–D8 UI + R8–R12 = Phase 7). Khói mở rộng thêm điểm REST mới; sửa chữ stale C6/N1/R1–R7. |
| 7 | Đề nghị, Quản lý App, Chat, Excel | ✅ | Xong 2026-08-27 trên nhánh `vps/phase-7-misc` (tách từ `vps/tinh-nang-phan-cong`) — **6/6 việc 7.1–7.6** + nối tên RPC cuối. **1.085 test xanh / 64 file**, lint + prettier sạch. 7.1 `/proposals` CRUD (mã `DN0xx`, người tạo sửa của mình, Phó GĐ/admin duyệt) · 7.2 `/apps` CRUD **chỉ admin** (`assertAdmin` trong service) · 7.3 chat REST + giao diện tự nạp lại **10 giây** · 7.4 cron hằng tuần (`CRON_CHAT_CLEANUP`, mặc định 03:30 Chủ nhật) xoá tin quá **`CHAT_KEEP_DAYS`=90** ngày, có test · 7.5 xuất **3 mẫu `.xlsx`** bằng `exceljs@4.4.0` (§3.3): công việc 3 tầng thụt lề, nhiệm vụ theo người, thống kê theo phòng — có tiêu đề, đóng băng 2 hàng đầu, ngày là **ngày thật** `dd/mm/yyyy` · 7.6 xuất **chỉ trong phạm vi được thấy**, dùng **đúng** `works/tree.js getTree` và `stats/service.js` của API danh sách (service xuất **không có một câu SQL nào**), TC-MISC-11 canh Nhân viên chỉ thấy phòng mình. Cầu RPC **37/37 chạy thật** — khuôn `pending()` đã bỏ. Lượt khói §8.5 chạy lại qua Nginx 8099: `65×200 · 5×400 · 4×401 · 1×403 · 5×404`, **hết 501, không 500**; `docs/UAT.md` R8–R12 ✅ (**54 ✅ · 6 ⏳** = D3–D8 UI duyệt, cố ý để lại). Nợ mang sang: chưa có đường ĐỌC thông báo (§13.4 mục 16), ô UAT **M1** chờ người mở bằng Excel thật |
| — | **Ngoài kế hoạch: phân công ba lớp** (Ban lãnh đạo kiểm soát · Lãnh đạo phòng phụ trách · Cán bộ làm trực tiếp) + đổi tên hiển thị giao diện + modal chi tiết rộng | ✅ | Xong 2026-08-26 trên nhánh `vps/tinh-nang-phan-cong` — migration 005 (`supervisor_id`, `leader_ids`, CHECK `task_leader_single`, backfill, OR REPLACE view), module `assignments`, endpoint `assignment-options`, cầu RPC mang trường mới, form/modal giao diện; đổi tên Dự án→Công việc · Nhân viên→Cán bộ (chỉ nhãn). **898 test / 50 file** xanh; pin XSS 77/555. Chi tiết §13.3 dòng 2026-08-26 |
| — | **Ngoài kế hoạch: tab «Quản lý Nhiệm vụ» · Phó Giám đốc thấy tab «Quản lý công việc» · ỦY QUYỀN CÓ THỜI HẠN** | ✅ | Xong 2026-08-27 trên nhánh `vps/quan-ly-nhiem-vu-pgd` (tách từ `vps/phase-7-misc`) — migration 006 `delegations` (`EXCLUDE USING gist` chặn trùng khoảng ngày), **lớp 3 của `can()`** (quyền mượn + `viaDelegationId` vào `activity_logs.details`), REST `/delegations`, modal «Ủy quyền của tôi» + nhãn «đang được ủy quyền». **1.185 test / 69 file** xanh; pin XSS 83/588; cầu RPC vẫn **37/37**. Chi tiết §13.3 dòng 2026-08-27 cuối bảng. Chờ §13.4 **mục 17–20** để siết luật ủy quyền |
| — | **Ngoài kế hoạch: bộ lọc một dòng · Tháng/Năm cho «Quản lý công việc» · trang «Quản lý tài khoản» · SIẾT ỦY QUYỀN theo §13.4 mục 17/18/20 · PGĐ thấy nhiệm vụ các phòng phụ trách** | ✅ | Xong 2026-08-28 trên nhánh `vps/quan-ly-nhiem-vu-pgd` — 4 việc giao diện (`5e3a595`) + Việc E (`099fbee`) + ô chọn phòng cho Giám đốc (`3dc480b`) + ô CHỌN người nhận thay ô gõ email (`2c7412c`) + vá bẫy cột «Đối tượng» làm ô chọn rỗng với dữ liệu thật (`d32dc0d`) + **tab «Quản lý Nhiệm vụ» hết trắng với Phó Giám đốc** (`af1b92e` — phụ trách phòng nào thấy hết nhiệm vụ phòng đó, nhiều phòng cũng đúng): migration 007 `delegations` (`status` DEFAULT `'pending'`, `accepted_at`/`declined_at`, EXCLUDE nới sang `('pending','active')`), thứ bậc `BAC_VAI` + bắt cùng phòng (3 ngoại lệ cấp trên), **phê duyệt của người được ủy quyền** (`POST /:id/accept` · `/:id/decline`, admin **không** thay được) + thông báo hai chiều trong bảng `notifications`. **1.263 test / 71 file** xanh; pin XSS 86/606; cầu RPC vẫn **37/37**. Chi tiết §13.3 bảy dòng 2026-08-28. Còn treo: §13.4 **mục 19** và **mục 16** (chuông đọc thông báo) |
| — | **Ngoài kế hoạch: NHẬT KÝ TỪNG LẦN CHỈNH SỬA — tab «Nhật ký» ở cả 3 cấp, công việc cha thấy hết của con và cháu** | ✅ | Xong 2026-08-28 trên nhánh `vps/quan-ly-nhiem-vu-pgd` — **không bảng mới, không migration** (chuỗi `res.locals.audit` → `middleware/audit.js` → `activityLogs` đã có ở cả ba cấp): thêm `?scope=self\|tree` cho `GET /:id/history` (mặc định vẫn `self` nên hợp đồng API cũ không đổi), `listForWorkTree` gom theo `work_id` (con đã xoá vẫn còn dấu) + `listByEntities` cho cấp 2, `utils/historyRefs.attachRefs` gắn mã/tên/cấp cho từng dòng, **vá lỗ hổng `DELETE /work-items/:id` ghi audit thiếu `entityId`/`workId`** làm mọi lần xoá mất dấu; giao diện thêm thanh tab «Thông tin \| Nhật ký» vào modal công việc và modal nhiệm vụ, tải một lần bằng `scope=tree&limit=500`. **1.287 test / 74 file** xanh; pin XSS 89/632; cầu RPC vẫn **37/37**; banner `app.js 20260828-85`. Chi tiết §13.3 dòng 2026-08-28 cuối bảng + `docs/KE-HOACH-NHAT-KY.md`. Còn treo: test tay banner `-85`, §13.4 **mục 19** và **mục 16** |
| 8 | Hạ tầng VPS, bảo mật, sao lưu | ⬜ | Chờ §11 mục 1–4 |
| 9 | Nghiệm thu, chạy song song, cắt chuyển | ⬜ | **Nhập tay 28 dòng thật** ở đây (việc 9.1, theo bảng đối chiếu §4.3) — bản chính thức **không bao giờ** chạy `seed:dev` |

### 13.3 Nhật ký session — THÊM MỘT DÒNG MỖI SESSION, KHÔNG SỬA DÒNG CŨ

| Ngày | Làm được gì | File thay đổi | Việc kế tiếp |
|---|---|---|---|
| 2026-08-24 | Đọc toàn bộ dự án hiện tại (Apps Script + Sheets), chốt 4 quyết định kiến trúc, viết trọn kế hoạch VPS: kiểm kê 90 tính năng, lược đồ CSDL, hợp đồng API + cầu tương thích RPC, 10 phase, ~120 test case | `KE-HOACH-VPS.md` (mới, 1194 dòng) | Chờ người dùng trả lời §13.4 mục 1 rồi làm Phase 0 |
| 2026-08-24 | **Phase 0 xong** trên nhánh `vps/phase-0-setup`. Dựng cây thư mục §3.2; `001_init.sql` (12 bảng nghiệp vụ + `pgmigrations`, 6 sequence + `next_code()`, 10 index §4.2 + 4 index FK, 3 trigger kiểm cấu trúc cây/nhắc việc, 6 trigger `updated_at`) — đã chạy up → down → up sạch trên Postgres 16 thật; `docker-compose.dev.yml` (db + db-test tmpfs + adminer, mọi cổng bind 127.0.0.1); `env.js` kiểm 14 biến bắt buộc bằng zod, thiếu là chết ngay; pool pg giữ DATE dạng chuỗi `YYYY-MM-DD`; app + `/healthz` + `/readyz`; logger pino có che mật khẩu/cookie; `dump-sheets.js` (chỉ đọc, xuất nguyên văn chuỗi, không parse cột JSON, tự khớp tên sheet bị .xlsx đổi tên); `docs/UAT.md` đủ **88 mã** tính năng theo §2. **28 test xanh** (18 lược đồ + 6 env + 4 health), lint + prettier sạch. Đổi `bcrypt` → `@node-rs/bcrypt` (xem §3.3) | `server/**` (25 file), `deploy/docker-compose.dev.yml`, `deploy/.env.example`, `tools/dump-sheets.js`, `docs/UAT.md`, `.gitignore`, §3.2/§3.3/§4.1/§7/§13 của `KE-HOACH-VPS.md` | Phase 1 (xác thực, phiên, RBAC, nhật ký). Việc còn nợ của Phase 0: chạy `node tools/dump-sheets.js <file.xlsx>` khi có file thật (§13.4 mục 5) |
| 2026-08-24 | **Phase 1 làm dở, 2/12 việc** trên nhánh `vps/phase-1-auth` (2 commit): `middleware/rbac.js` — `can()` thuần theo §6, ma trận 6 vai × 5 thực thể × 4 hành động = 120 phép kiểm sinh tự động từ MỘT bảng khai báo; repo `users` + `departments` + `department_managers` — SQL viết tay, tham số hoá 100%. **95 test xanh** (28 của Phase 0 + 67 mới). Session đó hết ngữ cảnh nên **chưa kịp cập nhật §13** — §13.2 và mục 1 của `BAT-DAU-SESSION.md` bị lệch, session sau đã sửa | `server/src/middleware/rbac.js`, `server/src/modules/{users,departments}/repo.js`, `server/tests/unit/rbac-*.test.js`, `server/tests/integration/repo-*.test.js`, `server/tests/helpers/rbac.js` | Phần còn nợ của Phase 1 |
| 2026-08-24 | Người dùng trả lời §13.4 mục 1: **một người thuộc MỘT phòng** ⇒ giữ `users.department_id`, không thêm bảng nối. Đối chiếu §13 với code thật rồi sửa §13.2 cho khớp (Phase 1 🟡 2/12) và ghi rõ 8 việc Phase 1 còn nợ. **Chốt đổi thứ tự: làm Phase 2 TRƯỚC phần còn nợ của Phase 1** — Phase 2 chỉ cần lược đồ + repo + hàm băm, không cần login/phiên/CSRF; nhập dữ liệu thật sớm để phát hiện lệch thiết kế khi sửa còn rẻ. Viết lại mục 1 + mục 3 của `docs/BAT-DAU-SESSION.md` thành prompt Phase 2 | §13.2, §13.3 của `KE-HOACH-VPS.md`; `docs/BAT-DAU-SESSION.md` | **Phase 2** — `tools/import-from-sheets.js` (§7 việc 2.1–2.7, TC-IMP-01..14). Xong Phase 2 thì quay lại làm hết 8 việc còn nợ của Phase 1 |
| 2026-08-24 | **Phase 1 XONG 12/12 việc.** Làm nốt 8 việc còn nợ: `auth/password.js` (chỗ **duy nhất** gọi bcrypt, chặn cả mật khẩu > 72 byte vì bcrypt cắt âm thầm); `auth/cookies.js` (cookie `sid` = `uuid.HMAC` nên cookie giả bị loại **không cần đi CSDL**; token CSRF = `HMAC(sid)` nên không thêm cột, khởi động lại máy chủ vẫn tính đúng token cũ); `auth/repo.js` (`sessions`: tạo/đọc/gia hạn/xoá, gia hạn chỉ ghi khi lần cuối > 1 phút); `activityLogs/repo.js`; `auth/service.js` (login theo thứ tự **khoá → mật khẩu → is_active**, so với băm giả khi email không tồn tại để chống dò email); 5 middleware `session/csrf/validate/rateLimit/audit`; `auth/routes.js` (login · logout · password · me); `seeds/dev.sql` + bộ chạy từ chối `NODE_ENV=production` **và** CSDL có tên chứa `prod`. **Nối lại `app.js`**: cookie-parser → attachSession → issueCsrfCookie → verifyCsrf → audit → `/v1/auth` → `requirePasswordChanged` → route nghiệp vụ; thay 404 + bộ xử lý lỗi nội tuyến (đang trả `{success:false}` **trái §5.3**) bằng `notFoundHandler` + `errorHandler`. **299 test xanh** (243 cũ + 56 mới), lint + prettier sạch. Ghi chú số liệu: dòng §13.3 phía trên viết "95 test" là **đếm sai**, số thật lúc đó là 243 | `server/src/modules/auth/{password,cookies,repo,service,routes}.js`, `server/src/modules/activityLogs/repo.js`, `server/src/middleware/{session,csrf,validate,rateLimit,audit}.js`, `server/src/app.js`, `server/src/db/seeds/{dev.sql,run.js}`, `server/tests/unit/{password,cookies,rateLimit}.test.js`, `server/tests/integration/{auth-login,auth-session,auth-password,seed-dev}.test.js`, `server/tests/helpers/http.js`, `server/{package.json,eslint.config.js}`, §13.2/§13.3/§13.5/§13.7 của `KE-HOACH-VPS.md`, `docs/BAT-DAU-SESSION.md` | **Phase 2** — `tools/import-from-sheets.js` (§7 việc 2.1–2.7, TC-IMP-01..14). Còn treo: gắn `loginRateLimiter` cho `/api/rpc/authenticateUser` khi Phase 4 dựng cầu RPC |
| 2026-08-24 | **Phase 2 ĐỔI HƯỚNG rồi XONG.** Người dùng chốt *"bỏ qua đồng bộ data cũ đi, tự tạo data test"* ⇒ **bỏ hẳn** `tools/import-from-sheets.js` khỏi kế hoạch, khai tử TC-IMP-01..14, viết lại §7 Phase 2 · §8.2 · §8.3 · §8.4-D (23 mã mới **TC-SEED-01..23**) và chuyển việc nhập tay 28 dòng thật sang **Phase 9** (bản chính thức không bao giờ chạy `seed:dev`). Mở rộng `dev.sql` cho đủ **dữ liệu bẩn CỐ Ý** mà §8.3 đòi: email chữ hoa `Nghien.Cuu@test.local`, hai người trùng họ tên, phòng `PH05` rỗng hoàn toàn (để có đường xoá phòng thành công), nhiệm vụ **mồ côi** `CV001-030` (`parent_id` NULL — CSDL cho phép, `lvl2_no_parent` chỉ ràng cấp 2), công việc vắt qua năm `CV009`, hạn 29/02/2028 ở `CV003-028`, 4 link kết quả trong đó **1 link thiếu `http`**. Chạy lại seed **không nhân đôi** (`ON CONFLICT (code)` cho bảng có mã, `WHERE NOT EXISTS` cho bảng không mã) và 6 `setval(GREATEST(...))` đẩy sequence. Thêm `seed-guard.test.js` chạy bằng **tiến trình con** — hai chốt an toàn kết thúc bằng `process.exit(1)` nên import trực tiếp sẽ giết vitest. **Đổi từ vựng "Dự án" → "Công việc"** trên toàn bộ tài liệu và thêm **§0.1 Từ vựng** — mục này bị `dev.sql` + `001_init.sql` + `KE-HOACH-PHAT-TRIEN.md` trích dẫn nhưng **chưa từng tồn tại**; kèm đó chốt tiền tố mã sinh mới là **`CV`** (mã cũ `DA0xx` nhập tay giữ nguyên văn) và sửa mọi chỗ còn viết `DA001` như thể đó là mã mới. **322 test xanh** (299 + 23), lint + prettier sạch | `server/src/db/seeds/dev.sql`, `server/tests/integration/{seed-dev,seed-guard}.test.js`, `server/src/db/migrations/001_init.sql` (chỉ chú thích), §0/§3.2/§4.1/§4.3/§7/§8.2/§8.3/§8.4/§13 của `KE-HOACH-VPS.md`, `docs/UAT.md`, `docs/BAT-DAU-SESSION.md`, `HUONG-DAN-BAO-TRI.md`, `KE-HOACH-PHAT-TRIEN.md` | **Phase 3** — API công việc / công việc con / nhiệm vụ, 10 việc 3.1–3.10 (§7 Phase 3 + §8.4 nhóm **C**, TC-TREE-01..35). Dữ liệu mẫu 3 tầng đã sẵn (kể cả nhiệm vụ mồ côi và công việc con rỗng) nên test không phải tự dựng dữ liệu. Lưu ý: **đề nghị nằm ở Phase 7** (§8.4 nhóm G, TC-MISC) — ghi chú cũ ở `BAT-DAU-SESSION.md` xếp đề nghị vào Phase 3 là **sai**, đã sửa. Còn treo từ Phase 1: gắn `loginRateLimiter` cho `/api/rpc/authenticateUser` khi Phase 4 dựng cầu RPC |
| 2026-08-25 | **Phase 3 XONG 13/13 việc** trên nhánh `vps/phase-3-works` (tách từ `vps/phase-2-import`, 12 commit). Tầng repo `works` + `work_items` SQL viết tay, tham số hoá 100%; `utils/pgError.js` **dịch** lỗi trigger/ràng buộc của CSDL sang mã §5.3 (`PARENT_NOT_SUBWORK`, `LVL2_NO_PARENT`, `MOVE_PARENT_HAS_CHILDREN`, `REMINDER_ON_SUBWORK`, `DEPT_MISMATCH_WORK`…) — **không** viết lại quy tắc ở JS, CSDL là nguồn sự thật duy nhất. `works` CRUD + **nhân bản cả cây** (`Map(id gốc → id bản sao)` nên không dòng nào trỏ về cây gốc); MỘT service cho cả cấp 2 và cấp 3 phân biệt bằng `level`; 6 nhánh chặn của `updateTask` chia hai chỗ (4 ở service: `LEVEL_IMMUTABLE`/`SELF_PARENT`/`CYCLE`/`PARENT_NOT_FOUND`, 2 ở CSDL); chuyển sang công việc khác (chặn cấp 2 đang có con, cấp 3 trả `parentCleared: true`, đích không tồn tại thì **dòng cũ còn nguyên**); xoá đệ quy trả **danh sách mã**; `reorder` trong một giao dịch, mã lạ thì bỏ qua; `GET /works/tree` bằng `WITH RECURSIVE … CYCLE` + `depth < 50`, dòng không có cha đọc được gom vào `(chưa gán công việc con)` nên **không đánh rơi dòng nào**; nhắc việc CRUD chỉ cấp 3 (409 do trigger, không kiểm lại ở JS); ba migration mới `002_work_items_department.sql` + `003_work_origin_and_history.sql` cho **phòng cả ba cấp** (luôn khớp phòng công việc cha, lệch thì `DEPT_MISMATCH_WORK`) và **nguồn gốc từng đầu việc** (5 cột + trigger `keep_first_origin` giữ ai giao **đầu tiên**, `deriveOrigin`/`originOf`) + **nhật ký từng đầu việc** (`/history`, `diffRows` ghi `cột: từ → thành`). **Port trọn 40 phép kiểm** của `tools/test-tasks-gd2.js` sang `legacy-gd2-parity.test.js` (21 test, giữ cách chia mục [1]..[4] để đọc song song) — **một** phép đảo có chủ ý: chuyển công việc **không** sinh mã mới (§13.4 mục 6); mục [3] diễn đạt lại vì không còn ô `Nhiệm vụ JSON` và cột email, bảo đảm chuyển từ *vá-khi-đọc* sang *chặn-khi-ghi*. Việc port lộ **lỗi thật**: `listDescendants` đếm cả chính dòng gốc khi dữ liệu trỏ vòng ⇒ `deletedCount` thừa một và `copy` sao lại bản gốc. Thêm TC-TREE-40 (bản sao giữ phòng). **495 test xanh** (322 + 173), lint + prettier sạch. Ghi thêm §13.4 mục 13 (quyền đặt nhắc việc: bản cũ chỉ admin, nay ai sửa được nhiệm vụ) và bảng 8 bẫy Phase 3 ở §13.5 | `server/src/modules/{works,workItems,reminders}/{repo,service,routes}.js`, `server/src/utils/{pgError,origin,dateChecks,zodTypes,errors,sql}.js`, `server/src/db/migrations/00{2,3}_*.sql`, `server/src/db/seeds/dev.sql`, `server/src/app.js`, `server/tests/integration/{works-crud,works-tree,work-items-api,work-items-department,work-origin-history,reminders-api,legacy-gd2-parity,repo-work-items}.test.js`, `server/tests/unit/origin.test.js`, §7/§8.4/§13.2/§13.3/§13.4/§13.5 của `KE-HOACH-VPS.md`, `docs/BAT-DAU-SESSION.md` | **Phase 4 — cắt frontend sang API** (§7 việc 4.1–4.8): tách `index.html`/`js.clean.html`/`CSS.html` ra `web/`, `api-bridge.js` đủ **36 tên hàm** §5.1, soát **53 chỗ `innerHTML`**, checklist khói 60 điểm §8.5, TC-SEC-02/03 §8.7. Còn treo từ Phase 1: gắn `loginRateLimiter` cho `/api/rpc/authenticateUser` — Phase 4 mới có đường đó |

| 2026-08-25 | **Phase 4 XONG 8/8 việc** trên nhánh `vps/phase-4-frontend` (10 commit). 4.1 tách `web/` khỏi Apps Script (`index.html` 70 KB + `app.js` 305 KB + `app.css` 80 KB, không còn thẻ `<?!= ?>`); 4.2 `api-bridge.js` giả lập `google.script.run` (chuỗi `.withSuccessHandler().withFailureHandler().tên()`, gửi `X-CSRF-Token` cho **mọi** POST, dịch `{ok:false,error}` của §5.3 về chuỗi lỗi tiếng Việt mà `app.js` đang chờ) + `server/src/rpc/` (bảng 37 tên: 17 chạy thật, 20 `pending()` → `501`, tên lạ → `404`, `GET /api/rpc` in cả bảng); 4.3 tự chứa Tailwind/Chart.js/Font Awesome/Inter/Alpine trong `web/assets/vendor/` (0 CDN, CSP không cần `unsafe-*` cho script ngoài); 4.4 đăng nhập cookie phiên: `401` bật lại modal rồi **phát lại** lời gọi đang dở, `loginRateLimiter` gắn cho `/api/rpc/authenticateUser` (**hết nợ Phase 1**), `429` có test; 4.5 `403 MUST_CHANGE_PASSWORD` mở modal đổi mật khẩu bắt buộc, chặn mọi nghiệp vụ đến khi đổi xong; 4.6 **rủi ro số 1**: soát **55 dòng `innerHTML` = 70 chỗ chèn = 474 giá trị**, chỗ nào chỉ là văn bản → `textContent`, chỗ buộc dựng HTML → escape từng giá trị kể cả trong thuộc tính và trong `href` (chặn `javascript:`), TC-SEC-02/03 xanh; 4.7 bỏ listener chết `#add-notification-btn`; 4.8 Nginx phục vụ `web/` (tài sản `max-age=2592000`, `index.html` **không** cache, `404` không bị cache 30 ngày). Rồi dựng hẳn **môi trường khói riêng** (Nginx 8099 → Express → CSDL `quanlycongviec_uat` seed sạch, **không** chạm dữ liệu dev) và chạy tay **cả 60 điểm §8.5** vào `docs/UAT.md`: **19 xanh · 2 đỏ · 38 chờ Phase sau · 1 không có ở bản cũ**; bộ khói đóng thành `tools/smoke-8.5.sh` chạy lại được, tự dọn. **673 test xanh** (495 + 178 mới), lint + prettier sạch | `web/**` (`index.html`, `assets/js/api-bridge.js`, `assets/js/app.js`, `assets/css/app.css`, `assets/vendor/**`), `server/src/rpc/**` (4 file), `server/src/app.js`, `server/src/utils/errors.js`, `deploy/nginx/{app.conf,security-headers.conf}`, `server/tests/**` (7 file mới), `tools/smoke-8.5.sh`, `docs/UAT.md`, §5/§7/§13 của `KE-HOACH-VPS.md`, `docs/BAT-DAU-SESSION.md` | Phase 5 (duyệt + thông báo + lịch chạy) — prompt dán sẵn ở `docs/BAT-DAU-SESSION.md` mục 3. Việc 5.10 (`GET /api/v1/bootstrap`) mở 17 trong 38 điểm ⏳; việc 5.1 xử điểm đỏ D1; việc 5.11 mở 10 điểm nhân sự/phòng; điểm đỏ C7 chờ §13.4 mục 14 |
| 2026-08-25 | **Chốt 2 câu treo ở §13.4 + hướng dẫn test tay giao diện.** Mục 14 → **phương án (b)**: tạo cấp 2 bằng nút «+ công việc con» ngay trên cây, `#task-form` giữ nguyên là tạo cấp 3, cấp suy ra từ chỗ bấm chứ không thêm ô «Cấp» — ghi thành **việc 5.12** của §7 Phase 5 nên điểm đỏ **C7** đã có chủ (việc này *được* đổi DOM, phải bổ sung `dom-contract.test.js`). Mục 15 → **nới quyền đặt nhắc việc cho `Phó Giám đốc` phụ trách phòng**: thêm `'Phó Giám đốc'` vào `VAI_DAT_NHAC_VIEC` + đổi câu 403; phần "của phòng đấy" **không cần dòng mã nào** vì `inScope()` đã bó vai này theo `managedDepartmentIds` (`department_managers.role = 'deputy_director'`), nên Phó Giám đốc phụ trách phòng khác bị chặn ở **phạm vi** với câu *ngoài phạm vi*, không phải ở vai. Thêm 2 phép kiểm (phụ trách phòng đó ⇒ 200 · phòng khác ⇒ 403) ⇒ `reminders-api.test.js` 21 → 23, **673 → 675 test xanh**, không phép kiểm nào phải đảo. Viết `docs/HUONG-DAN-TEST-GIAO-DIEN.md`: dựng lại môi trường khói, 8 màn tự làm được **hôm nay** (đăng nhập, sai mật khẩu, khoá 5 lần, đổi mật khẩu bắt buộc, cây công việc, nhắc việc, XSS §8.7, DevTools) và ghi rõ phần **chưa test được** vì `getDataForUser`/`getInitialDataWithAuth`/`getDepartmentContext`/`getStaffList` còn `501` tới việc 5.10/5.11. **Hướng dẫn được kiểm chứng bằng jsdom** (nạp `index.html` + `app.js` thật) trước khi giao — và chính bước kiểm đó lộ **lỗi thật**: máy chủ trả `full_name`, `app.js` đọc `currentUser.name` (57 chỗ) nên `updateUIForUser` nổ `TypeError … reading 'split'` ngay sau đăng nhập ⇒ ghi vào **§13.5** + gắn vào **việc 5.10**, hướng dẫn có sẵn dòng vá tay `currentUser.name = currentUser.full_name`. Dựng lại môi trường khói còn lộ bẫy **`MSYS_NO_PATHCONV=1`**: thiếu nó thì Git Bash đổi đích `-v` thành `C:/Program Files/Git/etc/nginx/…`, `app.conf` không nạp, `/` trả 200 (trang Welcome) mà `/api/*` 404 — sửa lệnh ở `BAT-DAU-SESSION.md` mục 4 (thêm cả bước kiểm 2b) + ghi §13.5. **Sửa số đếm sai**: bảng RPC là **17 chạy thật / 20 `pending`** (đếm lại bằng `notImplemented` trên `rpcTable`, khớp `GET /api/rpc`), hai chỗ ghi 19/18 ở §13.2 và §13.3 đã sửa | `server/src/modules/reminders/service.js`, `server/tests/integration/reminders-api.test.js`, §6/§7/§13.2/§13.3/§13.4/§13.5 của `KE-HOACH-VPS.md`, `docs/BAT-DAU-SESSION.md`, `docs/HUONG-DAN-TEST-GIAO-DIEN.md` (mới) | Phase 5 — prompt dán sẵn ở `docs/BAT-DAU-SESSION.md` mục 3, **không còn câu nào phải hỏi trước** (mục 14/15 đã chốt). 11 việc: 5.1–5.8 + 5.10 + 5.11 + **5.12** |
| 2026-08-25 | **Phase 5 XONG 11/11 việc** trên nhánh `vps/phase-5-approval` (HEAD `57cfa89`: 5.4 view → 5.1 khoá duyệt khi tạo → 5.2/5.3/5.5/5.7 REST duyệt → 5.6 máy chủ+nhãn vàng → 5.8 cron 07:00 → 5.10 bootstrap → 5.11 nhân sự/phòng → 5.12 nút «+ công việc con»). **835 test / 44 file**, lint + format sạch. RPC **27/10**. Khói lần 2 (UAT đã `migrate:up` 004): **C7** `CV028-093 cấp=2 cha=NULL` · **D1** tp01 `CV030 duyệt=Chờ duyệt` · T1–T10 nguồn 200 · N* hết 501 (dummy `{}` ra 400/404). XSS 5.12: đổi tên helper `add*Html` → `create*ButtonHtml` (BUILDER HTML-LONG) + `escapeHtml(className)`, pin TC-SEC-17 **481 → 498**. `publicUser()` đã gán `name = full_name`. **Không** tô xanh D3–D8: REST approve/reject có, `app.js` không có nút trên cây, `#*-pending-count` đếm trạng thái công việc chứ không đọc `pendingCount`. T5–T10/R1–R7 nguồn xong, vẽ đủ = Phase 6 | 11 commit `phase-5: …`; `docs/UAT.md` viết lại checklist khói; §5.2 19/18 → 27/10; §7 5.11 sửa «REST từ Phase 1»; §13.5 thêm bẫy UAT thiếu 004 | **Phase 6** — thống kê, lọc, Gantt. Prompt dán sẵn `docs/BAT-DAU-SESSION.md` mục 3 |
| 2026-08-25 | **Phase 6 XONG 9/9 việc + trả nợ N+1** trên nhánh `vps/phase-6-stats` (tách từ `vps/phase-5-approval`; HEAD `3df2e44`). Việc đầu: điều tra «số nào đang hiện thật» — `renderStats` **bỏ qua tham số** và tự tính từ mảng client (gồm cả cấp 2), chuẩn đối chiếu = số UI; REST mới đi chuẩn §0.1 (chỉ cấp 3). Backend: `/stats/summary` · `/stats/charts` ×6 · `/stats/activities` phân trang · `/gantt` cây 4 mức nhóm department/deputy/assignee; lọc tháng **giao nhau** + thiếu-ngày-giữ-dòng; phòng ÉP ở server (nhân viên truyền `departmentIds` khác vẫn về phòng mình). Frontend: Tổng quan uống REST (`napTongQuanTuServer`, T5–T10 ✅); Gantt mới `renderGanttChart` vẽ cây server, ô 1/2/3 tháng, thu gọn nhớ `localStorage` (R1–R7 ✅); modal bấm-số có lọc tháng/phòng. N+1: RPC `getTasks` dùng chung `cayChoUser` — spy đếm SQL chốt ≤4 câu bất kể số công việc. Đối chiếu 6.9 port thuật toán cũ: **chênh 0 tầng cấp 3**; dòng chênh «UI đếm thêm cấp 2» khẳng định đúng số. Pin XSS **498 → 541 / 74 chỗ**, toàn helper mới đặt tên BUILDER. Khói lại trọn lượt trên CSDL UAT (`BASE=:3000`): **49 ✅ · 10 ⏳ · 1 —**, tự dọn sạch 9/30 | 9 commit `phase-6: …`; file mới: `modules/stats/{repo,service,routes}`, `modules/gantt/{service,routes}`, test `stats-api` · `gantt-api` · `rpc-gettasks-batch` · `stats-parity` · `gantt-ui`; sửa `app.js`+`index.html`+`smoke-8.5.sh`+`XSS-4.6.md`; §13.5 thêm bẫy Phase 6 | **Phase 7** — đề nghị, app, chat, Excel (§7 7.1–7.6). Prompt dán sẵn `docs/BAT-DAU-SESSION.md` mục 3 |
| 2026-08-26 | **TÍNH NĂNG PHÂN CÔNG BA LỚP XONG** trên nhánh `vps/tinh-nang-phan-cong` (tách từ `vps/phase-6-stats`; HEAD `51c8da2`) theo yêu cầu người dùng. Migration `005_phan_cong.sql`: `works`+`work_items` thêm `supervisor_id` (Ban lãnh đạo kiểm soát) + `leader_ids` (Lãnh đạo phòng phụ trách), CHECK `task_leader_single` (nhiệm vụ ≤1), backfill theo luật mặc định, **CREATE OR REPLACE lại hai view v_countable_\*** (SELECT * đóng băng cột). Module `assignments/service.js`: `listCandidates`/`listTaskCandidates`/`assertSupervisor`/`assertLeaders`/`assertTaskLeader` — KHÔNG tin danh sách client; nhiệm vụ trong CV con ⇒ leader ∈ `leader_ids` của CV con đó, thuộc cha ⇒ leader ∈ Phó GĐ phụ trách phòng (việc chung ⇒ supervisor+admin), mã lỗi `LEADER_NOT_IN_SOURCE`; cấp 3 gửi supervisor ≠ null bị chặn. Endpoint `GET /departments/assignment-options?departmentId=&parentRef=`; cầu RPC mang trường mới (`P_DEPT_ID/P_SUP/P_LEADERS/T_SUP/T_LEADERS`). Giao diện: đổi tên hiển thị Dự án→Công việc · Quản lý dự án → Quản lý công việc · Nhân viên → Cán bộ (chỉ nhãn, value/logic giữ nguyên); form công việc thêm Phòng («Công việc chung»)/Ban kiểm soát/Lãnh đạo phòng nạp động; form nhiệm vụ/CV con thêm khối phân công (`laCapHai`); modal chi tiết viết lại thành **file riêng `web/assets/js/project-details.js`** nạp sau app.js ghi đè `showProjectDetailsModal` — rộng ~1500px (≈2,5×600px bị CSS giới hạn), hiện đủ phân công + cán bộ được giao + cây CV con (khối xanh bấm mở nhiệm vụ) khác kiểu Nhiệm vụ. Pin XSS **541 → 555 / 77 chỗ**. **19 test mới** (`assignments.test.js`) ⇒ **898 test / 50 file** xanh; lint + format sạch; migration đã lên UAT (`quanlycongviec_uat`) + smoke §8.5 chạy lại xanh tương đương | 4 commit `phan-cong: …`/`tinh-nang: …`; file mới: migration 005, `modules/assignments/service.js`, `assignments.test.js`, `project-details.js`; sửa legacyFields, users/departments/works/workItems repo+service+routes, errors, xss-guard.test, XSS-4.6.md, BAT-DAU-SESSION.md | Phase 7 — đề nghị, app, chat, Excel; tách từ nhánh này |
| 2026-08-26 | **Kiểm chứng sau fix + chốt bẫy COL.** Bắt và sửa bẫy lớn: `const COL` phía **client** (`app.js`) thiếu 5 khoá phân công ba lớp (`P_DEPT_ID/P_SUP/P_LEADERS/T_SUP/T_LEADERS`) nên mọi `project[COL.*]` đọc ra `undefined` — «không chọn được phòng», dropdown lãnh đạo rỗng dù API trả đủ. Đã bổ sung đủ + viết `server/tests/unit/col-parity.test.js` so nguyên văn từng khoá COL client↔server (bẫy này không bao giờ lặp lại được nữa). Cắt ô «Quản lý công việc» khỏi form công việc (thay bằng khối phân công ba lớp); xác minh `createLevel` vẫn tồn tại cho form nhiệm vụ/CV con; pin XSS cập nhật **555 → 550 / 77 chỗ** (TC-SEC-11 `text3` 3 → 2, TC-SEC-17), `docs/XSS-4.6.md` ghi đủ lịch sử. Kiểm chứng thực tế trên UAT (script `tools/_verify-uat.mjs`): login 200, bootstrap **15 người / 5 phòng**, `assignment-options?departmentId=1` trả `{supervisors: 2, leaders: 2, defaultSupervisorId, defaultLeaderId}` khớp đúng key client đọc. **900 test / 51 file** xanh; bump cache-buster `app.js ?v=20260826-63` · `project-details.js ?v=20260826-2`. Đặt lại mật khẩu admin UAT (`MatKhauMoi@123`, hash `$2y$12$` bằng `@node-rs/bcrypt` của server) vì mật khẩu cũ thất lạc | `web/assets/js/app.js`, `web/index.html`, `server/tests/unit/col-parity.test.js` (mới), `server/tests/unit/xss-guard.test.js`, `docs/XSS-4.6.md`, `docs/UAT.md`, `docs/BAT-DAU-SESSION.md`; tool: `tools/dem-xss.mjs` (giữ), `tools/_verify-uat.mjs`, `server/tools/_dat-lai-mk-admin-uat.mjs` (tạm) | Phase 7 — đề nghị, quản lý app, chat, xuất Excel (§7 7.1–7.6) |
| 2026-08-26 | **Sửa «dropdown Phòng chỉ còn Công việc chung» — bẫy COL lần 2 (khoá D_DB_ID).** Người dùng báo form «Tạo công việc mới» không có danh sách phòng. Nguyên nhân KHÔNG phải thiếu dữ liệu: `loadDepartmentContext` nạp đủ 5 phòng, nhưng `buildDeptIdOptions` đọc `d.id`/`d.name` trong khi `allDepartments` là object **khoá legacy** (`COL.D_ID`=«Mã phòng», `COL.D_NAME`=«Tên phòng» do `departmentToLegacy` trả) ⇒ hai khoá đó `undefined` ⇒ mọi option rỗng. Hơn nữa value option **phải là id số**: `projectFromLegacy` ép `numberOrUndefined` (gửi mã «PH01» là phòng bị bỏ im lặng) và preselect khi sửa dùng `P_DEPT_ID` (id số) — mà dòng legacy phòng không mang id số nào. Fix: thêm khoá `D_DB_ID` («ID phòng (DB)») vào COL **cả hai phía** (client `app.js` + server `legacyFields.js`, `departmentToLegacy` trả `row.id`); `buildDeptIdOptions` đọc `d[COL.D_DB_ID]`/`d[COL.D_NAME]`. Kéo theo sửa nốt cạnh lân cận: `projectFromLegacy` đổi `departmentId`/`supervisorId` sang `idOrNullOrUndefined` — `""` (chọn lại «Công việc chung» khi SỬA) giờ thành `null` để PATCH **xoá liên kết** (bản cũ drop khoá ⇒ silent no-op, phòng cũ bị giữ); server `idInput` vốn sẵn sàng nhận `null` = bỏ liên kết, `assertSupervisor(null)`/`assertLeaders([])` đều hợp lệ. Test mới: `dept-select.test.js` (4 — chạy app.js THẬT trong jsdom: option mang id số + nhãn tên phòng + preselect theo `P_DEPT_ID`), `project-from-legacy-phong.test.js` (4 — số/`null`/thiếu khoá/mã rác). **908 test / 53 file** xanh; bump cache-buster `app.js ?v=20260826-64`. Tool kiểm chứng `tools/_kiem-tra-phong.mjs` (login live bị 401 vì mật khẩu UAT đã đổi — phần ánh xạ `departmentToLegacy` đã bọc bởi test) | `web/assets/js/app.js` (COL + `buildDeptIdOptions`), `web/index.html`, `server/src/rpc/legacyFields.js` (COL + `departmentToLegacy` + `projectFromLegacy`), `server/tests/unit/dept-select.test.js` (mới), `server/tests/unit/project-from-legacy-phong.test.js` (mới), tool `tools/_kiem-tra-phong.mjs` (tạm) | Phase 7 — đề nghị, quản lý app, chat, xuất Excel (§7 7.1–7.6) |
| 2026-08-26 | **Sửa nốt form phân công: trùng «Công việc chung», leaders không tick mặc định + đổi tên admin thành «Giám đốc».** Sau khi người dùng tự dựng lại bộ UAT (502 lúc nửa chừng là do stack đang tắt — `tools/_kiem-tra-phong.mjs` viết lại: tự tạo phiên test bằng HMAC chèn thẳng bảng `sessions` cả hai CSDL, không đụng mật khẩu, gọi qua đúng nginx 8099): **máy chủ trả đúng mọi phòng** (PH01: Phó GĐ Một + 2 lãnh đạo + defaults; PH02/PH04 có Phó GĐ nhưng KHÔNG có Trưởng/Phó phòng nào được cấu hình ⇒ leaders `[]` đúng dữ liệu; PH05 trông hoàn toàn). Lỗi thật nằm ở client, tái hiện bằng simulation jsdom fetch giả (`project-form-phan-cong.test.js`): (1) template form hardcode option «Công việc chung» TRÙNG với option do `buildDeptIdOptions` phát sinh ⇒ hiện 2 lần — đã bỏ hardcode, một nguồn duy nhất; (2) nhánh checkbox «Lãnh đạo phòng phụ trách» trong `napUngVienPhanCong` **bỏ qua `defaultLeaderId`** (chỉ nhánh select của nhiệm vụ áp) ⇒ không bao giờ tick sẵn Trưởng phòng — đã áp như supervisor: không có chọn gốc (đổi phòng) thì tick mặc định, khi SỬA giữ chọn gốc. Tự chọn Phó GĐ phụ trách theo phòng simulation xác nhận **chạy đúng** (PH01→Phó GĐ Một, PH03→Phó GĐ Hai); phòng không có Phó GĐ phụ trách (PH05) thì mặc định admin — đúng luật. Đổi tên `admin@test.local`: `full_name` + `position` = «Giám đốc» (UPDATE tay cả `quanlycongviec_uat` lẫn dev; phiên cũ đọc lại tên mỗi request nên chỉ cần refresh). **912 test / 54 file** xanh (thêm simulation 4 test); eslint + prettier sạch; bump `app.js ?v=20260826-65` | `web/assets/js/app.js` (template + `napUngVienPhanCong`), `web/index.html`, `server/eslint.config.js`, test mới `project-form-phan-cong.test.js`; tool `tools/_kiem-tra-phong.mjs` (viết lại), `tools/_bo-option-trung.mjs` (tạm); CSDL: UPDATE users admin | Phase 7 — đề nghị, quản lý app, chat, xuất Excel (§7 7.1–7.6) |
| 2026-08-26 | **Gia cố form phân công + dấu phiên bản app.js.** Người dùng vẫn báo form không tự chọn Phó GĐ/không chọn được lãnh đạo — nhưng kiểm chứng bằng HTTP thẳng vào nginx UAT xác nhận máy chủ đang phục vụ đúng bản mới (`app.js?v=20260826-65`, có fix, index.html `no-store`) và `assignment-options` trả đúng mọi phòng ⇒ nghi vấn chính: **trình duyệt chạy file cũ trong cache** hoặc người dùng test trên máy/VPS khác chưa cập nhật file. Gia cố: (1) **dấu phiên bản** `console.info("[QLCV] app.js 20260826-66")` đầu app.js — mở Console là biết trình duyệt đang chạy file nào; (2) `buildDeptIdOptions` **lọc bỏ dòng không có D_DB_ID** — không bao giờ sinh option rỗng nữa dù dữ liệu lệch hình dạng; (3) mở form TRƯỚC khi `getDepartmentContext` kịp trả thì context về là **vẽ lại ô Phòng** rồi nạp phân công (trước đây ô phòng trống vĩnh viễn đến khi đóng/mở lại modal); (4) bump `?v=20260826-66`. Simulation thêm test thứ 5 (context nạp trễ — stub `google.script.run`); pin XSS **77 → 78 chỗ ghi HTML** (1 chỗ `deptSel.innerHTML = buildDeptIdOptions(…)`, builder thoát đủ, giá trị giữ 550) + ghi `docs/XSS-4.6.md`. **913 test / 54 file** xanh; eslint + prettier sạch | `web/assets/js/app.js` (console.info + filter + `veLaiPhong`), `web/index.html`, `server/tests/unit/xss-guard.test.js`, `server/tests/unit/project-form-phan-cong.test.js` (+1 test), `docs/XSS-4.6.md` | Phase 7 — đề nghị, quản lý app, chat, xuất Excel (§7 7.1–7.6) |
| 2026-08-26 | **Chẩn đoán chốt: người dùng đang test trên bản triển khai KHÁC (VPS) — máy chủ cũ thiếu D_DB_ID.** Ảnh chụp mới: Console có `[QLCV] app.js 20260826-66` (client mới nhất) nhưng (a) dropdown Phòng trống sạch và (b) Ban lãnh đạo còn hiện «Quản trị Hệ thống» — tên cũ mà CSDL máy này đã đổi thành «Giám đốc» từ trưa (cả dev lẫn UAT, UPDATE 2 dòng xác nhận RETURNING) ⇒ trang không nói chuyện với CSDL máy này; filter D_DB_ID của client mới làm dropdown trống hẳn khi máy chủ cũ không gửi trường này (đúng thiết kế chống option rỗng). Client giờ **tự báo động**: `buildDeptIdOptions` `console.warn` «Bỏ x/y phòng vì máy chủ không gửi ID phòng…», `veLaiPhong` toast lỗi «Danh sách phòng trống: máy chủ đang chạy bản cũ…»; bump `?v=20260826-67`. Test thêm: máy chủ cũ không gửi D_DB_ID ⇒ dòng bị bỏ, không sinh option rỗng. **914 test / 54 file** xanh; eslint + prettier sạch. Việc còn lại là TRIỂN KHAI: đồng bộ `web/` + `server/src/` lên VPS, `migrate:up` (nếu chưa có 005), restart Node, UPDATE tên admin trên CSDL VPS | `web/assets/js/app.js`, `web/index.html`, `server/tests/unit/dept-select.test.js` (+1 test), tool `tools/_them-canh-bao-server-cu.mjs` (tạm) | Phase 7 — đề nghị, quản lý app, chat, xuất Excel (§7 7.1–7.6) |
| 2026-08-26 | **Sửa lỗi chặn trắng trang + kiểm chứng cuối vòng phân công.** `app.js` gãy cú pháp `Unexpected token ')'` dòng **1626** — khối `<div>` ô «Người thực hiện» trong `createTaskModal` bị script vá chèn escape sai quy ước (`style=\"\" + …` thay vì chuẩn `style=\"" + (laCapHai ? "" : "display:none") + "\">`) ⇒ chuỗi template không bao giờ đóng. Chẩn đoán bằng so sánh **byte-level với bản HEAD** (bản HEAD compile OK) thay vì đoán từng lớp JSON-escape; vá theo đúng pattern khối supervisor chuẩn (đảo nhánh ternary ẩn khi tạo công việc cấp 2) rồi bắt nốt `<divclass=` thiếu dấu cách ⇒ `node --check` OK. dom-contract bắt thêm 2 id có listener nhưng index.html chưa sinh element ⇒ bổ sung `<input type="month" id="projects-month-filter">` + nút `projects-month-clear` vào header Quản lý công việc (đủ chỗ cho lọc tháng `workMatchesMonth` vốn đã có logic). Pin XSS **550 → 551** giá trị nội suy / 78 chỗ ghi HTML, `docs/XSS-4.6.md` ghi mục cập nhật. Bump cache-buster `?v=` app.js `-67 → -68` (khớp banner console.info), project-details.js `-2 → -3`. **914 test / 54 file** xanh; unit riêng 410/23; lint + prettier sạch. Nhật ký đầy đủ cả cách chẩn đoán ở `docs/NHAT-KY-SUA-DONG-1626-PHAN-CONG.md`; `.gitignore` loại file tạm dò/vá `tools/_*` | `web/assets/js/app.js`, `web/index.html`, `server/tests/unit/xss-guard.test.js`, `docs/XSS-4.6.md`, `docs/NHAT-KY-SUA-DONG-1626-PHAN-CONG.md` (mới), `.gitignore` | Phase 7 — đề nghị, quản lý app, chat, xuất Excel (§7 7.1–7.6) |
| 2026-08-26 | **Vòng giao diện lần 3 — form nhiệm vụ + modal chi tiết (2 commit `86c3ade`, `9f054da`).** (1) Form nhiệm vụ: nhãn ô gán người «Người thực hiện» → **«Cán bộ trực tiếp»** (app.js ~1540, kèm 2 nhãn xem nhanh dòng 3869/3909); ứng viên lọc **CHỈ role «Nhân viên»** (ẩn Trưởng/Phó phòng/Phó GĐ/admin); option **chỉ họ tên, bỏ email** (xoá biến `text4`). Tên trường + luật server GIỮ NGUYÊN. (2) Modal chi tiết `project-details.js`: gộp phân công thành **MỘT hàng flex** `.phan-cong-hang` (dòng 156 cho CV con, 240 cho công việc) với 3 nhóm builder `buildPhanCongNhomHtml` (dòng 84) nhận văn bản thô tự escape 1 lần; tên công việc con vào **KHUNG riêng** `.cv-con-tieu-de` (dòng 123); **nút bút chì SVG inline** trên từng CV con theo quyền `coQuyenSuaCongViecCon` (dòng 71: admin ∪ Phó GĐ nằm trong `T_SUP` của CV con ∪ lãnh đạo phòng trong `T_LEADERS`), listener kiểm lại lúc bấm rồi `openEditModal("task")` (dòng 293–303). Pin XSS **551 → 550** giá trị (bỏ nội suy email), 78 chỗ giữ nguyên. Test jsdom mới chạy app.js thật: `task-form-candidate.test.js` (4) + `project-details-phan-cong.test.js` (8). Cache-buster app.js `-69`, project-details.js `-4`, banner `-69`. **926 test / 56 file** xanh (unit 422/25 + integration 504/31); lint + prettier sạch | `web/assets/js/app.js`, `web/assets/js/project-details.js`, `web/index.html`, `server/tests/unit/xss-guard.test.js`, `server/tests/unit/task-form-candidate.test.js` (mới), `server/tests/unit/project-details-phan-cong.test.js` (mới), `server/eslint.config.js` (thêm 2 file vào nhóm globals jsdom), `docs/XSS-4.6.md` | **Gantt xem theo THÁNG** — xem `docs/NHAT-KY-GANTT-THEO-THANG.md` |
| 2026-08-26 | **Sơ đồ Gantt chuyển sang XEM THEO THÁNG + tooltip thẻ cho tên dòng (commit `3604e34`, `ada4699`).** Server: cây `/api/v1/gantt` trả thêm `supervisorName`/`leaderNames` mọi mức + `output` nhiệm vụ (đổi id→tên 1 lượt qua `users/repo.listByIds`; chỉ mở thêm cột đã có của view sau migration 005, không đụng schema). Client: bỏ «1/2/3 tháng» và «từ–đến ngày», thay bằng **Tháng + Năm** (`datKhoangGanttTheoThang`: đầu→cuối tháng, nhuận đúng; server lọc giao nhau + thanh % cắt hai đầu sẵn có); ngày/thứ giãn full màn hình (bỏ khoá 2160px), thanh dày 26px; mũi tên thu gọn rời thành `.gantt-toggle-slot` ngoài khối icon+tên ⇒ cùng cấp thẳng cột (indent group/work/sub/task = 0/12/36/60px); icon CV con đổi thư mục ĐỎ giống cha; BỎ chữ cán bộ cạnh tên nhiệm vụ; thẻ tooltip tự vẽ (builder `buildGanttHoverCardHtml` escape trực tiếp, JSON qua `escapeHtmlAttr`) hiện đủ các chỉ tiêu theo cấp. Pin XSS **78/550 → 80 chỗ / 566 giá trị** (`tools/dem-xss.mjs`, TC-SEC-17 + docs/XSS-4.6.md). Test: `gantt-ui.test.js` viết lại giữ TC-STAT-13/14/15 + 8 test mới (20), `gantt-api.test.js` +1 (10). Banner `-70`, cache-buster `-70`. **938/938 test · 56 file** xanh; lint + prettier sạch | `server/src/modules/stats/repo.js`, `server/src/modules/gantt/service.js`, `web/assets/js/app.js`, `web/assets/css/app.css`, `web/index.html`, `server/tests/integration/gantt-api.test.js`, `server/tests/unit/gantt-ui.test.js`, `server/tests/unit/xss-guard.test.js`, `docs/XSS-4.6.md`, nhật ký `docs/NHAT-KY-GANTT-THEO-THANG.md` (mới) | Phase 7 — đề nghị, quản lý app, chat, xuất Excel (§7 7.1–7.6); việc TRIỂN KHAI lên VPS |
| 2026-08-27 | **Phase 7 xong trọn (nhánh `vps/phase-7-misc`, 5 commit `51ad21d` → `e3fe132`).** 7.1 đề nghị + 7.2 quản lý app + 7.3 chat (nạp lại 10 s) + 7.4 cron hằng tuần dọn tin > 90 ngày + 7.5 **xuất 3 mẫu Excel** (`exceljs@4.4.0`, ghim đúng bản theo §3.3) + 7.6 **xuất chỉ trong phạm vi được thấy**. Điểm cốt của 7.6: service xuất **không viết một câu SQL nào** — mẫu (a)/(b) gọi lại `works/tree.js getTree(user, filter)`, mẫu (c) gọi lại `stats/service.js`, và route xuất **không** kiểm quyền lần hai ⇒ chỉ có **một** cổng phạm vi cho cả danh sách lẫn xuất, không thể lệch nhau. Ngày trong file dựng bằng `Date.UTC(y,m-1,d,12,0,0)` để UTC+7 không lùi ngày, `numFmt='dd/mm/yyyy'`, đóng băng `ySplit:2`, thụt lề bằng `alignment.indent` (không dùng dấu cách đầu ô). Nối `addNotificationWithAuth` (chỉ admin; người nhận trống ⇒ fan-out mọi người đang hoạt động) ⇒ **cầu RPC 37/37 chạy thật**, xoá khuôn `pending()`. **1.085 test xanh / 64 file**, lint + prettier sạch. Chạy lại lượt khói §8.5 qua Nginx 8099 sau khi bật lại Node UAT: `65×200 · 5×400 · 4×401 · 1×403 · 5×404`, **hết 501**; bộ khói thêm helper `xlsx`/`dongxlsx` và 3 điểm mới — R11 (CRUD app thật), R12/R12b (3 file + so phạm vi: admin 67 dòng ↔ Nhân viên 44 dòng đúng 8 công việc phòng mình), R13 (`GET /api/rpc` = 37/37). | `server/src/modules/{proposals,apps,chat,export,notifications}/*` (mới), `src/rpc/table.js`, `src/app.js`, `src/config/env.js`, `src/services/cron.js`, `web/index.html`, `web/assets/js/app.js`, 5 file test mới + `rpc-bridge.test.js`, `tools/smoke-8.5.sh`, `docs/UAT.md`, `KE-HOACH-VPS.md` §3.3 + §5.2 + §13 | **Phase 8**: hạ tầng VPS thật (§11 mục 1–4) — compose production, HTTPS, sao lưu + thử phục hồi, soát bảo mật. Chưa có VPS thật nên chưa chạy được điểm nào của nhóm này |



| 2026-08-27 | **Gantt vòng 2 — vá «sửa không có tác dụng» + to hơn 1,5 lần.** Nguyên nhân gốc: `app.css` chưa từng có cache-buster (vẫn `?v=20260825`) ⇒ Nginx cache 30 ngày + trình duyệt kẹt CSS cũ trong khi app.js đã -70/-72 — toàn bộ override ngày giãn/thanh dày/tooltip-fixed chưa từng tới máy người dùng. Fix: bump `app.css?v=20260827-1` (**quy tắc mới: đổi file tĩnh nào bump file đó**) + `app.js?v=20260827-73` (banner -73); `.gantt-item` 48px / `.gantt-bar` 38px / ngày ≥34px số 16px; `overflow:hidden` cho timeline chống tràn; `formatDateForGantt` từ chối ngày «lăn» (30/02…) và nhãn thanh dựng `.filter(Boolean).join(" - ")` — hết «24/08 - 30/02»; test jsdom thêm 4 (bắn MouseEvent thật cho tooltip hiện/ẩn + ngày vô lý) ⇒ **1089/1089 test · 64 file** xanh; lint + prettier sạch; pin giữ 79/566. Nhật ký: `docs/NHAT-KY-GANTT-THEO-THANG.md` mục Vòng 2 | `web/assets/js/app.js`, `web/assets/css/app.css`, `web/index.html`, `server/tests/unit/gantt-ui.test.js`, `server/eslint.config.js` (thêm global MouseEvent), `docs/NHAT-KY-GANTT-THEO-THANG.md` | Phase 8 — hạ tầng (prompt dán sẵn BAT-DAU-SESSION mục 3); NHỚ deploy sync `web/` lên VPS thì user mới thấy |

| 2026-08-27 | **Gantt vòng 3 — MỌI cấp thẳng lề trái.** Sau vòng 2 người dùng chốt: công việc / CV con / nhiệm vụ KHÔNG được thụt lề lệch nhau (trước: work +12px, CV con +36px, nhiệm vụ +60px, nhóm `pl-4` +16px). Đã bỏ cả 4 nguồn thụt (3 style inline + `pl-4`) và thêm guard CSS `.gantt-item, .gantt-project-group > div[id^="gantt-"] { padding-left: 0 !important }`; phân cấp chỉ còn cột mũi tên ngoài + màu icon (nhóm tím / CV con đỏ / công việc theo trạng thái). Test `gantt-ui.test.js` +2 (4 loại hàng không mang thụt lề, thân nhóm giữ toggle-slot) ⇒ **1091/1091 test · 64 file** xanh; lint + prettier sạch; pin giữ 79/566; banner `-74`, buster `app.js -74` / `app.css 20260827-2` | `web/assets/js/app.js`, `web/assets/css/app.css`, `web/index.html`, `server/tests/unit/gantt-ui.test.js`, `docs/NHAT-KY-GANTT-THEO-THANG.md` (mục Vòng 3) | Phase 8 — hạ tầng; deploy sync `web/` lên VPS |

| 2026-08-27 | **Gantt vòng 4 — thanh đặt bằng Ô LƯỚI NGÀY, triệt tiêu lệch vị trí.** Ảnh chụp tiếp theo vẫn lệch (việc 24/08–20/12 vẽ ở ngày 16–22): bỏ hẳn định vị `left/width %` trên timeline, chuyển header ngày LẪN timeline mọi hàng sang **CÙNG MỘT lưới** `repeat(var(--gantt-so-ngay), minmax(0,1fr))` (số ngày do `renderGanttChart` đặt lên `#gantt-container`), thanh tính `grid-column: <ngày-đầu> / span <số ngày>` kẹp biên [1,N] ⇒ lệch ô là không thể. Fix kèm bẫy múi giờ: 'yyyy-mm-dd' parse 00:00 UTC = 07:00 ICT ⇒ việc rơi đúng **ngày cuối tháng** từng bị coi là ngoài khoảng — giờ so/kẹp theo số thứ tự ngày 0-based. Ghi chú ngoài-khoảng `grid-column: 1/-1`, `.gantt-bar` `position:relative` cho fill tiến độ. Test `gantt-ui` 30 (TC-STAT-13 theo grid-column + dóng biên từng ngày 1…31 + header đủ ô đúng thứ tự, nhuận 29) ⇒ **1095/1095 test · 64 file** xanh; lint + prettier sạch; pin giữ 79/566; banner `-75`, buster `app.js -75` / `app.css 20260827-3` | `web/assets/js/app.js`, `web/assets/css/app.css`, `web/index.html`, `server/tests/unit/gantt-ui.test.js`, `docs/NHAT-KY-GANTT-THEO-THANG.md` (mục Vòng 4) | Phase 8 — hạ tầng; deploy sync `web/` lên VPS |
| 2026-08-27 | **Ba việc người dùng đặt thêm trên nhánh `vps/quan-ly-nhiem-vu-pgd` (5 commit `1769ad5` → `a11a4a9`).** (1) **Tab «Quản lý Nhiệm vụ»** (`1769ad5`): bộ lọc Tháng/Năm/Cán bộ/Phòng + gom nhiệm vụ thành **khối theo công việc con** (nhiệm vụ thuộc cha vào khối «(thuộc công việc)»), lọc tháng dùng lại luật **giao nhau** của Gantt nên số liệu không lệch hai chỗ; `dom-contract.test.js` mở rộng cho các id mới; `tasks-nhiem-vu-ui.test.js` (jsdom, chạy app.js thật). (2) **Phó Giám đốc** (`5e972d3`): thêm vai này vào tab «Quản lý công việc» phía nav + helper client `laQuanTriTrongPhamVi()` mở nút thêm/sửa **chỉ trong phòng mình phụ trách**; phía máy chủ **không nới một dòng nào** — `inScope()` đã bó theo `managedDepartmentIds` (`department_managers.role='deputy_director'`), TC-RBAC-11..14 canh đúng chỗ đó (`rbac-scope.test.js` +89 dòng) để client không bao giờ rộng hơn server. (3) **ỦY QUYỀN CÓ THỜI HẠN** — kế hoạch `docs/KE-HOACH-UY-QUYEN.md` (`f079d01`, kèm §13.4 mục **17–20** chờ trả lời), máy chủ (`6d6e2c0`), giao diện (`a11a4a9`): migration `006_delegations.sql` (`EXCLUDE USING gist` + `btree_gist` trên `daterange(from,to,'[]')` ⇒ **CSDL** chặn trùng khoảng của cùng cặp người, 4 ràng buộc có tên `delegation_{not_self,dates_ok,status_ok,no_overlap}`); **lớp 3 của `can()`**: `attachSession` nạp `req.user.delegations`, `can()` thử quyền mượn khi hôm nay ∈ [from,to] và trả `viaDelegationId`, phạm vi mượn qua `inScopeMuon()` (Quản lý công việc phải khớp cả phòng **và** vai quản lý/được giao); `audit.js` chép `viaDelegationId` vào `activity_logs.details` ⇒ **mọi hành động mượn quyền đều có dấu vết**; REST `/api/v1/delegations` CRUD, huỷ là **huỷ mềm** (`status='cancelled'`, gọi lần hai trả `cancelled:false`), không ủy quyền vai admin, không ủy quyền rộng hơn quyền mình (`DELEGATION_SCOPE_TOO_WIDE`). Mọi so ngày dùng **`current_date` của CSDL**, không `new Date()` của Node (§13.5 bẫy múi giờ). Giao diện: modal «Ủy quyền của tôi» hai bảng, chia hai chiều theo **`currentUser.id`** (không theo họ tên — trùng tên sẽ hiện nút «Huỷ» của người khác), nhãn «đang được ủy quyền» + tooltip «đang dùng quyền của \<ai\> đến \<ngày\>»; ghi qua helper mới **`restGhi`** (tự lấy cookie đuôi `_csrf` + header `X-CSRF-Token`, fallback `GET /api/csrf`) — **không** thêm tên RPC thứ 38, cầu vẫn **37/37**; client **không tự chế phạm vi** (không có ô chọn phòng, máy chủ suy từ `department_managers`, lỗi hiện nguyên văn). Test mới: `delegation-can.test.js` (đơn vị, `can()` vẫn thuần), `delegations-api.test.js` (**20** — lần đầu chạy migration 006 trên Postgres thật), `uy-quyen-ui.test.js` (**16**, TC-UQ-15). **1.185 test / 69 file** xanh; lint + prettier sạch; `node --check app.js` OK; pin XSS **79/566 → 83/588** (sink `""` 7 → 8 vì `showUyQuyenError("")`), `docs/XSS-4.6.md` ghi trong **cùng commit**; banner + buster `app.js 20260827-78` (CSS không đổi nên giữ nguyên) | `server/src/db/migrations/006_delegations.sql`, `server/src/modules/delegations/{repo,service,routes}.js`, `server/src/middleware/{rbac,session,audit}.js`, `server/src/utils/{errors,pgError}.js`, `server/src/app.js`, `web/assets/js/app.js`, `web/index.html`, `server/tests/unit/{delegation-can,tasks-nhiem-vu-ui,pho-giam-doc-ui,uy-quyen-ui,rbac-scope,dom-contract,xss-guard}.test.js`, `server/tests/integration/delegations-api.test.js`, `server/tests/helpers/db.js`, `server/eslint.config.js`, `docs/{KE-HOACH-UY-QUYEN,XSS-4.6}.md` | Trả lời §13.4 **mục 17–20** (ai được ủy quyền · có ép cùng phòng · giới hạn số người ủy quyền cùng lúc · có thông báo trong ứng dụng) rồi siết theo. Sau đó **Phase 8** — hạ tầng VPS thật; NHỚ deploy sync `web/` + `server/src/` và `migrate:up` (006) lên VPS |
| 2026-08-28 | **Bốn việc giao diện người dùng đặt thêm (nhánh `vps/quan-ly-nhiem-vu-pgd`, commit `5e3a595`).** (A) Bộ lọc tab «Quản lý nhiệm vụ» dồn về **một dòng** — `.thanh-loc` là CSS thường ở `app.css` vì bản tailwind dựng sẵn **không có** `flex-nowrap`/`space-y-4`/`w-32` (bẫy §13.5: lớp tailwind không có trong bản subset thì không có tác dụng gì, phải kiểm bằng `grep` trước khi dùng). (B) Nút «Ủy quyền của tôi» **404 → hết 404**: nguyên nhân là `restGet` im lặng khi máy chủ trả 404 nên người dùng thấy modal rỗng; thêm câu lỗi rõ ràng cho 404 vào `restGet`. (C) Đầu tab «Quản lý công việc» đổi `<input type="month">` sang **hai ô chọn Tháng + Năm** giống Sơ đồ Gantt (`dongBoOThangNamProjects`) + thêm ô lọc **Phòng**; lọc tháng vẫn dùng luật **giao nhau** của Gantt để hai chỗ không lệch số. (D) Trang mới **«Quản lý tài khoản»**: khung thông tin dựng bằng `buildTaiKhoanDong(nhãn, giá trị)` + form đổi mật khẩu **markup tĩnh** trong `index.html` (không dựng HTML từ mật khẩu; câu lỗi/xác nhận đặt bằng `textContent`), gọi `changePassword` sẵn có. Test jsdom mới `tai-khoan-ui.test.js` (bơm `<img src=x onerror=alert(1)>` vào tên + `"><script>` vào email, khẳng định `password`/`password_hash` không lọt ra HTML) + `dom-contract` mở rộng; pin XSS **83/588 → 86/590**; banner + buster `app.js 20260828-79` · `app.css 20260828-5` | `web/assets/js/app.js`, `web/assets/css/app.css`, `web/index.html`, `server/tests/unit/{tai-khoan-ui,dom-contract,xss-guard}.test.js`, `server/eslint.config.js`, `docs/XSS-4.6.md` | Việc E — siết ủy quyền theo §13.4 mục 17/18/20 |
| 2026-08-28 | **Việc E — thứ bậc + cùng phòng + PHÊ DUYỆT ủy quyền (§13.4 mục 17/18/20 đã trả lời; commit `099fbee`).** Bốn luật mới, mỗi luật có chỗ chặn riêng: **R1** bỏ danh sách `VAI_DUOC_UY_QUYEN` — mọi cán bộ ủy quyền được; **R2** `BAC_VAI` (admin 1 · Phó GĐ 2 · Trưởng phòng 3 · Phó phòng 4 · Quản lý công việc = Nhân viên 5) ⇒ `DELEGATION_RANK_UP` khi ủy quyền LÊN, vai lạ ⇒ 403; **R3** bắt cùng `department_id` trừ ba cặp ngoại lệ `admin→Phó GĐ`, `Phó GĐ→Phó GĐ`, `Phó GĐ→Trưởng phòng` ⇒ `DELEGATION_DIFFERENT_DEPARTMENT`; **R4** `007_delegations_approval.sql` đổi `status` DEFAULT thành **`'pending'`**, thêm `accepted_at`/`declined_at` + trạng thái `declined`, và **nới vị từ EXCLUDE + chỉ mục sang `('pending','active')`** để hai đề nghị trùng ngày đổ ở lúc TẠO (lỗi của người ủy quyền) chứ không đổ lúc người nhận bấm «Đồng ý». Bản `pending` **không cho mượn gì** (`listEffectiveFor` chỉ đọc `active`) — đó chính là nội dung của "phê duyệt"; `POST /:id/accept` · `/:id/decline` chỉ **người được ủy quyền** gọi được (**admin cũng không**, vì nếu admin đồng ý hộ được thì luật thành hình thức), bấm lần hai trả `changed:false` và **không** sinh thông báo thứ hai; mỗi lần tạo/trả lời ghi một dòng `notifications` (`ref_type='delegation'`, `try/catch` im lặng — mất một dòng thông báo không được đánh sập hành động chính). Chỗ khó nhất là hoà giải mục 18 («Giám đốc ủy quyền được cho Phó Giám đốc») với luật cũ **không cho mượn quyền toàn cục**: bản ghi từ admin **bắt buộc liệt kê phòng** (`DELEGATION_ADMIN_SCOPE_REQUIRED`) và `hieuLucCho()` **hạ vai `admin` xuống `Phó Giám đốc`** trong đúng các phòng đó, bỏ hẳn bản admin phạm vi rỗng; `middleware/rbac.js` **không sửa một dòng** (vẫn bỏ qua `fromRole==='admin'`) nên ai xoá phép hạ vai này sẽ **mất** quyền mượn chứ không nới quyền — hướng an toàn. Giao diện: `buildUyQuyenNut(...)` gom ba nút, 5 nhãn trạng thái (Chờ phê duyệt / Đang hiệu lực / Đã từ chối / Đã huỷ / Chưa-hết hiệu lực), người GIAO thấy «Rút lại» khi còn `pending`, người NHẬN thấy «Đồng ý» + «Từ chối»; vẫn **không** thêm tên RPC (cầu **37/37**), ghi qua `restGhi`. Test: `uy-quyen-ui.test.js` **22** (TC-UQ-16), `delegations-api.test.js` **20 → 33** (TC-UQ-01c/01d lược đồ 007, 04c pending chặn chồng lấp / declined thì không, 05..05e cho R1–R3, 16..16g cho phê duyệt, **17** = người nhận ủy quyền từ Giám đốc làm được việc ở phòng B nhưng **không** phòng A và **không** quản trị người dùng) ⇒ **1.235 test / 71 file** xanh; lint + prettier sạch; `node --check app.js` OK; pin XSS **86/590 → 86/597** (+7 vì `dem-xss` coi mỗi lời gọi `build*` là một lỗ nội suy: 3 lời gọi + 6 chỗ thoát trong hàm − 2 chỗ cũ), `docs/XSS-4.6.md` ghi trong **cùng commit**; banner + buster `app.js 20260828-80` (CSS không đổi nên giữ `20260828-5`) | `server/src/db/migrations/007_delegations_approval.sql` (mới), `server/src/modules/delegations/{repo,service,routes}.js`, `server/src/utils/errors.js`, `web/assets/js/app.js`, `web/index.html`, `server/tests/unit/{uy-quyen-ui,xss-guard}.test.js`, `server/tests/integration/delegations-api.test.js`, `docs/{XSS-4.6,KE-HOACH-UY-QUYEN}.md`, `KE-HOACH-VPS.md` §13.3 + §13.4 | §13.4 **mục 19** vẫn treo (không giới hạn số người ủy quyền cùng lúc) và **mục 16** (đường ĐỌC thông báo + chuông) — nay đáng làm hơn vì đề nghị ủy quyền đã sinh thông báo thật. Nhắc "sắp hết hạn ủy quyền" chưa làm. Sau đó **Phase 8** — hạ tầng VPS thật; NHỚ `migrate:up` (007) + deploy sync `web/` khi lên VPS |
| 2026-08-28 | **Ô chọn phòng cho Giám đốc trong form ủy quyền (commit `3dc480b`).** Vá lỗ cuối của Việc E: mục 18 cho phép «giám đốc ủy quyền cho phó giám đốc», nhưng máy chủ **buộc** bản ghi từ Giám đốc phải liệt kê phòng (`DELEGATION_ADMIN_SCOPE_REQUIRED` — vì admin không có dòng `department_managers` nào để suy phạm vi), mà form lại không có ô nào chọn phòng ⇒ **từ trình duyệt Giám đốc không tạo nổi một bản ủy quyền**, chỉ tạo được bằng REST. Thêm `buildUyQuyenPhamVi()`: `select[name="departmentIds"] multiple required` chỉ dựng khi `currentUser.role === "admin"`, option lấy toàn bộ `allDepartments` (Giám đốc phụ trách mọi phòng, máy chủ vẫn kiểm lại từng id bằng `DELEGATION_SCOPE_TOO_WIDE`), phòng nào thiếu `D_DB_ID` thì **bỏ hẳn** thay vì sinh `value=""` (bẫy COL lần 2). `taoUyQuyen()` đọc bằng `FormData.getAll("departmentIds")` → mảng SỐ, và chặn sớm ĐÚNG bằng câu của máy chủ khi chưa chọn phòng (đỡ một vòng gọi, không nới rộng luật). Vai khác **cố ý** không có ô này. Pin XSS 86/597 → **86/602** (+5: 1 lời gọi builder + 1 `size` + 1 lỗ `list.map` + 2 chỗ thoát id/tên), banner `app.js 20260828-81` + `?v=` index.html. Test mới TC-UQ-18 / TC-UQ-18b (jsdom, 6 test) ⇒ **71 file / 1242 test** xanh, lint + `format:check` sạch. | `web/assets/js/app.js`, `web/index.html`, `server/tests/unit/uy-quyen-ui.test.js`, `server/tests/unit/xss-guard.test.js`, `docs/XSS-4.6.md`, `docs/KE-HOACH-UY-QUYEN.md` (§9 hết «chưa làm», §11 + §12 bước 8), `KE-HOACH-VPS.md` | Test tay §10 + §12 của `docs/KE-HOACH-UY-QUYEN.md` trên UAT (phải `migrate:up` cho 007 trước); §13.4 mục 19 vẫn treo; mục 16 (chuông thông báo + nhắc sắp hết hạn ủy quyền) chưa làm |
| 2026-08-28 | **Kiểm chứng luồng phê duyệt ủy quyền bằng REST + `migrate:up` 007 cho CSDL khói.** Đưa 007 lên `quanlycongviec_uat` (đã xác nhận có `status`/`accepted_at`/`declined_at` và dòng `pgmigrations`) — đây là điều kiện tiên quyết ghi ở §12. Chạy tay 8 bước của §12 qua REST trên một **CSDL nháp riêng** (`qlcv_tam_uq`, đã migrate + seed, server tạm cổng 3098) để **không** đụng bộ mẫu UAT: GĐ tạo thiếu phòng ⇒ `400 DELEGATION_ADMIN_SCOPE_REQUIRED`; có `departmentIds:[1]` ⇒ `201` `pending`; **GĐ tự `accept` bản của mình ⇒ `403`**; PGĐ `accept` ⇒ `200` `active`; `accept` lần hai ⇒ `changed:false`; PGĐ đọc thấy `dang_hieu_luc=true` phạm vi `[1]`; PGĐ `POST /api/v1/users` ⇒ `403` (quyền mượn không chạm L4); `DELETE /delegations/:id` ⇒ `200`. Sau đó **xoá CSDL nháp, tắt hai server tạm 3098/3099, xoá hai script `tools/_tam-uat-uq*.mjs`**. Ghi kết quả thành khối «Đã kiểm chứng bằng REST» trong §12 — phần **mắt người** (nhãn màu, hai nút Đồng ý/Từ chối, ô chọn phòng chỉ hiện với Giám đốc) vẫn phải chạy trên trình duyệt. Không sửa mã nguồn: vẫn **71 file / 1242 test** xanh, pin XSS 86/602, banner `app.js 20260828-81`. | `docs/KE-HOACH-UY-QUYEN.md` (§12), `docs/BAT-DAU-SESSION.md` (§1), `KE-HOACH-VPS.md` | Test tay §10 + §12 trên trình duyệt (UAT đã có 007, chỉ cần khởi động lại Node + `Ctrl+Shift+R`); §13.4 mục 19 vẫn treo; mục 16 (chuông thông báo + nhắc sắp hết hạn) chưa làm |

| 2026-08-28 | **Ô «Email người nhận» của form ủy quyền đổi thành Ô CHỌN NGƯỜI (commit `2c7412c`).** Yêu cầu nguyên văn: «Sửa cái ủy quyền mới: Email người nhận, cái này là sẽ chọn người, danh sách hiện ra sẽ đúng theo luồng đã nói». Bỏ `input[name="to"] list="uy-quyen-staff-list"` (gõ tay ⇒ chỉ biết sai sau khi bấm gửi và đọc `DELEGATION_RANK_UP` / `DELEGATION_DIFFERENT_DEPARTMENT`), thay bằng `buildUyQuyenNguoiNhan()` dựng `select[name="to"] required`. Danh sách ứng viên `dsNguoiNhanUyQuyen()` là **bản sao đọc-only** của `assertBacVaPhong`: hai hằng `UQ_BAC_VAI` / `UQ_KHAC_PHONG` sao nguyên văn `BAC_VAI` / `NGOAI_LE_KHAC_PHONG` của `delegations/service.js`, loại **chính mình** (so bằng email, không so tên), **Nhà cung cấp**, dòng thiếu email và **vai lạ** (không biết bậc thì không đoán). Chỗ dễ sai nhất là so PHÒNG: `staffToLegacy` chỉ trả `COL.S_DEPT` là **TÊN** phòng (không có cột id phòng trong danh sách cán bộ) nên `tenPhongCuaToi()` phải đổi `currentUser.department_id` sang tên qua `allDepartments` trước khi so — tra không ra thì danh sách **rỗng** chứ không mở ra cả cơ quan. Lọc luôn **hẹp hơn hoặc bằng** máy chủ: giao diện không có cột `is_active` nên người bị vô hiệu hoá vẫn có thể lọt vào ô chọn và **máy chủ mới là chỗ chặn** — không hạ một chốt nào phía máy chủ. Không còn ai hợp lệ ⇒ ô `disabled` + câu nói rõ lý do, thay vì mời bấm gửi để nhận 400. Giá trị option vẫn là EMAIL nên `taoUyQuyen()` gửi khoá `toUserId` y như cũ (`timNguoi` dò email); câu chặn sớm đổi thành «Cần chọn người nhận và đủ hai mốc ngày.». Test mới TC-UQ-19 (11 ca luật: từng vai, ba cặp ngoại lệ khác phòng, xếp theo bậc rồi tên, phòng tra không ra ⇒ rỗng) + TC-UQ-19b (4 ca HTML: còn `select` không còn `input`/datalist, option email chữ thường + nhãn «tên — vai · phòng», nhánh rỗng, XSS tên người) và TC-UQ-18b nay chọn qua ô chọn thật ⇒ `uy-quyen-ui.test.js` 28 → **42**, tổng **1.255 test / 71 file** xanh; lint + `format:check` sạch; `node --check app.js` OK. Pin XSS 86/602 → **86/606** (+4: −1 lời gọi `buildStaffEmailDatalist`, +1 lời gọi builder mới, +2 chỗ thoát nhánh rỗng, +2 chỗ thoát mỗi option), `docs/XSS-4.6.md` ghi trong **cùng commit**; banner + buster `app.js 20260828-82` (CSS không đổi nên giữ `20260828-5`) | `web/assets/js/app.js`, `web/index.html`, `server/tests/unit/{uy-quyen-ui,xss-guard}.test.js`, `docs/XSS-4.6.md`, `docs/KE-HOACH-UY-QUYEN.md` (§10 bước 1/2/4/5, §11 bảng «tôi là / ô chọn hiện ai» + hai dòng test), `KE-HOACH-VPS.md` | Test tay §10 + §12 của `docs/KE-HOACH-UY-QUYEN.md` trên trình duyệt UAT (007 đã lên, chỉ cần Node trỏ `quanlycongviec_uat` + `Ctrl+Shift+R`, banner phải là `20260828-82`); §13.4 **mục 19** vẫn treo; **mục 16** (chuông thông báo + nhắc sắp hết hạn ủy quyền) chưa làm |

| 2026-08-28 | **Sửa lỗi ô chọn người nhận RỖNG với dữ liệu thật — bẫy cột «Đối tượng».** Người dùng báo: form ủy quyền hiện câu «Không có ai bạn ủy quyền được…» trong khi danh sách người dùng có đủ *Phó GĐ Một* và *Phó GĐ Hai*. Nguyên nhân: `dsNguoiNhanUyQuyen()` mở đầu bằng `(staff[COL.S_OBJECT_TYPE] \|\| "Người dùng") !== "Người dùng"` ⇒ loại **mọi người thật**, vì CSDL (cả `dev.sql` lẫn dữ liệu đang dùng) ghi cột `object_type` là **`'Nội bộ'`**; chữ `'Người dùng'` chỉ xuất hiện với người tạo qua giao diện (`objectTypeOf` của `users/service.js` mặc định thế). Bộ test cũ xanh vì khuôn `nguoi()` tự đặt `'Đối tượng': 'Người dùng'` — **khuôn test sai theo cùng một cách với mã**, nên đổi mặc định của khuôn sang `'Nội bộ'` (11 ca TC-UQ-19 nay chạy trên hình dữ liệu thật) và thêm ca canh cả **ba** chữ ('Nội bộ' / 'Người dùng' / trống ⇒ hiện; 'Nhà cung cấp' ⇒ không). Luật đúng là **chỉ loại `'Nhà cung cấp'`** — đúng như dòng 1293 của `app.js` đã ghi chú từ trước. `buildStaffEmailDatalist()` (gợi ý email Phó GĐ/Trưởng phòng/Phó phòng trong modal Phòng) mang **y hệt** một dòng lỗi đó ⇒ sửa luôn trong cùng commit, thêm 2 test jsdom vào `dept-select.test.js`. Không nới một chốt nào phía máy chủ (máy chủ không lọc `object_type`). **1.255 → 1.258 test / 71 file** xanh; lint + `format:check` sạch; `node --check` OK; pin XSS **không đổi** (86/606 — chỉ sửa điều kiện lọc, không thêm chỗ nội suy) nên `docs/XSS-4.6.md` giữ nguyên; banner + buster `app.js 20260828-83` | `web/assets/js/app.js`, `web/index.html`, `server/tests/unit/{uy-quyen-ui,dept-select}.test.js`, `docs/KE-HOACH-UY-QUYEN.md` (§10 bước 1, §11 tiêu đề + dòng TC-UQ-19, §12 bước 1), `KE-HOACH-VPS.md` | Test tay lại §10 bước 4–5 trên UAT với banner `20260828-83`: mở form ủy quyền bằng từng vai, ô chọn phải liệt kê đúng người; §13.4 **mục 19** và **mục 16** vẫn treo |

| 2026-08-28 | **Phó Giám đốc mở tab «Quản lý Nhiệm vụ» thấy TRẮNG — nay thấy hết nhiệm vụ của CÁC phòng mình phụ trách (commit `af1b92e`).** Yêu cầu nguyên văn: «Phó Giám đốc hiện tại trong phần nhiệm vụ không nhìn thấy gì, sửa lại. phó giám đốc phụ trách phòng nào thì nhìn thấy hết nhiệm vụ phòng đấy. Lưu ý phó giám đốc có thể phụ trách nhiều phòng». Nguyên nhân **chỉ ở trình duyệt**: `renderTasks()` lọc `allTasks` bằng đúng hai điều kiện — `T_ASSIGNEE === currentUser.name` hoặc công việc cha có `P_MANAGER === currentUser.name` — mà Phó Giám đốc thường **không** được giao nhiệm vụ nào và cũng **không** đứng tên quản lý công việc ⇒ danh sách rỗng ⇒ hộp «Chưa có nhiệm vụ nào»; tệ hơn, hàm còn tính `getUserAllowedProjects()` (đã có nhánh phòng phụ trách từ 2026-08-27) rồi **bỏ không dùng** — biến chết. Kiểm TRƯỚC khi sửa: máy chủ đã gửi đủ (`bootstrap/service.js` `cayChoUser` lọc qua `can()` + `inScope()` bó theo `managedDepartmentIds`, `department_managers` cho **nhiều** dòng `deputy_director`) và `visibleDepartments` đã là TÊN các phòng phụ trách ⇒ vá phía trình duyệt là đủ và **không rộng hơn máy chủ**. Thêm hai hàm ngay trước `renderTasks()`: `dsPhongToiPhuTrach()` (chỉ trả tên phòng khi `laQuanTriTrongPhamVi()` và **không** phải admin — vai khác hoặc chưa nạp ngữ cảnh ⇒ mảng **rỗng**, thà hẹp còn hơn tự nới) và `dsNhiemVuToiDuocThay()` (admin thấy tất cả; còn lại giữ nguyên hai đường cũ rồi **thêm đúng một nhánh**: phòng của công việc cha nằm trong danh sách phụ trách). Nhiệm vụ không có cột phòng riêng nên phòng lấy từ `COL.P_DEPT` của công việc cấp 1 — **cùng cách** với `taskMatchesDeptFilter` để hai chỗ không lệch. **Công việc chung (không phòng) vẫn ẩn** vì `inScope()` cũng không cho. Test mới TC-TASKUI-14..18 trong `tasks-nhiem-vu-ui.test.js` (13 → **18**; shim `__tasks` thêm `phongPhuTrach`/`laPgd`): phụ trách hai phòng thấy cả hai kể cả việc giao người khác · phòng thứ ba vẫn ẩn · công việc chung ẩn trừ khi chính mình được giao · `visibleDepartments` rỗng **không** nới · Trưởng phòng có `visibleDepartments` nhưng **không** được nới · admin thấy tất cả · vẽ thật vào `#tasks-grid` không còn câu «Chưa có nhiệm vụ nào». **1.258 → 1.263 test / 71 file** xanh; lint + `format:check` sạch; `node --check app.js` OK; pin XSS **không đổi** (86/606 — chỉ thêm hàm lọc, không thêm chỗ nội suy HTML) nên `docs/XSS-4.6.md` giữ nguyên; banner + buster `app.js 20260828-84` (CSS không đổi) | `web/assets/js/app.js`, `web/index.html`, `server/tests/unit/tasks-nhiem-vu-ui.test.js`, `KE-HOACH-VPS.md`, `docs/BAT-DAU-SESSION.md` | Test tay trên UAT với banner `20260828-84`: đăng nhập *PGĐ Một* (phụ trách PH01+PH02) mở tab «Quản lý Nhiệm vụ» phải thấy nhiệm vụ của cả hai phòng, ô lọc Phòng chỉ liệt kê hai phòng đó; §13.4 **mục 19** và **mục 16** vẫn treo |
| 2026-08-28 | **NHẬT KÝ TỪNG LẦN CHỈNH SỬA, hiện ở tab «Nhật ký» của cả 3 cấp; công việc cha thấy hết của con và cháu.** Soát trước khi viết mã cho thấy **không cần bảng mới, không cần migration**: chuỗi ghi nhật ký (route đặt `res.locals.audit` → `middleware/audit.js` chạy lúc `res.on('finish')` → `activityLogs/repo.writeLog`) đã có sẵn ở cả ba cấp, `diffRows` đã ghi `cột: từ → thành`, và mỗi dòng của cấp 2/3 đã mang `work_id`. Thiếu ba thứ, vá đúng ba thứ: (a) **gom cả cây** — `listForWorkTree` lọc `work_id = $1 OR (entity_type='work' AND entity_id=$1)`; gom theo **`work_id`** chứ không theo danh sách id con còn sống, chính vì thế dòng của **con đã bị xoá vẫn còn** trong nhật ký cha, còn nhánh `entity_type='work'` vớt các dòng cũ chưa có `work_id`; cấp 2 dùng `listByEntities` (nó + các cấp 3 của nó). (b) **`?scope=self|tree`**, mặc định **`self`** nên hợp đồng API cũ **không đổi** (TC-NKCAY-04 ghim đúng điều này); quyền **không** nới theo cây vì migration 002 buộc con luôn cùng phòng công việc cha, `assertCan(read)` ở gốc là đủ. (c) **lỗ hổng thật**: `DELETE /work-items/:id` ghi audit bằng `entityType: 'task'` cứng và **không** có `entityId`/`workId`⇒ mọi lần xoá **mất dấu**, không dòng nào chảy vào nhật ký cha; nay `service.remove()` trả thêm `deletedId/deletedLevel/deletedWorkId/deletedName` (đọc **trước** khi xoá vì sau đó không đọc lại được) và route ghi đủ. Làm giàu ở **máy chủ** bằng `utils/historyRefs.attachRefs` (khoá `Map` là `` `${kind}:${id}` `` vì `works.id=5` khác `work_items.id=5`; mất bản ghi thì lùi về `details.code`/`details.name` + `deleted:true`) nên trình duyệt **không** phải gọi thêm cây, và dòng của mục đã xoá vẫn có mã + tên. Giao diện: 3 bảng nhãn (20 hành động → nhãn/icon/màu · tên cột DB → tiếng Việt · cấp 1/2/3) + `renderNhatKy` đảo thứ tự thành **mới nhất trước**, `napNhatKy` tải **một lần** nhờ `khung.dataset.daNap`, thanh tab «Thông tin | Nhật ký» chỉ hiện **khi chỉnh sửa**. Hai bẫy vấp thật: jsdom **không** gọi được hàm trong `onclick` (app.js chạy trong `new Function`) ⇒ phép kiểm so **chuỗi thuộc tính** rồi gọi qua `window`; và **TC-SEC-18 đòi lời gọi thoát ĐẶT NGAY tại chỗ nội suy** ⇒ `const ten = escapeForInlineHandler(kieu)` bị đánh trượt, phải viết thẳng vào cả hai lỗ `onclick`. **1.287 test / 74 file** xanh (TC-NKREF-01..06 · TC-NKCAY-01..08 · TC-NKUI-01..10); lint + prettier sạch; `node --check app.js` OK; pin XSS **86/606 → 89/632** ghi trong **cùng commit**; banner + buster `app.js 20260828-85` (CSS không đổi). Giới hạn đã ghi rõ trong kế hoạch: **cháu bị xoá cùng cha cấp 2** chỉ tra lại được ở nhật ký **cấp 1** (qua `work_id`), vì cấp 2 gom theo id còn sống | `docs/KE-HOACH-NHAT-KY.md` (mới), `server/src/utils/historyRefs.js` (mới), `server/src/modules/activityLogs/repo.js`, `server/src/modules/{works,workItems}/{service,routes}.js`, `web/assets/js/app.js`, `web/index.html`, `server/tests/unit/{nhat-ky-refs,nhat-ky-ui,xss-guard}.test.js`, `server/tests/integration/nhat-ky-ca-cay.test.js`, `server/eslint.config.js`, `docs/XSS-4.6.md`, `KE-HOACH-VPS.md` §13.2 + §13.3 | **Test tay** với banner `20260828-85`: mở modal sửa công việc → tab «Nhật ký» phải thấy đủ 3 cấp; mở công việc con và nhiệm vụ cũng vậy. Vẫn treo: §13.4 **mục 19** (không giới hạn số người ủy quyền cùng lúc) và **mục 16** (chuông đọc thông báo + nhắc "sắp hết hạn"), soát mắt §10 + §12 của `docs/KE-HOACH-UY-QUYEN.md`, test tay tab nhiệm vụ của PGĐ (banner `20260828-84`). Sau đó **Phase 8** — hạ tầng VPS thật |

### 13.4 Quyết định đang chờ người dùng — KHÔNG TỰ ĐOÁN

| # | Câu hỏi | Chặn | Trạng thái |
|---|---|---|---|
| 1 | Một người có thể thuộc **nhiều phòng** không? Đang thiết kế một người một phòng (`users.department_id`) | Phase 0 (lược đồ CSDL) | ✅ **đã trả lời 2026-08-24: một người thuộc MỘT phòng** → giữ `users.department_id`. Việc phụ trách nhiều phòng (Phó GĐ / Trưởng phòng) đi qua bảng riêng `department_managers`, không đụng vào `department_id` |
| 2 | Thông số VPS, tên miền, quyền SSH, nội bộ hay Internet (§11 mục 1–4) | Phase 8 | ✅ **đã trả lời 2026-08-24**: giai đoạn này **chạy hẳn trên PC của người dùng** (Windows + Docker Desktop), test xong mới đưa lên VPS. Phase 1–7 làm bình thường; **Phase 8 tạm hoãn** cho tới khi có VPS thật. Hệ quả: `SESSION_COOKIE_SECURE=false` và `APP_BASE_URL=http://localhost:3000` khi chạy local — lên VPS phải đổi cả hai |
| 3 | Danh sách Phó Giám đốc / Trưởng phòng / Phó phòng thật (§11 mục 5–6) | Phase 5, 9 | ✅ **đã trả lời 2026-08-24**: dùng **danh sách test tự tạo**, người dùng sửa sau. Chốt ở §13.7 — Phase 1 đưa vào `src/db/seeds/dev.sql`. Bắt buộc: seed chỉ chạy khi `NODE_ENV <> 'production'` |
| 4 | Có SMTP gửi email không (§11 mục 9) | Phase 5 | ✅ **đã trả lời 2026-08-24: KHÔNG gửi email**. `MAIL_ENABLED=false`, **không** cài `nodemailer`, không viết `services/mailer.js`. Thông báo (nhóm J, K8) chỉ nằm trong bảng `notifications` + badge trên giao diện. Nếu sau này cần email thì thêm sau, phần trong ứng dụng không phải sửa |
| 5 | Snapshot `.xlsx` thật xuất từ Google Sheets | Phase 2 · việc còn nợ của Phase 0 | ✅ **đã có 2026-08-24**: `file tai xuong tu google sheet.xlsx` (96 KB), vẫn nằm ngoài kho. Đã chạy `dump-sheets.js` → snapshot + báo cáo, số dòng thật chép vào §13.8, rồi **xoá cả ba** ngày 2026-08-25 (mục 11) |
| 6 | Mã của **công việc con / nhiệm vụ tạo mới** dùng dạng nào? | Phase 3 | ✅ **đã trả lời 2026-08-24**: dùng **`<mã công việc>-NNN`** (ví dụ `CV001-007`), số lấy từ sequence toàn hệ thống `seq_work_item_code` nên không bao giờ trùng. Nhiệm vụ chuyển sang công việc khác thì **giữ nguyên mã cũ**, không đánh số lại. Mã cũ dạng `ID<yymmddhhmmssSSS>` khi nhập vào thì **giữ nguyên nguyên văn**, không đổi — đổi mã là mất dấu vết đối chiếu |
| 7 | Google đổi tên sheet `Dự án/Nhiệm vụ` thành gì khi tải `.xlsx`? | Phase 2 | ✅ **đã biết 2026-08-24**: thành **`Dự ánNhiệm vụ`** — Google **xoá hẳn** dấu `/`, không thay bằng ký tự khác. `dump-sheets.js` khớp đúng nhờ so tên chuẩn hoá |
| 8 | Ô `Nhiệm vụ JSON` thật **không có** khoá `Cấp` và `Mã cha` (xem §13.8) — vậy khi nhập, nhiệm vụ cũ thành **cấp 2 hay cấp 3**? | ~~Phase 2~~ | ⛔ **hết hiệu lực 2026-08-24** vì Phase 2 đã đổi hướng sang dữ liệu test tự tạo, không còn công cụ nhập tự động. Câu hỏi **sống lại ở Phase 9** khi nhập tay 28 dòng, nhưng lúc đó người nhập tự quyết từng dòng nên không cần chốt trước. Đề xuất cũ vẫn hợp lý: cho thành **cấp 2 (công việc con)** vì chúng đã có ngày, người thực hiện, tiến độ riêng |
| 9 | Sheet `Thông báo` **không tồn tại** trong file tải về, dù §4.3 khai là bắt buộc — bản Apps Script chưa từng tạo, hay đã bị xoá? | ~~Phase 2~~ | ⛔ **hết hiệu lực 2026-08-24**: không nhập dữ liệu cũ nữa nên không có gì phụ thuộc. Bảng `notifications` bắt đầu từ dữ liệu mẫu (6 dòng) ở dev, và **rỗng** ở bản chính thức |
| 10 | Mã công việc **sinh mới** dùng tiền tố `CV` (`CV010`, `CV011`…), còn 28 dòng thật đang mang mã `DA0xx` in trên giấy tờ. Có chấp nhận hai dạng mã sống chung trong cùng cột `code` không? | Phase 3 | ✅ **chốt 2026-08-25: GIỮ `CV`** (`CV010`, `CV011`…). Hai dạng mã sống chung trong cùng cột `code` là chấp nhận được: mã cũ `DA0xx` nhập tay giữ **nguyên văn** để khớp giấy tờ, mã mới do `next_code()` sinh ra mang `CV`. Không phải sửa gì — Phase 3 đã làm đúng theo giả định này |
| 11 | Còn giữ `tools/dump-sheets.js` và `data/snapshot-20260824.json` không, khi đã bỏ việc nhập tự động? | Không chặn | ✅ **chốt 2026-08-25: BỎ CẢ HAI**. Đã `git rm tools/dump-sheets.js` và xoá `data/snapshot-20260824.json` + `.report.txt` (`data/` chỉ còn `.gitkeep`). Mất mát duy nhất là bản JSON trung gian: số liệu của nó đã chép hết vào §13.8, `.xlsx` gốc vẫn còn ngoài kho, nên Phase 9 nhập tay vẫn đối chiếu được. Đổi lại, không còn file nào chứa mật khẩu văn bản thuần của người thật nằm trên máy dev |
| 12 | 28 dòng thật nhập tay ở Phase 9: ai nhập, nhập qua giao diện web hay bằng câu SQL? | Phase 9 | ✅ **chốt 2026-08-25: nhập QUA GIAO DIỆN WEB**, không dùng câu SQL. Được hai việc một lúc: dữ liệu vào đúng đường mà người dùng thật sẽ đi (nên lỗi nhập liệu lộ ra ngay), và chính việc nhập là một lượt nghiệm thu §8.5. Nhật ký cũ (`activity_logs` của bản Sheets) **bỏ hẳn**, không nhập lại. Kèm theo: mã cũ `DA0xx` phải nhập nguyên văn (mục 10), và mật khẩu 2 người bị rỗng phải đặt lại kèm `must_change_password` (§13.8) |
| 13 | **Ai được đặt nhắc việc?** Bản cũ chỉ `admin` ("Chỉ Admin mới có quyền thêm nhắc việc", `Code.gs.moi:2136`) nên người thực hiện không tự nhắc được việc của chính mình | Phase 3 (đã làm) | ✅ **chốt 2026-08-25: `admin` + `Trưởng phòng` / `Phó phòng` CỦA PHÒNG ĐÓ** — **đã nới thêm `Phó Giám đốc` phụ trách phòng ở mục 15 cùng ngày, đọc hai mục cùng nhau**. Hẹp hơn giả định tạm của Phase 3 ("ai sửa được nhiệm vụ thì đặt được"), nên phép kiểm "Nhân viên tự nhắc việc của mình" **đã bị đảo** thành 403 — đọc lời nhắc thì vẫn được. `Quản lý công việc` vẫn **không** đặt được, dù §6 cho họ sửa nhiệm vụ: đây là chỗ siết có chủ ý, đã chốt cứng bằng test riêng để lần sau không ai tự nới. Cài ở `assertCanManage` + `VAI_DAT_NHAC_VIEC` trong `modules/reminders/service.js`; ma trận §6 vẫn không có thực thể `reminder`, chỉ thêm một đoạn ngoại lệ ở cuối §6. `reminders-api.test.js` 17 → 21 → 23 phép kiểm |
| 14 | **Biểu mẫu cũ không tạo được công việc con (cấp 2)** — điểm đỏ **C7** của §8.5. `#task-form` không có ô `Cấp` hay `Mã cha`; `COL.T_LEVEL`/`COL.T_PARENT` khai ở `web/assets/js/app.js:56–57` rồi **không** chỗ nào dùng, nên mọi đầu việc bản cũ tạo ra đều là **cấp 3 không cha** (`csdl: CV019-071 cấp=3 cha=NULL`). Chọn hướng nào: (a) thêm 2 ô «Cấp» + «Công việc cha» vào biểu mẫu, (b) chỉ cho tạo cấp 2 bằng nút «+ công việc con» ngay trên cây (biểu mẫu giữ nguyên là tạo cấp 3), (c) giữ đúng hành vi cũ và chấp nhận cấp 2 chỉ sinh ra từ seed/nhập tay | Phase 5 việc **5.12** · điểm đỏ §8.5 C7 | ✅ **chốt 2026-08-25: phương án (b)** — nút «+ công việc con» ngay trên cây, biểu mẫu `#task-form` **giữ nguyên** là tạo cấp 3. Không thêm ô «Cấp» cho người dùng chọn: cấp suy ra từ chỗ bấm (bấm trên hàng công việc ⇒ tạo cấp 2 không cha; bấm trên hàng công việc con ⇒ tạo cấp 3 với `parentRef` là hàng đó). Phase 4 **không được** đổi DOM (điều lệ đầu `app.js`) nên đã dừng đúng chỗ và ghi đỏ; việc cài đặt là **việc 5.12** ở §7 Phase 5, xong thì điểm C7 của §8.5 mới hết đỏ |
| 15 | **Có nới quyền đặt nhắc việc cho `Phó Giám đốc` phụ trách phòng không?** Mục 13 chốt theo đúng nghĩa chữ là `admin` + `Trưởng phòng`/`Phó phòng` **của phòng đó**, nên `Phó Giám đốc` và `Quản lý công việc` **không** đặt được nhắc việc dù §6 cho họ sửa nhiệm vụ | Đã làm 2026-08-25 (Phase 4) | ✅ **chốt 2026-08-25: CÓ — `admin` + `Phó Giám đốc` PHỤ TRÁCH phòng đó + `Trưởng phòng` / `Phó phòng` của phòng đó** ("lãnh đạo phòng của phòng đấy"). `Quản lý công việc` và `Nhân viên` vẫn không đặt được. Đã cài: thêm `'Phó Giám đốc'` vào `VAI_DAT_NHAC_VIEC` (`server/src/modules/reminders/service.js`) + đổi câu 403; chữ "phụ trách phòng đó" **không cần dòng mã nào** vì `inScope()` đã bó vai này theo `managedDepartmentIds` (`department_managers.role = 'deputy_director'`, rbac.js:161). Thêm **2** phép kiểm mới vào `reminders-api.test.js` (Phó Giám đốc phụ trách phòng ⇒ 200; phụ trách phòng KHÁC ⇒ 403 *ngoài phạm vi*) ⇒ 21 → 23; không phép kiểm nào phải đảo vì bộ cũ chốt cứng `Quản lý công việc`, không chốt `Phó Giám đốc`. §6 sửa đoạn ngoại lệ theo |
| 16 | **Có mở đường ĐỌC thông báo + chuông trên giao diện không?** Phase 7 đã nối `addNotificationWithAuth` ⇒ `POST /api/v1/notifications` (chỉ admin, người nhận trống = gửi mọi người đang hoạt động), nhưng **không** có `GET /notifications`: §5.2 chỉ khai một dòng tạo, và trong 37 tên RPC không có tên nào đọc thông báo — giao diện cũ chưa từng vẽ danh sách này. Repo đã sẵn `listByUser` / `countUnread` / `markRead`, mở route chỉ là việc nhỏ, nhưng **thêm sớm là làm §5.2 lệch với mã nguồn** | Không chặn (Phase 8 vẫn chạy được) | ⏳ **chờ trả lời**: (a) để nguyên, thông báo chỉ là dấu vết trong CSDL cho tới khi có người yêu cầu; (b) mở `GET /notifications` + `PATCH /notifications/:id/read` và vẽ chuông ở một session sau — nếu chọn (b) thì cập nhật §5.2 trước khi viết mã |
| 17 | **Ai được ủy quyền?** Tính năng ủy quyền (`docs/KE-HOACH-UY-QUYEN.md`, migration `006_delegations.sql`) đang cho **mọi vai có phạm vi** tạo bản ghi ủy quyền: Phó Giám đốc, Trưởng phòng, Phó phòng, Quản lý công việc. Nhân viên không có gì để ủy quyền (chỉ có nhiệm vụ của chính mình) | Không chặn (đã triển khai theo giả định) | ✅ **chốt 2026-08-28**, nguyên văn: «Mọi cán bộ đều được ủy quyền, Chỉ được ủy quền từ cấp cao xuống cấp thấp hoặc ngang bằng nhau theo thứ tự: Giám đốc, phó giám đốc, trưởng phòng, phó phòng, cán bộ». Đã làm: bỏ danh sách `VAI_DUOC_UY_QUYEN`, thêm `BAC_VAI` (admin 1 · Phó GĐ 2 · Trưởng phòng 3 · Phó phòng 4 · Quản lý công việc và Nhân viên **cùng bậc 5** — cả hai đều là "cán bộ" trong câu chốt) và `DELEGATION_RANK_UP` khi ủy quyền LÊN. Hệ quả: Nhân viên nay ủy quyền được cho Nhân viên cùng phòng (mượn được đúng nhiệm vụ của người ủy quyền), và vai lạ ngoài 6 vai thì **không** ủy quyền được (không biết bậc thì không biết ai cao hơn ai) |
| 18 | **Người được ủy quyền có bắt buộc cùng phòng không?** Đang **KHÔNG** bắt buộc — người đi công tác có thể nhờ đồng cấp phòng khác; phạm vi vẫn bó theo `department_ids` của bản ghi nên không rò quyền sang phòng lạ | Không chặn | ✅ **chốt 2026-08-28**, nguyên văn: «Phải cùng phòng, còn giám đốc có thể ủy quyền cho phó giám đốc, phó giám đốc có thể ủy quyền cho nhau hoặc trưởng phòng?». Đã làm: `assertBacVaPhong` bắt cùng `department_id`, trừ đúng ba cặp ngoại lệ `admin → Phó Giám đốc`, `Phó Giám đốc → Phó Giám đốc`, `Phó Giám đốc → Trưởng phòng` (hai vai này làm việc theo đơn vị, không theo phòng), lỗi `DELEGATION_DIFFERENT_DEPARTMENT`. Đi kèm là chỗ siết của L2: bản ghi từ Giám đốc **bắt buộc liệt kê phòng** (`DELEGATION_ADMIN_SCOPE_REQUIRED`) và lúc kiểm quyền được đọc như quyền `Phó Giám đốc` trong đúng các phòng đó (`hieuLucCho`) — cặp GĐ → PGĐ hợp lệ mà vẫn **không** cho mượn quyền toàn hệ thống. Giao diện: form ủy quyền có ô chọn nhiều phòng hiện **riêng cho Giám đốc** (`buildUyQuyenPhamVi()`, commit `3dc480b`) — thiếu ô đó thì luật này đúng ở máy chủ nhưng không dùng được từ trình duyệt |
| 19 | **Một người nhận ủy quyền từ mấy người cùng lúc?** Đang **không giới hạn**: quyền là hợp của các bản ghi đang hiệu lực. Ràng buộc `delegation_no_overlap` chỉ chặn trùng khoảng ngày của **cùng một cặp** người | Không chặn | ⏳ **chờ trả lời**: có giới hạn 1 người ủy quyền cùng lúc để tránh một người gom quyền cả đơn vị không. (2026-08-28: vẫn để **không giới hạn**. Nay dễ chấp nhận hơn trước vì mục 20 đã chốt phải có phê duyệt — không ai bị gom quyền vào người mình không đồng ý) |
| 20 | **Có thông báo khi được ủy quyền / khi sắp hết hạn không?** Đang **chưa gửi gì**: `MAIL_ENABLED=false` (mục 4) và bảng `notifications` chỉ có đường tạo cho admin (mục 16). Làm thì nên làm cùng chuông thông báo, không làm riêng một đường | Không chặn | ✅ **chốt 2026-08-28**, nguyên văn: «Cần thông báo và phê duyệt của người được ủy quyền». Đã làm: `007_delegations_approval.sql` đổi `status` mặc định thành `'pending'`, thêm `accepted_at`/`declined_at` và trạng thái `declined`; bản `pending` **không cho mượn gì** (`listEffectiveFor` chỉ lấy `active`); `POST /:id/accept` · `/:id/decline` chỉ **người được ủy quyền** bấm được (admin cũng không — nếu admin đồng ý hộ được thì luật này thành hình thức); mỗi lần tạo và mỗi câu trả lời ghi một dòng `notifications` (`ref_type='delegation'`) cho đúng người còn lại. **Vẫn KHÔNG email** (mục 4). Còn treo: nhắc "sắp hết hạn" chưa làm, và đường ĐỌC thông báo trên giao diện vẫn phụ thuộc mục 16 — hiện người dùng thấy đề nghị ở trang «Ủy quyền của tôi», không phải ở chuông |

Nếu một mục ở đây chặn việc đang làm: **làm hết phần không phụ thuộc**, ghi rõ giả định đang
dùng, rồi hỏi. Không dừng cả phase chỉ vì một câu chưa được trả lời.

### 13.5 Bẫy đã biết — đừng phát hiện lại từ đầu

Đã điều tra xong ở bản Apps Script, mỗi bẫy đã có chỗ xử lý trong kế hoạch:

| Bẫy | Hậu quả nếu bỏ qua | Xử lý ở |
|---|---|---|
| Nhiệm vụ nằm trong **một ô JSON** của cột `Nhiệm vụ JSON`, không có sheet riêng | Thiết kế sai bảng; một ô hỏng xoá sạch nhiệm vụ của cả một công việc | §4.1 bảng `work_items` |
| Cấp 2 và cấp 3 **cùng một mảng**, phân biệt bằng `Cấp` + `Mã cha` | Đếm cấp 2 thành nhiệm vụ ⇒ thống kê phồng | view `v_countable_items`, TC-TREE |
| `Chờ duyệt` phải bị loại khỏi **mọi** con số | Số liệu sai ở chỗ không ai để ý | view, không viết điều kiện rải rác · TC-APR-06 |
| Mật khẩu lưu **văn bản thuần**, `authenticateUser` so `===` | Rò mật khẩu khi nhập dữ liệu | bcrypt cost 12 + buộc đổi lần đầu · Phase 2 |
| Email **chữ hoa** không khớp | Đăng nhập trượt không rõ lý do | `citext` · §4.1 |
| Mã sinh theo **millisecond** | Trùng mã khi server nhanh, nhiều người bấm cùng lúc | sequence + `UNIQUE` · TC-TREE-31 |
| `String(role).toLowerCase().includes('admin')` | `"Trợ lý admin"` được quyền admin | so khớp chính xác · TC-RBAC-07/08 |
| **53 chỗ** `innerHTML` ở frontend | XSS | soát ở Phase 4 · TC-SEC-02/03 |
| Tên cột khai **hai nơi** (`*_COLUMN_NAME` backend, `COL` 79 khoá frontend) | Sửa một bên, vỡ bên kia, không có cảnh báo | §4.3 bảng đối chiếu |
| **28 chỗ gọi** `google.script.run.<tên>` bằng chuỗi | Đổi tên hàm là vỡ im lặng | cầu tương thích §5.1 — giữ nguyên cả **37** tên |
| Thống kê backend (`getSummaryStats`) và frontend (`renderStats`) có thể **lệch nhau** | Không biết lấy số nào làm mốc so sánh | việc đầu tiên của Phase 6: xác định số đang hiện thật |
| Không có build step, 16 `onclick` viết trong chuỗi | Sửa tên hàm frontend là vỡ nút bấm | Phase 4 chỉ làm 4 việc đã liệt kê |
| `tools/test-tasks-gd2.js` — 40 test đang xanh | Là mốc hành vi cây 3 tầng của bản cũ | port sang vitest ở Phase 3 |

**Bẫy phát hiện thêm khi làm Phase 0 (2026-08-24):**

| Bẫy | Hậu quả nếu bỏ qua | Xử lý ở |
|---|---|---|
| Tên sheet thật `Dự án/Nhiệm vụ` có dấu `/`, mà `.xlsx` **cấm** `* ? : \ / [ ]` trong tên worksheet | Bản tải về bị đổi tên ⇒ công cụ nhập báo "thiếu sheet bắt buộc" dù dữ liệu vẫn còn | `dump-sheets.js` khớp theo tên **chuẩn hoá** (bỏ hoa/thường, bỏ ký tự cấm, gạch, khoảng trắng) và ghi tên thật vào `actual_name` · §13.4 mục 7 |
| Từ Node 20, Windows **chặn spawn file `.cmd`** (lỗi `EINVAL`) | Gọi `npx node-pg-migrate` trong script/test là đỏ trên máy Windows, xanh trên Linux | gọi `process.execPath` + đường dẫn `node_modules/<pkg>/bin/*.js` · `tests/global-setup.js` |
| npm ở máy này **chặn install script** (`allowScripts`) | Gói cần biên dịch native như `bcrypt` cài "thành công" nhưng thiếu file `.node`, chỉ vỡ lúc chạy | dùng `@node-rs/bcrypt` (có sẵn bản biên dịch, không cần install script) · §3.3 |
| Cổng 5433 đã bị Postgres của dự án khác chiếm trên máy này | `docker compose up` đỏ với "port is already allocated", dễ tưởng cấu hình sai | CSDL test dùng **5434**, mọi cổng khai qua biến trong `deploy/.env` |
| `vitest` truyền biến môi trường riêng cho test; `LOG_LEVEL: 'silent'` là mức hợp lệ của pino nhưng lúc đầu **không** có trong enum của `env.js` | Cả bộ test chết bằng `process.exit(1)` mà không nói lý do — tưởng lỗi CSDL | `LOG_LEVEL` nhận cả `'silent'` · `env.js` · TC-ENV-05 |
| `process.loadEnvFile()` **không** ghi đè biến đã có trong `process.env` (đã kiểm bằng thực nghiệm) | Nếu tưởng ngược lại thì test sẽ chạy vào **CSDL dev** và xoá sạch dữ liệu | `vitest.config.js` chặn thêm: `DATABASE_URL === TEST_DATABASE_URL` là dừng; `global-setup.js` không xoá CSDL nào không có hậu tố `_test` |

**Bẫy phát hiện thêm khi làm Phase 1 (2026-08-24):**

| Bẫy | Hậu quả nếu bỏ qua | Xử lý ở |
|---|---|---|
| Bộ xương Phase 0 trả 404 dạng `{success:false, error:'…'}` — **trái §5.3** — mà test `TC-HEALTH-03` lại khẳng định đúng cái hình dạng sai đó | Test xanh **bảo kê** cho lỗi: frontend Phase 4 sẽ đọc `error.code` và luôn nhận `undefined` | `app.js` dùng `notFoundHandler`/`errorHandler`; `TC-HEALTH-03` sửa theo §5.3. Bài học: khi test và tài liệu lệch nhau, **tài liệu đúng** cho tới khi người dùng nói khác |
| `requirePasswordChanged` nếu đặt ở đầu `/api` sẽ chặn luôn `/api/v1/auth/password` | Người bị bắt đổi mật khẩu lần đầu **không có đường nào ra** — 403 vĩnh viễn, phải sửa CSDL bằng tay | mắc **sau** `api.use('/v1/auth', authRouter)`, dựa vào thứ tự khai báo của Express · TC-AUTH-10 |
| Cột `sessions.id` kiểu `uuid`: truyền chuỗi rỗng vào `id <> $2` là **lỗi cú pháp** của Postgres, không phải "không khớp" | `deleteOtherSessions` đổ giữa transaction đổi mật khẩu ⇒ đổi mật khẩu thất bại toàn bộ | `WHERE user_id = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)`, truyền `null` chứ không phải `''` |
| bcrypt chỉ dùng **72 byte đầu** và bỏ im phần sau; 25 ký tự tiếng Việt có dấu = 75 byte | Hai mật khẩu khác nhau cùng đăng nhập được, mà đếm `.length` không thấy gì bất thường | `assertPasswordUsable` đếm `Buffer.byteLength` · `MAX_PASSWORD_BYTES` |
| Cookie CSRF phải **KHÔNG** `httpOnly` (ngược với phản xạ "cookie nào cũng httpOnly") | Frontend không đọc được token ⇒ mọi request ghi 403, dễ tưởng lỗi phiên | `setCsrfCookie` đặt `httpOnly: false`; cookie `sid` vẫn `httpOnly: true` |
| `locked_until` do `now()` của **Postgres** tính, còn test so với `Date.now()` của **máy chạy test** | Khẳng định `≤ 15 phút` đỏ ngẫu nhiên vì lệch đồng hồ container, mất thời gian tìm lỗi ở chỗ không có lỗi | biên độ `> 13` và `< 16` phút · `repo-users.test.js`, `auth-login.test.js` |
| `audit.js` ghi ở `res.on('finish')`, tức là **sau** khi supertest đã trả về | Test đọc `activity_logs` ngay là thấy bảng rỗng ⇒ tưởng audit không chạy | helper `waitForLogs()` chờ có dòng · `auth-password.test.js` |
| `eslint.config.js` khai `globals` bằng **danh sách tay** | Dùng `Buffer` là `no-undef`, lint đỏ dù code đúng | thêm `Buffer: 'readonly'`; biến global mới phải khai thêm ở đó |
| §13.7 từng ghi vai trò `Quản lý dự án`, còn CHECK `users_role_valid` chờ `Quản lý công việc` | `npm run seed:dev` đổ ngay ở câu INSERT, và nhầm lẫn từ vựng lan sang Phase 2 | sửa §13.7 · `seed-dev.test.js` kiểm đủ 6 vai trò nhập được thật |
| `/api/rpc/authenticateUser` (§7 việc 1.10) **chưa tồn tại** — cầu RPC dựng ở Phase 4 | Đường đăng nhập cũ của frontend không có giới hạn tần suất, chỉ còn khoá tài khoản chặn | Phase 4 phải gắn `loginRateLimiter` cho đúng đường đó; đã ghi chú ngay trong `app.js` |

**Bẫy phát hiện thêm khi làm Phase 2 (2026-08-24) — dữ liệu mẫu:**

| Bẫy | Hậu quả nếu bỏ qua | Xử lý ở |
|---|---|---|
| Dữ liệu mẫu chèn bằng **mã viết cứng** (`CV001`, `NV013`…) nên 6 sequence vẫn nằm ở 1 | `next_code()` trả `CV001` ⇒ **việc đầu tiên tạo bằng API đổ vì trùng `UNIQUE`**. Không test nào của Phase 2 chạm tới, lỗi chỉ nổ ở Phase 3 | 6 câu `setval` cuối `dev.sql` · TC-SEED-22/23 đòi đúng `CV010 / CV031 / DN006 / APP005 / NV014 / PH06` |
| `setval(seq, n)` **thẳng** thay vì `GREATEST` | Seed chạy lại sau khi đã tạo `CV010`, `CV011` sẽ **kéo lùi** sequence về 9 ⇒ trùng mã lần nữa, lần này khó đoán hơn | `setval(seq, GREATEST((SELECT last_value FROM seq), n))` · §4.1 |
| 4 bảng **không có cột `code`** (`reminders`, `chat_messages`, `notifications`, `activity_logs`) nên không `ON CONFLICT` được | Chạy `seed:dev` lần thứ hai **nhân đôi** đúng 4 bảng đó, mà số liệu tổng quan lại đếm từ chúng | `INSERT … SELECT … WHERE NOT EXISTS` với khoá tự chọn: `(work_item_id, remind_date)` · nội dung tin nhắn · `(user_id, content)` · `(action, created_at)` |
| Hai chốt an toàn của bộ chạy seed kết thúc bằng `process.exit(1)` | Test gọi trực tiếp sẽ **giết luôn vitest**, nên cả hai chốt dễ bị bỏ không test — đúng hai chốt bảo vệ mật khẩu của người thật | `seed-guard.test.js` dùng `spawnSync(process.execPath, [run.js])` · TC-SEED-03/04 |
| `NODE_ENV=production` khiến `env.js` **không nạp** `deploy/.env` (cố ý, §3.4) | Thử chốt bằng tay ngoài vitest thì chết ở bước kiểm 13 biến thiếu, **chưa tới** chốt ⇒ tưởng chốt hỏng | chạy tiến trình con **từ trong vitest** (đã có sẵn 14 biến trong `process.env`), chỉ ghi đè `NODE_ENV` + `DATABASE_URL` |
| Khối chèn cấp 3 dùng `JOIN work_items p ON p.code = i.parent_code` | `INNER JOIN` **âm thầm bỏ** nhiệm vụ mồ côi (`parent_code` NULL) — dòng biến mất, không báo lỗi gì | nhiệm vụ mồ côi `CV001-030` phải có **câu `INSERT` riêng** · TC-SEED-13 |
| Ràng buộc `lvl2_no_parent` chỉ ràng **cấp 2**; cấp 3 `parent_id` NULL là **hợp lệ** | Test từng khẳng định "không cấp 3 nào thiếu cha" ⇒ **bảo kê cho một ràng buộc không tồn tại**, và mục C2 (gom nhóm `(chưa gán công việc con)`) không bao giờ có dữ liệu để thử | đảo khẳng định thành test riêng đòi đúng `['CV001-030']` · §8.3 |
| Sửa `001_init.sql` sau khi đã `migrate up` | CSDL dev giữ lược đồ **cũ**, seed hoặc test đỏ ở chỗ trông như lỗi SQL | `npm run migrate:redo` (down 1 + up) mỗi khi đụng vào migration |
| Số dòng của dữ liệu mẫu bị chép rải rác trong nhiều test | Thêm một dòng vào `dev.sql` làm đỏ 5–6 test ở 5–6 chỗ, phải sửa tay từng chỗ | **một** hằng `EXPECTED` đóng băng ở đầu `seed-dev.test.js` là nguồn duy nhất |
| Dữ liệu mẫu "sạch" quá | API xanh hết trên dev rồi vỡ ngay ngày đầu chạy thật vì dữ liệu thật có email chữ hoa, trùng tên, link thiếu `http`, nhiệm vụ mồ côi | §8.3 bắt dữ liệu mẫu **cố ý bẩn**, kèm chú thích đầu `dev.sql` để người sau không "sửa cho sạch" |

**Bẫy phát hiện thêm khi làm Phase 3 (2026-08-24/25) — API cây 3 tầng:**

| Bẫy | Hậu quả nếu bỏ qua | Xử lý ở |
|---|---|---|
| Chạy `npx vitest` **từ gốc repo** thay vì từ `server/` | npx nạp **vitest@4** ở gốc, không có `globalSetup` ⇒ CSDL test không được dựng và **mọi test xác thực trả 401**; nhìn như code phân quyền vỡ chứ không như chạy sai chỗ. Dòng `RUN v4.1.11 E:/quanlycongviec` ở đầu output là dấu hiệu duy nhất | luôn `cd server` trước mọi lệnh npm/npx · ghi ở `docs/BAT-DAU-SESSION.md` mục 4 |
| Truy vấn đệ quy chỉ neo gốc ở `parent_id IS NULL` | Dữ liệu trỏ **vòng** (A cha B, B cha A) không có dòng nào `parent_id IS NULL` ⇒ cả vòng **rơi khỏi cây**, người dùng mất việc mà không có lỗi nào | neo gốc theo "cha không đọc được / không phải cấp 2" và gom vào nhóm `(chưa gán công việc con)` · `works/tree.js` · TC-TREE-30 |
| `listDescendants` trả **cả chính dòng gốc** khi dữ liệu trỏ vòng | `remove` báo "đã xoá 3 dòng" trong khi chỉ có 2, và `copy` **sao bản gốc thêm một lần nữa** | `AND id <> $1` ở câu SELECT cuối của `WITH RECURSIVE` · mục [1] phép 9 của `legacy-gd2-parity.test.js` |
| `worksRouter.get('/:id')` khai **trước** `/tree` | Express xét theo thứ tự ⇒ `tree` bị bắt làm `:id`, người dùng nhận `404 Không tìm thấy công việc tree` | khai `/tree` trước `/:id` · chú thích ngay tại chỗ trong `works/routes.js` |
| `dateInput` của `zodTypes.js` đổi `''`/`null` thành `null` — tiện cho ngày **tuỳ chọn** | Dùng lại cho `remind_date` (`NOT NULL`) thì chuỗi rỗng lọt xuống CSDL và nổ **500** thay vì 400 kèm tên trường | nhắc việc có schema riêng: `z.string()` bắt buộc + `regex(/^\d{4}-\d{2}-\d{2}$/)` · `reminders-api.test.js` thử `['', '10/09/2026', '2026-9-10', 'hôm nào đó']` |
| Helper HTTP của test tên là **`del`**, không phải `delete` (`delete` là từ khoá) | `api.delete(...)` là `undefined is not a function`, dễ tưởng route chưa có | `tests/helpers/http.js` · dùng `api.del(url)` |
| Bắn **20 request đồng thời** mà mỗi request tự đi lấy token CSRF | supertest dựng 20 kết nối cùng lúc ⇒ `ECONNRESET` ngẫu nhiên, test đồng thời đỏ vì hạ tầng test chứ không vì mã trùng | lấy token **một lần** rồi dùng chung cho cả 20 request · TC-TREE-31 |
| `copyProject` bản cũ sao cây con nhưng **không** ánh xạ lại `Mã cha` | Bản sao trông như xong, mà mọi nhiệm vụ con vẫn treo dưới cây **gốc**: sửa "bản sao" là sửa thẳng dữ liệu bản gốc | `copy` dựng `Map(id gốc → id bản sao)` rồi ghi `parent_id` theo bản sao · TC-TREE-26/27 |

**Bẫy phát hiện thêm khi làm Phase 4 (2026-08-25) — cắt frontend sang API:**

Nhóm XSS (rủi ro số 1 của phase, việc 4.6):

| Bẫy | Hậu quả nếu bỏ qua | Xử lý ở |
|---|---|---|
| Kế hoạch ghi «**53 chỗ** `innerHTML`» — đếm bằng `grep innerHTML` là đếm **dòng** | Thực tế **55 dòng = 70 chỗ chèn = 474 giá trị** cần soát. Soát theo con số 53 là bỏ sót gần một phần tư | việc 4.6 · đã soát từng giá trị, ghi kết quả từng chỗ · TC-SEC-02/03 |
| `escapeHtmlAttr` viết tay **thiếu dấu `'`** | Thuộc tính nào dùng nháy đơn (`title='…'`) là thoát ra ngoài được ngay, dù hàm tên là "escape attr" | `escapeHtmlAttr` escape đủ `& < > " '` · `xss-escape.test.js` |
| Trong thuộc tính `on*`, trình duyệt **giải mã thực thể TRƯỚC** khi chạy JS | `onclick="f('&#39;)"` → JS nhận đúng dấu nháy ⇒ **HTML-escape không cứu được `on*`**; phải escape theo tầng JS hoặc bỏ hẳn `onclick` | không nhúng dữ liệu vào `on*`; chỗ buộc giữ thì escape tầng JS · TC-SEC-03 |
| `encodeURIComponent` bị dùng như cách "escape cho chuỗi JS" | Không phải escape JS: `%27` vẫn về `'` sau `decodeURIComponent`, và không chặn ngắt chuỗi ở chỗ khác | dùng `JSON.stringify` cho chuỗi JS, `encodeURIComponent` chỉ cho URL |
| `formatDateForDisplay` **trả nguyên giá trị** khi không parse được ngày | Giá trị bẩn (`<img onerror=…>`) đi thẳng vào HTML qua một hàm trông như đã "định dạng an toàn" | escape ở **chỗ chèn**, không tin hàm định dạng |
| Escape một **toán hạng số** rồi mới tính | `"Link " + escape(i+1)` ra `Link 01` (chuỗi nối chuỗi) — sai hiển thị mà không ai coi là lỗi bảo mật nên khó thấy | chỉ escape giá trị **văn bản**, giữ số ở dạng số |
| `javascript:` trong `href` do người dùng nhập (link kết quả) | Bấm vào link "kết quả" là chạy mã của người nhập | lọc theo danh sách trắng `http:`/`https:`/`mailto:` trước khi ghi `href` · TC-SEC-02 |

Nhóm cầu tương thích RPC (việc 4.2 + 4.4 + 4.5):

| Bẫy | Hậu quả nếu bỏ qua | Xử lý ở |
|---|---|---|
| Kế hoạch ghi **36** tên hàm, đếm lại ở `app.js` ra **37** | Thiếu một tên là một nút bấm chết im lặng (`google.script.run` không báo gì). Nguyên nhân: một dòng bảng §5.1 **gộp 2 tên** vào một ô | §5.1 đã sửa thành 37 · `api-bridge.test.js` phủ **đủ 37 tên** |
| `getInitialDataWithAuth` là **ngoại lệ**: khi chưa đăng nhập phải trả `{requireLogin:true}` | Trả `401` hay `501` thì giao diện báo "lỗi máy chủ" ngay màn hình đầu thay vì mở modal đăng nhập | `rpc/table.js` xử riêng · đã kiểm ở §8.5 nhóm 2 |
| `changePassword` bản cũ có **2 chữ ký** (2 và 3 tham số) | Nhận 2 tham số rồi âm thầm bỏ qua mật khẩu hiện tại = đổi mật khẩu **không cần biết mật khẩu cũ** | chữ ký 2 tham số → `400` «Thiếu tham số «Mật khẩu hiện tại»» · §8.5 Đ3 |
| Nhắc việc bản cũ gọi theo **số thứ tự trong mảng**, CSDL mới dùng `id` | Sửa/xoá **nhầm dòng** khi danh sách đã đổi giữa hai lần tải | `reminderIdByIndex` trong `rpc/index.js`; số thứ tự lạ → `404` chứ không sửa bừa · §8.5 C11 |
| `getTasks` bản cũ trả **phẳng toàn bộ** ⇒ cầu nối gọi N+1 | Mở một công việc là hàng chục truy vấn; dữ liệu thật sẽ chậm rõ | ghi nợ cho Phase 6 (gộp một truy vấn) · đã đo ở §8.5 C6 |
| `loginRateLimiter` đếm **hai lần** nếu RPC gọi lại route `/api/v1` qua HTTP | Đăng nhập sai 3 lần đã bị `429`, người dùng bị chặn oan | RPC gọi **hàm service**, không tự gọi HTTP nội bộ · `rpc-rate-limit.test.js` |
| zod trả thông điệp mặc định **bằng tiếng Anh** (`Required`) | Người dùng thấy "Required" giữa màn hình tiếng Việt | mọi field có `message` tiếng Việt; test kiểm chuỗi Việt |
| `work_items.result_links` là **jsonb**, không phải mảng text | `array_length(...)` nổ `function does not exist` khi kiểm bằng SQL | dùng `jsonb_array_length` |
| Bảng `sessions` **không có** cột `revoked_at` | Câu SQL kiểm phiên hết hạn nổ giữa lượt khói | hết phiên kiểm bằng `expires_at` · §8.5 Đ6 |
| Máy chủ trả người dùng dạng `{code, full_name, role}` (`publicUser()`), còn `app.js` đọc `currentUser.name` (**57 chỗ**) | `updateUIForUser` chạy `user.name.split(" ")` ⇒ `TypeError: Cannot read properties of undefined (reading 'split')` **ngay sau khi đăng nhập**, giao diện trắng nửa trên — đã dựng lại được bằng jsdom với `index.html` + `app.js` thật | **việc 5.10**: hoặc cầu nối gán thêm `name = full_name`, hoặc đổi 57 chỗ ở `app.js` sang `full_name` — chọn một, đừng làm nửa vời · cách chữa tay khi test giao diện: `docs/HUONG-DAN-TEST-GIAO-DIEN.md` §6.2 |
| `renderProjects()`/`renderTasks()` gọi khi `currentUser` còn `null` | `TypeError: Cannot read properties of null (reading 'name')` — dễ tưởng dữ liệu API sai, thật ra chỉ thiếu một dòng gán | luôn đặt `currentUser` + `isAuthenticated = true` **trước** mọi hàm `render*` · §6.1 của hướng dẫn test |

Nhóm Nginx + tài sản tĩnh (việc 4.3 + 4.8):

| Bẫy | Hậu quả nếu bỏ qua | Xử lý ở |
|---|---|---|
| `add_header` **không kế thừa**: khai một `location` có `add_header` là **mất sạch** header của khối cha | Trang chạy bình thường nhưng **không còn** CSP/nosniff — không có lỗi nào để thấy | `deploy/nginx/security-headers.conf` được `include` **trong từng** `location` · `nginx-static.test.js` |
| `always` gắn vào `Cache-Control: max-age=2592000` | Cache **cả phản hồi 404** 30 ngày: tài sản gõ sai đường dẫn hôm nay thì 30 ngày sau vẫn 404 | `always` **chỉ** cho header bảo vệ, **không** cho `Cache-Control` · đã kiểm: 404 có header bảo vệ, không có cache dài |
| `upstream`/`proxy_pass` tên cố định được phân giải **lúc nginx khởi động** | Container app lên sau nginx là nginx chết ngay khi khởi động | `resolver 127.0.0.11` + `set $var` + `proxy_pass http://$var$request_uri` (phân giải lúc có request) |
| Nhưng `resolver 127.0.0.11` **bỏ qua `/etc/hosts`** | `docker run --add-host app:host-gateway` **vô dụng** — vẫn `502`, mất cả buổi đi tìm lỗi ở chỗ khác. Kiểm chứng: đã thử, vẫn 502 | muốn trỏ về ứng dụng chạy trên máy thật thì đặt **một container tên `app`** làm cầu: `alpine/socat tcp-listen:3000,fork,reuseaddr tcp-connect:host.docker.internal:3000` |
| Thiếu `default_server` trên `listen` | `default.conf` của image nginx **thắng**, người dùng thấy trang "Welcome to nginx" thay vì ứng dụng | `listen 80 default_server;` |
| Tailwind v3 quét tệp để cắt class ⇒ class **ghép chuỗi lúc chạy** bị cắt | Nhãn trạng thái mất màu, đúng những chỗ tô màu theo dữ liệu | safelist các nhóm `bg-*`/`text-*` sinh động; class `font-inter` **chết** (không có trong config) đã bỏ |
| `?v=` đặt tay trên `app.js`/`app.css` | Sửa mà người dùng vẫn chạy bản cũ trong cache 30 ngày | tăng tay mỗi lần sửa **đến Phase 8** (Phase 8 mới có bước băm tên tệp) |

Nhóm công cụ và môi trường (lượt khói §8.5):

| Bẫy | Hậu quả nếu bỏ qua | Xử lý ở |
|---|---|---|
| **Git Bash làm hỏng tiếng Việt truyền qua argv**: `curl -d '…tiếng Việt…'` hay `psql -c '…'` bị chuyển sang codepage console và tới nơi thành `U+FFFD` | Hệ thống **lưu luôn bản đã hỏng** (`"KH\357\277\275I 8.5"`), rồi mất thời gian đi tìm lỗi encoding trong CSDL/API trong khi chúng đều đúng | mọi thân JSON và mọi câu SQL đi qua **stdin**: `--data-binary @-`, `docker exec -i … psql` — đã ghi rõ ở đầu `tools/smoke-8.5.sh` |
| `process.loadEnvFile()` **không ghi đè** biến môi trường đã có | Tưởng `deploy/.env` luôn thắng; thực ra `DATABASE_URL=… npm run …` trên dòng lệnh thắng | chính nhờ vậy mà dựng được CSDL khói **riêng** (`quanlycongviec_uat`) không chạm dữ liệu dev |
| Chạy `seed:dev` lên CSDL **đã có dòng tay** cùng `code` nhưng khác `level` | Nổ `PARENT_NOT_SUBWORK` («Cha phải là công việc con (cấp 2)») — thông điệp trỏ sai hướng, vì `ON CONFLICT (code) DO UPDATE` **không** sửa được `level` | seed lên CSDL sạch/riêng; CSDL dev hiện còn 5 dòng tay (`CV001` "Việc gốc"…) **chặn** `seed:dev` ở đó |
| `works.approval_status` có mặc định `'Đã duyệt'::text` | Tưởng luồng duyệt đã chạy: **không** chỗ nào ở Phase 3/4 đặt «Chờ duyệt», nên mọi thống kê "bỏ mục chờ duyệt" đều chưa được kiểm thật | điểm đỏ §8.5 **D1** · việc **5.2** của Phase 5 |
| jsdom **không có** thuộc tính đặt tên của form (`form.tenO`) | Test giao diện đỏ vì `undefined`, tưởng code sai | dùng `form.elements.namedItem('…')` trong test |
| Biểu mẫu cũ **không gửi** `level`/`Mã cha` (`COL.T_LEVEL`/`COL.T_PARENT` khai ở `app.js:56–57` rồi không dùng) | Mọi đầu việc bản cũ tạo ra là **cấp 3 không cha**; cây 3 tầng chỉ tồn tại trong dữ liệu seed | điểm đỏ §8.5 **C7** · §13.4 mục 14 |
| Bản cũ còn 3 id DOM **chết** (`#add-notification-btn` và 2 id nữa) có listener nhưng không có phần tử | Đọc code tưởng tính năng đã có; sửa "lỗi không bấm được" của một nút không tồn tại | việc 4.7 đã bỏ listener chết; icon thiếu dùng ảnh dự phòng của flaticon |
| **Git Bash đổi đường dẫn trong `docker run -v`**: `-v "$PWD/x:/etc/nginx/conf.d/app.conf:ro"` thành `C:/Program Files/Git/etc/nginx/conf.d/app.conf` | `app.conf` **không hề được nạp**, nginx chạy bằng `default.conf` của image ⇒ `/` trả **200** (trang Welcome) mà `/api/*` và `/assets/vendor/*` đều **404**. Triệu chứng đánh lừa: thấy 200 nên tưởng nginx đúng, đi tìm lỗi ở Express/CORS/proxy — mất cả buổi | thêm `MSYS_NO_PATHCONV=1` trước **mọi** `docker run -v` và `docker exec` có đường dẫn tuyệt đối; kiểm ngay bằng `docker exec … ls /etc/nginx/conf.d/` (phải thấy `app.conf`) — lệnh đã sửa ở `docs/BAT-DAU-SESSION.md` mục 4 |

**Bẫy phát hiện thêm khi làm Phase 5 (2026-08-25) — duyệt / bootstrap / khói:**

| Bẫy | Hậu quả nếu bỏ qua | Xử lý ở |
|---|---|---|
| CSDL khói `quanlycongviec_uat` **không tự chạy migration mới** — `npm run migrate:up` đọc `DATABASE_URL` của **dev** | `getDataForUser` / bootstrap 500 `INTERNAL` vì `v_countable_works` không tồn tại (`to_regclass` NULL, `pgmigrations` dừng ở 003) — tưởng code 5.10 hỏng | `DATABASE_URL=postgres://qlcv:<mk>@127.0.0.1:5432/quanlycongviec_uat npm run migrate:up` **mỗi khi** thêm migration; `loadEnvFile()` không ghi đè biến dòng lệnh |
| Helper trả HTML mà **không** khớp `BUILDER` (`create`/`build`/`render`/`wrap`/`describe`/`linkify`/`get*Html`) | XSS-guard xếp vào `CAN-THOAT` dù đã `escapeHtml` bên trong — việc 5.12 đặt tên `add*ButtonHtml` là 8 chỗ đỏ + pin TC-SEC-17 lệch | đổi tên thành `create*ButtonHtml` (HTML-LONG); **không** nhét vào danh sách trắng cho hết đỏ. Pin 474 → 481 (5.6) → **498** (5.12) |
| `class="` + biến `className` không thoát | Hôm nay caller truyền chuỗi Tailwind cố định; ngày mai dữ liệu người dùng vào là vỡ thuộc tính | `escapeHtml(className)` trong helper nút 5.12 |
| Bộ khói `grep approveWork\|rejectWork\|duyet\|approval` trên `app.js` | In `0` dù `pendingApprovalBadge` đã có — tưởng việc 5.6 chưa làm; đồng thời **không** gọi REST `/approvals/.../approve` nên D4–D6 dễ bị tô xanh oan hoặc đỏ oan | đọc REST + test `approvals-api` / `pending-badge`; nút Duyệt trên cây **thật sự chưa có**. Sửa grep khi đụng `smoke-8.5.sh` |
| Vòng N* `rpc "$f" '{"args":[{}]}'` | Sau 5.11 ra 400/404 thay vì 501 — đó là **thành công**, không phải hồi quy. Comment «cả 7 còn 501» trong script **lạc hậu** | đừng khôi phục `pending()`; happy-path thêm nhân sự đủ trường chưa nằm trong bộ khói |
| `#projects-pending-count` / `#tasks-pending-count` | Trông như badge chờ duyệt của việc 5.5; thật ra đếm trạng thái **«Chưa bắt đầu / Tạm dừng»** của bản cũ. `pendingCount` của bootstrap **không** được `app.js` đọc | D3 vẫn ⏳; đừng nối nhầm hai con số |
| File test jsdom mới mà quên khai `globals` trong `eslint.config.js` | `no-undef window` hàng loạt (`subwork-button-ui.test.js` 46 lỗi) | thêm file vào khối jsdom cùng `pending-badge` / `countable-stats-ui` |
| `node-pg-migrate` in «Can't determine timestamp for 001/002/003/004» | Tưởng migration hỏng; vẫn áp được | bỏ qua, kiểm `pgmigrations` / `to_regclass` |

**Bẫy phát hiện thêm khi làm Phase 6 (2026-08-25) — thống kê / Gantt / đối chiếu:**

| Bẫy | Hậu quả nếu bỏ qua | Xử lý ở |
|---|---|---|
| `renderStats(summaryStats)` của app.js **BỎ QUA tham số**: tự tính lại từ `getFilteredProjects()/getFilteredTasks()`, mà `allTasks` gồm CẢ cấp 2 lẫn cấp 3 | So REST mới với `summaryStats` máy chủ trả là so sai chuẩn từ đầu; tưởng REST đếm sai | Việc đầu Phase 6: xác định số đang hiện thật = phép tính phía UI. Chuẩn đối chiếu = thuật toán UI port vào `stats-parity.test.js`, chạy ở tầng cấp 3 ⇒ chênh 0; dòng «UI đếm thêm cấp 2» ghi rõ là chênh CÓ CHỦ Ý (=2 trong bộ đối chiếu) |
| Thẻ «Đang làm» của UI gộp BA trạng thái (đang + chưa + tạm dừng), còn `getSummaryStats` backend cũ chỉ đếm 'đang' | REST mới chọn theo backend cũ thì đối chiếu với UI lệch 2 đơn vị không giải thích được | `stats/service.js`: `theDangLam()` = đang+chưa+tạm dừng, chú thích dẫn TC-STAT-16 |
| Test chèn tay dữ liệu với **mã viết cứng** (`makeWork({code:'CV001'})`) không nhích sequence ⇒ POST `/works` sau đó ra **409 CONFLICT im lặng** nếu test không assert status | APR-06 từng «xanh giả»: mục Chờ duyệt chưa được tạo, `expect(sau).toEqual(truoc)` pass vì cả hai rỗng | trước lời gọi API sinh mã: `setval('seq_work_code',100,true)`; và LUÔN `expect(tao.status, JSON.stringify(tao.body)).toBe(200)` |
| Audit middleware ghi ở `res.on('finish')`, INSERT còn nằm trong hàng đợi pool SAU khi supertest trả về | Test đếm `activity_logs` đỏ ngẫu nhiên (7→8) khi chạy chung file khác; DELETE xong đo ngay vẫn dính write treo | trong test: DELETE xong chờ ~200ms rồi lấy **MỐC ĐỘNG** (`demLog()`) làm kỳ vọng, không assert số tuyệt đối · mẫu ở `stats-api.test.js` |
| Postgres **INLINE view**: EXPLAIN không còn tên `v_countable_*` trong plan | Test khẳng định «plan chứa tên view» sẽ đỏ dù truy vấn đúng view | khẳng định bằng TEXT truy vấn (`toMatch(/\bv_countable_\w+/)`, cấm `\bFROM works\b`) + EXPLAIN chỉ để chứng minh chạy được và plan mang filter `'Chờ duyệt'` — mẫu của `bootstrap.test.js` |
| `?departmentIds=1,2` đến route như **MỘT chuỗi có dấu phẩy**, còn `?departmentIds=1&departmentIds=2` là mảng | Lọc phòng trả tập RỖNG âm thầm (id `'1,2'` không tồn tại) — tưởng là hết dữ liệu | `boLocPhong`: `flatMap(split(','))` chấp nhận cả hai kiểu; test admin-multi-phòng canh đúng chỗ này |
| Luật TC-STAT-09 là **«thiếu một trong hai ngày ⇒ GIỮ dòng»**, không phải coi ngày thiếu = −∞/+∞ | Việc thiếu NGÀY BẮT ĐẦU nhưng CÓ ngày kết thúc bị rơi khỏi bộ lọc tháng dù spec đòi giữ | `giaoNhau()`: check `!start \|\| !end → true` TRƯỚC phép tính khoảng |
| Sửa file bằng PowerShell `(Get-Content -Raw) … \| Set-Content` (PS5.1, file UTF-8 **không BOM**) | Toàn bộ tiếng Việt trong file thành mojibake (`KhÃ´ng…`) — `node --check` VẪN XANH vì chỉ soi cú pháp! | sửa app.js/test qua editor tool hoặc Node script (`readFileSync utf8`); nghi ngờ thì grep một câu tiếng Việt gốc để xác minh |
| Trong test jsdom kiểu EXPORTS: arrow **concise body** `(obj)[ten]();` là SyntaxError ('Unexpected token ;') khi nằm trong object literal | Cả 9 test đỏ với thông báo lỗi không chỉ ra dòng nào | bọc thân block: `__gantt: (ten, giaTri) => { ({ … })[ten](); },` — mẫu của `countable-stats-ui.test.js` |
| Helper trả HTML đặt tên tiếng Việt (`tao*Html`) | `xss-guard` xếp vào CAN-THOAT dù đã escape bên trong — pin đỏ 23 giá trị | đổi tên theo quy ước BUILDER: `createGanttToggleHtml`, `buildGanttCellHtml`, `renderGanttDaysHtml`…; builder nhận VĂN BẢN thô tự escape MỘT lần, caller đừng escape trước (tránh thoát hai lớp); thuộc tính id/class phát sinh cũng phải `escapeHtml` |
| RPC `getDataForUser` trả cây GỒM mục Chờ duyệt (đúng việc 5.6) | Thuật toán cũ port vào test sẽ ĐẾM cả mục chờ duyệt nếu không lọc — tưởng REST mới sai | trong `stats-parity.test.js` lọc trước bằng port của `getFilteredProjects/TasksCu` (đúng luật UI hiện hành) rồi mới so |
| `bash` trên máy này trúng **WSL** (`execvpe(/bin/bash) failed`) thay vì Git Bash | Bộ khói không chạy được, tưởng script hỏng | gọi đường dẫn rõ: `C:\Program Files\Git\bin\bash.exe tools/smoke-8.5.sh` |
| Test cắm cứng «ngày mai» theo lịch kế hoạch (`new Date('2026-08-26T07:00+07')` — cron-overdue) trong khi thông báo insert mang **created_at = đồng hồ thật** | Đúng nửa đêm, ngày thật trùng «ngày mai» giả ⇒ bộ gộp trùng coi đã nhắc ⇒ đỏ ổn định sau 00:00, xanh trước đó — flake theo giờ chạy | lùi `created_at` về đồng hồ giả bằng UPDATE ngay trong test + suy «mai» từ `HOM_NAY`, không hardcode · đã vá trong `cron-overdue.test.js` |

**Bẫy phát hiện thêm 2026-08-26 (tính năng phân công ba lớp):**

| Bẫy | Hậu quả nếu bỏ qua | Xử lý ở |
|---|---|---|
| View tạo bằng **`SELECT *` đóng băng danh sách cột** tại thời điểm tạo — `ALTER TABLE ADD COLUMN` sau đó **không** tự xuất hiện trong view | `countable-views.test.js` («view trả đủ cột bảng gốc») đỏ sau migration mới; thống kê đọc view thiếu dữ liệu cột mới | migration thêm cột phải kèm **CREATE OR REPLACE VIEW** với điều kiện lọc GIỮ NGUYÊN từng chữ (đừng sửa điều kiện ở đây — đó là nguồn sự thật thứ hai); chiều Down phải OR REPLACE về hình cũ TRƯỚC khi DROP COLUMN, nếu không DROP nổ "other objects depend" · mẫu của `005_phan_cong.sql` |
| `app.js` dùng **CRLF** và giữ chuỗi HTML bên trong string literal (mỗi `\"`, `\n` là 2 ký tự raw) | Script chèn dùng mốc chứa `\n` thật sẽ **không bao giờ khớp** mốc raw và ngược lại; replace tay bằng PowerShell hỏng UTF-8 mà `node --check` vẫn xanh | script node `.mjs` đọc/ghi utf8; phân biệt rõ `\n` (newline thật) vs `\n` raw (viết `\\n`); SAU MỖI lần ghi chạy `node --check` |
| Chạy lại script chèn nhiều lần | Khối bị chèn trùng → `Identifier has already been declared`, hoặc xoá "trùng" nhầm làm đứt chuỗi HTML giữa chừng (lỗi cú pháp tại dòng KHÁC chỗ cắt) | mọi thay đều có **guard**: nếu chuỗi đích đã tồn tại thì bỏ qua; nếu phải xoá thì neo đúng ranh giới hàm (`function A` … `function B`) thay vì đếm dòng |
| Comment block chứa chuỗi `build*/` | `*/` trong chữ đóng comment block sớm ⇒ cả file vỡ cú pháp phía sau | đừng viết `*/` bên trong nội dung comment |
| `helper err()` 2 tham số có sẵn trong service (`const err = (code, message) => …`) | Gọi `err(code, msg, {field})` im lặng **mất** `field` ⇒ test assert `error.field` đỏ mà khó tìm | dùng `new AppError(code, msg, { field })` trực tiếp khi cần field/details |
| `node -e "…"` qua PowerShell để sửa file | Quoting kép PS + JSON escape lẫn nhau, lệnh vỡ hoặc sửa sai chỗ | viết file `.mjs` tạm bằng editor rồi `node tools/x.mjs`; xong việc thì xoá |
| Hai CSDL cùng container: `quanlycongviec` (dev, từ `deploy/.env`) và `quanlycongviec_uat` | Migrate/tạo tài khoản khói nhầm DB dev ⇒ smoke vẫn `423 ACCOUNT_LOCKED` / thiếu dữ liệu dù đã "làm" | kiểm `-lqt` trước; UAT luôn ghi rõ URL `…/quanlycongviec_uat`; server UAT khởi động với env DB tương ứng rồi mới chạy bộ khói |
| Tài khoản khói `admin@test.local` mật khẩu **đổi vĩnh viễn** sau lượt khói trước (Đ3 đổi sang `MatKhauMoi@123`) | Lượt sau Đ1 đăng nhập 401 liên tục, tưởng hệ thống hỏng | chốt lại bằng hash mới (`hashPassword('Test@12345')` + ON CONFLICT DO UPDATE) rồi `UPDATE … failed_logins=0, locked_until=NULL`; verify bằng chính `verifyPassword` của server |
| Vá app.js qua **công cụ editor dạng JSON** (không phải qua script .mjs): tham số văn bản bị lớp JSON xử lý trước, mất cặp `\` trước nháy — chuỗi nguồn chứa `\"` thành `"` lúc so khớp | `old_text` "nhìn" giống hệt nhưng không bao giờ khớp nguyên văn ⇒ tưởng mốc sai/vì hỏng; nếu cố vá theo chuỗi đã bóp méo là đứt chuỗi template | với mốc vướng escape: chọn mốc **trong-dòng** hoặc không chứa backslash-quote; nghi ngờ thì in mã ký tự quanh mốc (`[...s].map(c=>c.codePointAt(0))`) để đối chiếu thay vì đoán bằng mắt |
| **Editor cắt cụt `new_text` giữa chừng** khi chèn khối dài: file vỡ cú pháp NGAY điểm chèn (`node --check` đỏ) trong khi diff thoáng qua nhìn như chỉ là hiển thị bị cắt | tưởng tool báo lỗi mà thực chất ĐÃ ghi nửa khối ⇒ app.js trắng trang nếu bỏ qua | `node --check` ngay sau MỖI lần chèn lớn vào app.js; khối dài tách nhiều lần nhỏ (<60 dòng); thấy diff cuối kỳ lạ thì kiểm tra byte thật bằng node trước khi sửa tiếp |
| Helper tự viết có escape bên trong (vd `hang()`, `hoverJsonAttr()`) — bộ soát XSS chỉ nhận diện các hàm thoát CHUẨN nên coi mọi gọi hàm lạ là CHƯA-thoát | xss-guard đỏ hàng loạt dù code thật an toàn; dễ sa vào "sửa test cho hết đỏ" | dựng HTML thì escape TRỰC TIẾP tại call-site (`escapeHtml(...)`/`escapeHtmlAttr(...)`) hoặc tính ra biến đã-thoát tên rõ nghĩa rồi ghép chuỗi; helper phức hợp phải nằm ngoài luồng dựng HTML |
| Ngày 'yyyy-mm-dd' parse thành **00:00 UTC = 07:00 ICT** — so thô với mốc 00:00 giờ địa phương làm việc rơi ĐÚNG ngày cuối tháng bị coi là NGOÀI khoảng (Gantt mất thanh ngày 31/08) | mất thanh + vị trí lệch ở nửa cuối tháng, tái đi tái lại "sửa chưa hết" | so sánh/bar-position đổi sang **số thứ tự ngày 0-based** (`Math.floor((d − rangeStart)/864e5)`) rồi kẹp biên theo chỉ số — trong `buildGanttCellHtml` (2026-08-27) |
| Định vị thanh Gantt bằng `left/width %` trên timeline dính dáng sticky/label/min-width | lệch ô ngày khó debug, mỗi trình duyệt một kiểu | đặt thanh bằng **grid-column trên CÙNG lưới** với header (`repeat(var(--gantt-so-ngay), minmax(0,1fr))`) — lệch là không thể (2026-08-27) |

**Bẫy phát hiện thêm khi làm Phase 7 (2026-08-27) — đề nghị / app / chat / xuất Excel / khói:**

| Bẫy | Hậu quả nếu bỏ qua | Xử lý ở |
|---|---|---|
| Ngày ghi vào ô Excel bằng `new Date(y, m-1, d)` (giờ địa phương 00:00) | Máy chạy ở UTC+7 nên `exceljs` quy về UTC ⇒ ô hiện **lùi một ngày** (31/08 thành 30/08). Phải `Date.UTC(y, m-1, d, 12, 0, 0)` — giữa ngày, lệch múi giờ nào cũng không đổi ngày | Việc 7.5, `export/workbook.js` + test ngày |
| Thụt lề cây trong Excel bằng **dấu cách đầu ô** | Excel coi là chuỗi có khoảng trắng: lọc/sắp xếp sai, người dùng xoá lề là mất chữ. Dùng `cell.alignment.indent` (thuộc tính ô, không phải nội dung) | Việc 7.5 |
| Viết truy vấn RIÊNG cho phần xuất «cho nhanh» | Đúng **lỗ rò to nhất** của phase: hai đường lọc phạm vi sẽ lệch nhau sau vài lần sửa, Nhân viên xuất ra dữ liệu phòng khác. Service xuất **không được chứa SQL**, phải gọi lại `getTree`/`stats service`; route xuất **không** kiểm quyền lần hai để chỉ có MỘT cổng | Việc 7.6, TC-MISC-11 |
| Prettier **không idempotent** với comment dài dán sau `}, 120_000);` | `npx prettier --write` xong mà `format:check` vẫn đỏ, sửa tay kiểu gì cũng đỏ lại. Cách thoát: đưa comment dài lên **trên** lời gọi `it(`, để lại dòng cuối gọn | `export-xlsx.test.js` |
| Cầu RPC nhận **nhãn cột bản cũ**, không nhận tên cột CSDL: `addApp` cần `{"Tên App":…}`, gửi `{"name":…}` thì `appFromLegacy` trả object rỗng | Khói/thử tay ra `400 «Tên ứng dụng không được để trống»` rồi đi kết luận sai là API hỏng. Tra `COL.*` trong `src/rpc/legacyFields.js` trước khi gọi | Bộ khói R11 |
| `npm run seed:dev` **không** dọn `users.locked_until` / `failed_logins` (`ON CONFLICT DO UPDATE` chỉ đặt các cột nó liệt kê) | Lượt khói trước tắt nửa đường ⇒ mật khẩu admin còn là mật khẩu tạm ⇒ Đ1 sai 5 lần ⇒ **khoá 15 phút** (`423`) và **mọi điểm sau đỏ theo**. Seed lại **rồi** `UPDATE users SET locked_until=NULL, failed_logins=0` | Ghi ở `docs/UAT.md` mục lượt khói Phase 7 |
| `curl http://127.0.0.1:8099/api/csrf` trả **502** dù `docker ps` thấy đủ container | Nginx và socat còn sống nhưng **Node trên máy thật đã tắt** (`tools/uat-server.pid` là pid cũ). Bật lại Node cổng 3000 trước khi làm gì khác | §8.5, `docs/BAT-DAU-SESSION.md` mục 4 |
| Chạy `tools/smoke-8.5.sh` từ trong `server/` | `exit 127 No such file`, và nếu chạy được thì các điểm đọc `web/index.html` cũng sai. Bộ khói phải chạy **từ gốc repo** | Bộ khói |
| Sửa bảng nhật ký §13.3 bằng `old_string` là **một đoạn đầu dòng cũ** | Phần đuôi dòng cũ bị dính vào dòng mới ⇒ **sửa mất dòng nhật ký cũ**, đúng điều §13.1 cấm. Thêm dòng mới thì lấy neo là **mấy dòng trắng + tiêu đề `### 13.4`** ở ngay dưới bảng | §13.1 |
| `tests/integration/stats-parity.test.js` **đỏ giả** khi chạy cả bộ (`npm test`) | Nó so số của `/stats/charts` với SQL trực tiếp trên **cùng CSDL test** mà các file integration khác đang ghi song song ⇒ 2 test lệch nhãn/số. Chạy riêng file đó thì xanh, chạy lại cả bộ cũng xanh. Gặp đỏ ở **đúng file này** thì chạy lại trước khi đi tìm lỗi nghiệp vụ | Đo được 2026-08-27, cuối Phase 7 |
| Liệt kê ràng buộc của một bảng bằng `conname LIKE 'ten_bang%'` | Khớp luôn `<bảng>_pkey` và mọi `<bảng>_*_fkey` do Postgres tự đặt tên ⇒ danh sách khẳng định phồng lên, test đỏ dù lược đồ **đúng**. Lọc theo **loại** ràng buộc: `contype IN ('c','x')` cho CHECK + EXCLUDE (thêm `'u'` nếu cần UNIQUE) | TC-UQ-01 `tests/integration/delegations-api.test.js` |
| So ngày hiệu lực của ủy quyền bằng `new Date()` **của Node** | Máy chủ chạy UTC, người dùng ở ICT (UTC+7) ⇒ trong 7 giờ mỗi ngày, bản ủy quyền hết hạn/chưa tới hạn bị tính sai đúng một ngày — quyền mượn rò thêm hoặc mất sớm. Mọi ranh giới ngày đi qua **`current_date` của CSDL** (cả test: hàm `ngayLech()` hỏi CSDL, không tự tính) | `modules/delegations/*`, TC-UQ-04/13/14 · bẫy múi giờ (b) ở trên |

### 13.6 Mở session mới — dán prompt là chạy

`docs/BAT-DAU-SESSION.md` giữ 6 mục: (1) đang ở đâu · (2) prompt mẫu điền `<PHASE>` ·
(3) **prompt đã điền sẵn cho phase kế tiếp** · (4) lệnh chạy môi trường dev theo đúng thứ tự ·
(5) lưu ý bắt buộc + bẫy riêng của máy đang dùng + quy ước code đã chốt · (6) checklist cuối session.

Quan hệ giữa hai file: §13 là **nguồn sự thật về tiến độ**; `BAT-DAU-SESSION.md` là **bàn đạp
thao tác**. Lệch nhau thì §13 đúng. Cuối mỗi session phải cập nhật cả hai (§13.1 quy tắc 6).

Không nhân bản nội dung: lệnh chạy và bẫy của máy chỉ ghi ở `BAT-DAU-SESSION.md`, tiến độ và
thiết kế chỉ ghi ở đây.

### 13.7 Danh sách nhân sự TEST (§13.4 mục 3) — người dùng sẽ sửa sau

Dữ liệu **bịa để test**, không phải nhân sự thật. Đưa vào `server/src/db/seeds/dev.sql` ở Phase 1,
chỉ chạy khi `NODE_ENV <> 'production'`. Mật khẩu tất cả: `Test@12345`, `must_change_password = true`.
PH01–PH04 lấy đúng tên theo file thật (§13.8); PH05 là phòng **rỗng hoàn toàn** thêm ở Phase 2 để
có một dòng xoá phòng thành công (§8.3).

| Mã | Họ tên | Email | Phân quyền | Phòng | Vai trò phòng |
|---|---|---|---|---|---|
| TEST001 | Quản trị Hệ thống | admin@test.local | admin | — | — |
| TEST002 | Phó GĐ Một | pgd1@test.local | Phó Giám đốc | phụ trách PH01, PH02 | — |
| TEST003 | Phó GĐ Hai | pgd2@test.local | Phó Giám đốc | phụ trách PH03, PH04 | — |
| TEST004 | Trưởng phòng Đào tạo | tp01@test.local | Trưởng phòng | PH01 | Trưởng phòng |
| TEST005 | Phó phòng Đào tạo | pp01@test.local | Phó phòng | PH01 | Phó phòng |
| TEST006 | Trưởng phòng Kế toán | tp03@test.local | Trưởng phòng | PH03 | Trưởng phòng |
| TEST007 | Quản lý Công việc | qlcv@test.local | Quản lý công việc | PH01 | Nhân viên |
| TEST008 | Nhân viên Đào tạo | nv01@test.local | Nhân viên | PH01 | Nhân viên |
| TEST009 | Nhân viên Kế toán | nv03@test.local | Nhân viên | PH03 | Nhân viên |
| TEST010 | Nhân viên Không phòng | nv00@test.local | Nhân viên | — | — |
| TEST011 | Nhân viên Nghiên cứu | **`Nghien.Cuu@test.local`** (chữ hoa, cố ý) | Nhân viên | PH02 | Nhân viên |
| TEST012 | Nhà cung cấp Mẫu | ncc@test.local | Nhân viên (đối tượng *Nhà cung cấp*) | — | — |
| TEST013 | **Nhân viên Đào tạo** (trùng tên TEST008, cố ý) | nv01b@test.local | Nhân viên | PH01 | Nhân viên |

TEST010 tồn tại để kiểm TC-RBAC-09 (người không thuộc phòng nào không được làm sập API).
Hai Phó GĐ phụ trách hai nhóm phòng khác nhau để kiểm TC-RBAC-05 (Phó GĐ A **không** duyệt được
mục của phòng do B phụ trách). Ba người thêm ở Phase 2 phục vụ dữ liệu bẩn của §8.3: TEST011 cho
email chữ hoa (`citext` phải cho đăng nhập bằng chữ thường — TC-AUTH-03) **và** để PH02 có người
của mình; TEST012 cho đối tượng ngoài cơ quan đứng tên đề nghị mua sắm; TEST013 để mọi chỗ dò
người **theo họ tên** lộ ra là sai.

**Đã làm xong ở Phase 1 (2026-08-24):** `server/src/db/seeds/dev.sql` + `run.js`, chạy bằng
`npm run seed:dev`. Bảng `department_managers` có **7 dòng**: 4 dòng `deputy_director` theo bảng
trên, cộng 3 dòng suy ra từ cột *Vai trò phòng* (`head` cho TEST004/TEST006, `vice` cho TEST005) —
hai lớp phân quyền của §6 cần cả hai loại dòng này. Câu seed viết lại được nhiều lần
(`ON CONFLICT`) và bộ chạy **từ chối** khi `NODE_ENV=production` hoặc khi tên CSDL chứa `prod`.

**Mở rộng ở Phase 2 (2026-08-24):** thêm TEST011–TEST013 (bảng trên) và toàn bộ dữ liệu nghiệp
vụ của §8.3. `seed-dev.test.js` lên **27 test** và `seed-guard.test.js` thêm **2 test** cho hai
chốt an toàn — bảng trên và file `.sql` không thể lệch nhau mà test vẫn xanh.

### 13.8 Số liệu snapshot thật — chép lại từ `data/snapshot-20260824.json` (file đã xoá)

Nguồn: `file tai xuong tu google sheet.xlsx`, SHA-256 `c5d560af…9efd12`, 96 KB — vẫn nằm ngoài kho.
Bản snapshot JSON và `dump-sheets.js` **đã bỏ** 2026-08-25 (§13.4 mục 11) vì chứa email và mật
khẩu văn bản thuần thật. **Mục này là bản ghi duy nhất còn lại** của những gì đã đọc được, nên
đừng xoá gọn nó khi dọn kế hoạch.

| Sheet trong Sheets | Tên trong `.xlsx` | Số dòng | Số cột |
|---|---|---|---|
| Người dùng | Người dùng | 5 | 10 |
| Phòng | Phòng | 4 | 7 |
| Dự án/Nhiệm vụ | **`Dự ánNhiệm vụ`** (mất dấu `/`) | 2 | 15 |
| Đề nghị | Đề nghị | 1 | 11 |
| Quản lý App | Quản lý App | 0 | 8 |
| Chat | Chat | 1 | 3 |
| Thông báo | **không tồn tại** | — | — |
| Nhiệm vụ | không tồn tại (đã biết trước) | — | — |

Dữ liệu ít ⇒ **Phase 2 nhẹ hơn dự kiến**, nhưng phải chính xác vì không có chỗ để sai:

- 4 phòng: `PH01 Quản lý Đào tạo` (thứ tự 1), `PH02 Nghiên cứu Khoa học`, `PH03 Kế toán`,
  `PH04 Hành chính Nhân sự`. Chỉ PH01 có Email Phó GĐ phụ trách; cột Trưởng phòng và Phó phòng
  **rỗng hết** ⇒ `department_managers` chỉ có 1 dòng thật.
- 5 người dùng, mã `NV001, NV004, NV005, NV006, NV007` — **có lỗ**, đừng suy ra mã liên tục.
- Giá trị `Phân quyền` thật: `Admin` (chữ A hoa!), `Nhân viên`, `Phó Giám đốc`. `Admin` **không
  khớp** CHECK `users_role_valid` (chờ `'admin'`) ⇒ Phase 2 phải chuẩn hoá hoa/thường cho vai trò
  và **in ra từng dòng đã đổi**.
- `Vai trò phòng` chỉ có `''` và `Nhân viên`. `Phòng` chỉ có `''` và `Quản lý Đào tạo` — nhập
  theo **tên** phòng, phải dò sang `departments.name` chứ không phải mã.
- Mật khẩu: **văn bản thuần**, dài 4 / 0 / 0 / 9 / 3 ký tự. Có **2 người mật khẩu rỗng** ⇒ Phase 2
  phải sinh mật khẩu tạm ngẫu nhiên, đặt `must_change_password = true`, in danh sách ra cho người
  dùng phát lại. Không được để tài khoản không mật khẩu.
- 2 công việc `DA001`, `DA002`; cột `Trạng thái duyệt` **rỗng** cả hai ⇒ Phase 2 gán `'Đã duyệt'`
  (dữ liệu cũ đang dùng, không thể bắt đi duyệt lại).
- `Nhiệm vụ JSON`: DA001 có 3 nhiệm vụ, DA002 rỗng. **0 ô JSON hỏng** trong file này — vẫn giữ
  nguyên đường xử lý ô hỏng, vì file thật lúc cắt chuyển có thể khác.
- Khoá thật trong mỗi nhiệm vụ (15 khoá): `Mã nhiệm vụ, Tên nhiệm vụ, Mô tả nhiệm vụ,
  Người thực hiện, Trạng thái, Ưu tiên, Ngày bắt đầu, Hạn chót, Tiến độ (%), Ngày hoàn thành,
  Mục tiêu, Link kết quả, Kết quả đầu ra, Ghi chú, Nhắc việc`.
  **KHÔNG có `Cấp`, KHÔNG có `Mã cha`** ⇒ dữ liệu cũ là cây **2 tầng**, chưa từng dùng cấp 3.
  Quyết định nhập chúng thành cấp mấy: §13.4 mục 8.
- Mã nhiệm vụ thật đều dạng `ID260824081007935` (`ID<yymmddhhmmssSSS>`) — giữ nguyên khi nhập.
- `Người thực hiện` và `Quản lý dự án` lưu **họ tên**, không phải email ⇒ dò người theo tên,
  không dò ra thì để `assignee_id = NULL` + giữ `assignee_name`, và **ghi vào báo cáo**.
