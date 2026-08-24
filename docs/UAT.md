# Nghiệm thu (UAT) — bản VPS

Đây là bản in ra để **tích tay khi ngồi trước máy**, không phải test tự động. Mỗi dòng là một
mã tính năng trong §2 của `KE-HOACH-VPS.md`. Bản VPS chỉ được cắt chuyển khi **tất cả** ô dưới
đây đã tích, hoặc mục chưa tích đã được ghi rõ lý do hoãn ở §13.4.

Cách dùng:

1. Chạy trên môi trường staging có dữ liệu đã nhập thật (Phase 2 chạy xong), không dùng dữ liệu bịa.
2. Đăng nhập lần lượt bằng **6 vai trò** rồi mới tích: `admin`, `Phó Giám đốc`, `Trưởng phòng`,
   `Phó phòng`, `Quản lý dự án`, `Nhân viên`. Nhiều lỗi phân quyền chỉ hiện ra ở vai trò thấp.
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
- [ ] **M2** Nhập dữ liệu từ Google Sheets; **chạy lại lần 2 không nhân đôi, không hỏng** dữ liệu.
- [ ] **M3** Sao lưu tự động hằng ngày **và** đã thử phục hồi thành công một lần từ bản sao lưu.
- [ ] **M4** `/healthz` trả 200 cho Nginx; `/readyz` trả 503 khi tắt cơ sở dữ liệu.

---

## Ghi chú nghiệm thu

| Ngày | Mã | Hiện tượng | Đã xử lý |
|---|---|---|---|
| | | | |


