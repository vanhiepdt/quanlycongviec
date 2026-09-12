# Báo cáo kiểm tra và đợt V1–V8 — 10/09/2026

Chưa nghiệm thu, chưa commit/push/deploy. Nhánh vps/sua-loi-vat. Giữ nguyên dữ liệu UAT và các thay đổi đợt trước.

## Bốn yêu cầu mới sau V1–V8 — hoàn thành từ kết quả đã duyệt, 10/09/2026

**Đã sửa mã, chưa nghiệm thu PC; không commit/push/deploy.** Checklist mới: **9b.18**.

1. Bỏ checkbox Hoàn thành nhiệm vụ. Hoàn thành khi có nhóm kết quả và **mọi nhóm có bản đã duyệt**
   (`hoan-thanh`/`da-duyet`); chưa có file hoặc có nhóm tỷ lệ 0 chưa duyệt vẫn chưa hoàn thành.
2. Bỏ trạng thái nhập tay và bộ lọc bốn lựa chọn ở công việc cha/con/nhiệm vụ. Dùng chỉ báo đọc-only
   Đã duyệt đủ / Chưa duyệt đủ kết quả; giữ riêng trạng thái phê duyệt và nhật ký lịch sử.
3. Tỷ lệ công việc (%) và Tiến độ thành hai cột riêng trong bảng file 10 cột. Hàng bản/panel đã căn lại;
   tăng bề rộng tối thiểu để ô số không bị che trên modal hẹp. Ngày nhập tay đổi nhãn Ngày báo cáo.
4. Tab Nhiệm vụ hiện từng nhóm file dưới nhiệm vụ, bỏ Link kết quả; tìm theo tên file giữ nguyên cả nhóm.
   Sau thao tác file, nạp lại dữ liệu để bảng và bộ đếm cập nhật mà không cần F5.

**Nguồn số liệu:** `taskFiles/repo.js` lấy metadata theo lô; `workItems/tienDo.js` gắn tiến độ và cờ
hoàn thành, độc lập với phần trăm. Bootstrap/stats/Gantt/works/workItems/export/cron cùng dùng kết quả
file; thời điểm thống kê từ lần duyệt bản mới nhất. `tong/xong` giữ nghĩa cũ, thêm `daDuyetCoBan`.
Cấp 2/1 hoàn thành khi có con và mọi con hoàn thành, kể cả trọng số 0. Không migration mới.
DB/RPC giữ status/completion cũ để tương thích, nhưng `boCotKhoaDuyet` ngừng ghi các giá trị tay.
RPC vẫn 37 hàm, chỉ thêm `hoanThanh`, `hoanThanhLuc`, `ketQuaFiles` và tiến độ ở dữ liệu trả về.

**Lỗi phát hiện qua trình duyệt:** thẻ Công việc CV001 từng hiện 37% do lấy trung bình cả cấp 2+3,
trong khi công thức gia quyền cho 0% (trọng số con của dữ liệu này là 0). CV002 từng hiện 12%, đúng
là 7%. Đã sửa `createProjectCard`, `renderStatListItems`, modal fallback và Gantt legacy dùng nguồn
gia quyền; không sửa dữ liệu tỷ lệ để che lỗi. `TC-KQ-UI-06` kiểm ba bề mặt, ví dụ 25×40 + 75×80
chia 100 phải ra 70%. Bộ test ban đầu quên bật showDetails của card; đã sửa fixture đó, không nới assertion.

### Kiểm chứng tự động đợt bổ sung

| Lượt | Kết quả |
|---|---|
| Baseline trước đợt bổ sung | 1946/1946, 108 file; XSS 107/920; buster 20260910-7 |
| Test mới trước sửa nghiệp vụ | 7/7 đỏ đúng lỗi cần sửa |
| Focused rộng / bổ sung | 393/393 và 58/58 xanh |
| Full đầu | 1954/1958, 106/110 file; 4 ca fixture/nhãn còn theo trạng thái tay |
| Focused nhật ký và yêu cầu mới | 56/56 xanh |
| Focused bố cục/XSS | 72/72 xanh |
| Full sau sửa bốn ca cũ | 1958/1958, 110/110 file, exit 0 |
| Focused sửa phép tính còn sót | 89/89 xanh |
| **Full cuối sau sửa phép tính** | **1961/1961, 110/110 file, exit 0** |
| Sau định dạng lại riêng test UI | 8/8 xanh; không đổi mã nghiệp vụ |
| Lint / cú pháp app.js | exit 0 / exit 0 |
| Format | exit 1, chỉ hai nợ cũ: workItems/tyLe.js và stats-parity.test.js |
| XSS / asset live | **98 sink / 929 nội suy**; **20260910-10**, exit 0 |

**Phân loại bốn test cũ đỏ:** `nhat-ky-ca-cay` và `work-origin-history` dùng status/completion
làm trường chỉnh sửa để sinh `changes`; nay các trường này không còn ghi nên chuyển fixture sang
priority/description vẫn được phép sửa, tiếp tục kiểm đúng from→to. `hoat-dong-ui` đổi nhãn lịch sử;
`pending-badge` giữ nhãn Chờ duyệt cạnh chỉ báo duyệt kết quả, không khôi phục Đang thực hiện.
`stats-parity.test.js` đối chiếu cờ/thời điểm hoàn thành từ file thay cho status tay; đã sửa nội dung
đối chiếu nhưng **không format nợ cũ**. Không sửa `workItems/tyLe.js`.

Log/JSON trong `server/node_modules/.vite/vitest/` (ignored): `result-full-final.{json,log}`,
`result-history-focused.*`, `result-progress-red.*`, `result-progress-green-2.*`, `result-ui-final.*`,
`result-lint-final.log`, `result-format-final.log`. XSS giảm 9 sink do chuyển 9 thẻ số sang textContent;
nội suy tăng ròng 9 do hàng file/cột/metadata mới. Chi tiết an toàn ở `docs/XSS-4.6.md`.

### Kiểm trực quan và dữ liệu UAT

- Dùng trình duyệt in-app, phiên sẵn có **Lê Thị Nhân**, chỉ xem/mở/đóng/tìm/đổi tab, không lưu.
  Nhiệm vụ tháng 9 hiển thị 5 nhiệm vụ: 1 duyệt đủ, 4 chưa đủ; từng nhóm có hàng con, không Link/checkbox.
- NV-02: 10 tiêu đề, tỷ lệ 100 trong ô riêng (đo rộng 104px), tiến độ 50% cột kế bên;
  bung bản 1.1 đúng 10 ô; panel colspan 10. Đã xem ảnh bố cục thật, bảng có cuộn ngang.
- Chi tiết công việc cha/con hiển thị nguồn file; tab Công việc không còn bộ lọc bốn trạng thái;
  tiến độ thẻ sau sửa là CV001 0%, CV002 7%, thay 37%/12% từ trung bình sai.
- Tổng quan và Gantt tải được, không lỗi JavaScript trong phiên kiểm. Form tạo/sửa đủ ba cấp được
  kiểm bằng jsdom; **chưa bấm trọn luồng ghi/duyệt bằng nhiều vai trên trình duyệt trong đợt này**.
- Node UAT PID **35656**, mở **17:59:42 ngày 10/09/2026 (UTC+7)**; DB quanlycongviec_uat:5432,
  cron/Zalo tắt. Buster **20260910-7 → -8 → -9 → -10**; backend không migration mới.
- Snapshot trước/sau không hoàn toàn giống nhau: works 2, items 12, versions 14, comments 4,
  approval_changes 1; files **8 → 10**, flow **26 → 28**. Hash works/versions/comments/approval_changes
  giữ nguyên; hash items/files/flow thay đổi. Các nhóm mới 10/11 do **user 2 (Phó Giám đốc)** tạo
  lúc **18:13:53/18:14:19**, khác phiên Nhân viên dùng để kiểm. Không reset/seed/khôi phục đè dữ liệu;
  không được lấy baseline cũ để tuyên bố toàn bộ UAT không đổi. Snapshot: `result-uat-before/after.json`.
- Giữ giới hạn của V1–V8: chuỗi sửa → forcesave → callback → duyệt với DS thật chưa được nghiệm thu.
  Checklist **9b.15/9b.16/9b.17/9b.18** đều cần người dùng xác nhận riêng.

## Snapshot V1–V8 trước bốn yêu cầu mới — 10/09/2026

**1946/1946 test, 108/108 file, exit 0; lint exit 0.** Format chỉ còn hai nợ cũ được yêu cầu giữ nguyên.
UAT đã UP 024–027, dữ liệu nghiệp vụ cũ không đổi; readyz và kiểm asset live xanh.
Buster **20260910-7**, XSS **107/920**. Đã kiểm bố cục OnlyOffice thật; chưa nghiệm thu toàn bộ
chuỗi lưu/duyệt với DS thật và checklist 9b.17. Chi tiết kết quả, giới hạn và migration ở cuối báo cáo.
Các bảng Phần A dưới đây giữ đúng quan sát **trước sửa**, không phải kết quả sau bản mới.

## Phần A — ghi trước khi sửa mã

- Full `npm test`: 1868 đạt / 1869 test; 103 đạt / 104 file; mã thoát 1; thời gian 202,79 giây.
- Ca đỏ: task-form-candidate.test.js, “cán bộ tự sửa nhiệm vụ của mình vẫn bị khóa ô Người thực hiện”: disabled thực tế false, kỳ vọng true. Chạy riêng file ngay sau đó: 17/17 đạt, mã thoát 0; trình duyệt thật nv1@ có ô khóa. Phân loại ban đầu: nghi nhiễu timer của fixture; cần chốt bằng sửa cách cô lập, giữ expectation.
- TC-LDTT-A (10 ca), TC-LDTT-01..05 đều đạt trong full suite. Ba luật chủ ý A5 được giữ ở mốc đầu.
- Pin XSS: 107 sink / 904 nội suy. Buster index, banner và nginx 8099: 20260909-5. local-assets-check --live thoát 0; readyz ok/db up.
- pgmigrations UAT có 001..023; không reset/seed. UAT đã có dữ liệu người dùng thêm ngoài seed.
- Giới hạn phiên: trình duyệt điều khiển hiện chỉ có IAB; thử Chrome nhận “Browser is not available: chrome”; localhost:8099 trả Welcome to nginx. Chưa thực hiện được thử hai cookie đồng thời.
- Các dòng KHÔNG KIỂM ĐƯỢC dưới đây là phần kiểm tay chưa hoàn tất, không được hiểu thành đạt nhờ test tự động.

### 9b.1

| Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|
| 1 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 2 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 3 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |

### 9b.2

| Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|
| 1 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 2 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 3 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 4 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |

### 9b.3

| Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|
| 1 | ĐẠT | gd@, CV002-005: mở editor bản 14, tài liệu thật hiện. Đây là đối chứng trên file người dùng đã nộp, không phải đủ chuỗi TP ở NV-01. |
| 2 | KHÔNG ĐẠT | gd@, CV002-005, bản 14: có tên, Lưu thành bản mới, Đóng; ô Ghi ý kiến bị disabled và che toolbar (quan sát ảnh). |
| 3 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 4 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |

### 9b.4

| Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|
| 1 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 2 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 3 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 4 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 5 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |

### 9b.5

| Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|
| 1 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |

### 9b.6

| Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|
| 1 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 2 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 3 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 4 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 5 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 6 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 7 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 8 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |

### 9b.7

| Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|
| 1 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 2 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 3 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |

### 9b.8

| Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|
| 1 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 2 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 3 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 4 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 5 | ĐẠT | gd@: bảng phẳng đủ 8 cột, ba cấp công việc hiện cùng dòng; đã mở menu dòng cuối. |

### 9b.9

| Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|
| 1 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 2 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 3 | ĐẠT | gd@: hàng chờ hiển thị tên kết quả, số bản, tên bản mới nhất; CV002-005 có 7 bản. |

### 9b.10

| Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|
| 1 | ĐẠT | gd@, tạo nhiệm vụ trực thuộc CV001: đủ 8 cột, dòng 1, Chưa có, Sẽ gửi khi lưu nhiệm vụ. |
| 2 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 3 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 4 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 5 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 6 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |

### 9b.11

| Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|
| 1 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 2 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 3 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 4 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 5 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 6 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |

### 9b.12

| Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|
| 1 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 2 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 3 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 4 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 5 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 6 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |

### 9b.13

| Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|
| 1 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 2 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 3 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 4 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 5 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 6 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 7 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 8 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 9 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 10 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |

### 9b.14

| Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|
| 1 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 2 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 3 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 4 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 5 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |

### 9b.15

| Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|
| 1 | KHÔNG KIỂM ĐƯỢC | Chưa thực hiện đủ hai phiên tách cookie; không dùng integration thay cho kiểm tay. |
| 2 | KHÔNG KIỂM ĐƯỢC | Chưa thực hiện đủ hai phiên tách cookie; không dùng integration thay cho kiểm tay. |
| 3 | KHÔNG KIỂM ĐƯỢC | Chưa thực hiện đủ hai phiên tách cookie; không dùng integration thay cho kiểm tay. |
| 4 | KHÔNG KIỂM ĐƯỢC | Chưa thực hiện đủ hai phiên tách cookie; không dùng integration thay cho kiểm tay. |
| 5 | KHÔNG KIỂM ĐƯỢC | Chưa thực hiện đủ hai phiên tách cookie; không dùng integration thay cho kiểm tay. |
| 6 | KHÔNG KIỂM ĐƯỢC | Chưa thực hiện đủ hai phiên tách cookie; không dùng integration thay cho kiểm tay. |
| 7 | KHÔNG KIỂM ĐƯỢC | Chưa thực hiện đủ hai phiên tách cookie; không dùng integration thay cho kiểm tay. |
| 8 | ĐẠT | gd@, CV001: ba ô tách riêng; Ban lãnh đạo có PGĐ/GĐ, lãnh đạo phòng có TP/PP. |
| 9 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 10 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 11 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 12 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 13 | KHÔNG ĐẠT | gd@, form chưa lưu dưới CV001: bỏ trống người thực hiện rồi bấm Lưu tạm. Câu nguyên văn của trình duyệt: “Please select an item in the list.” Không tạo dòng. Chưa kiểm nút Gửi đi duyệt. |
| 14 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 15 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 16 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 17 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 18 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 19 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 20 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 21 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 22 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 23 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 24 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 25 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 26 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 27 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 28 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 29 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 30 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 31 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 32 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 33 | KHÔNG KIỂM ĐƯỢC | Chưa thực hiện đủ hai phiên tách cookie; không dùng integration thay cho kiểm tay. |
| 34 | KHÔNG KIỂM ĐƯỢC | Chưa thực hiện đủ hai phiên tách cookie; không dùng integration thay cho kiểm tay. |
| 35 | KHÔNG KIỂM ĐƯỢC | Chưa thực hiện đủ hai phiên tách cookie; không dùng integration thay cho kiểm tay. |
| 36 | KHÔNG KIỂM ĐƯỢC | Chưa thực hiện đủ hai phiên tách cookie; không dùng integration thay cho kiểm tay. |
| 37 | KHÔNG KIỂM ĐƯỢC | Chưa thực hiện đủ hai phiên tách cookie; không dùng integration thay cho kiểm tay. |

### 9b.16

| Bước | Kết quả | Bằng chứng / lý do |
|---|---|---|
| 1 | ĐẠT | gd@, CV001/PH01: nhãn Người thực hiện trực tiếp có dấu bắt buộc. |
| 2 | ĐẠT | gd@, CV001: có nv1/nv2 và TP/PP kèm vai; không có PGĐ/GĐ trong ô người thực hiện. Có cả nhân viên PH02 trong danh sách admin; máy chủ vẫn phải kiểm phòng. |
| 3 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 4 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 5 | ĐẠT | nv1@, CV001-002: ô người thực hiện disabled, giữ Lê Thị Nhân trên trình duyệt thật. |
| 6 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 7 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 8 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 9 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 10 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 11 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 12 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 13 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 14 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 15 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 16 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 17 | KHÔNG KIỂM ĐƯỢC | Chưa thực thi trọn chuỗi thao tác của bước này trên UAT trước khi sửa mã; chỉ có đối chứng tự động khi test tương ứng đạt. |
| 18 | KHÔNG KIỂM ĐƯỢC | Seed có PGĐ phụ trách PH01+PH02, không có phòng đối chứng; 10 TC-LDTT-A trong full test đạt, không coi là nghiệm thu bằng tay. |

## Chỗ tài liệu cũ khác hành vi đã chốt

9b.13 bước 9 nói TP/PP với ✓ tự da-duyet; mốc 9b.16 đã thay bằng luôn chờ Phó GĐ. 9b.1/9b.4 có mô tả cũ về PDF và hàng chờ Cán bộ; phải đọc kèm các đợt sau. Không sửa luồng theo kỳ vọng đã hết hiệu lực.

## V1 — nguyên nhân đã tái hiện

TC-V1-01: TP tạo cấp 2 Nháp leader=[TP], PATCH [TP,PP] trả 200 và lưu cả hai. HTTP 400 thực tế là BAD_REQUEST từ taskFiles.mustFindNhiemVu, do createTaskModal gọi napKetQua cho cả cấp 2, kéo theo GET /work-items/:ref/files. Câu gốc: “Chỉ NHIỆM VỤ (cấp 3) mới nộp được file kết quả — công việc/công việc con không có kết quả file”. restGet che câu này thành HTTP 400. Đã chặn lời gọi file ở cấp 2 và đọc error.message; giữ kiểm phân công và CHECK cấp 3. Hai test jsdom đã đỏ trước sửa.

## V8 — bằng chứng trước khi đổi máy trạng thái

TC-V8-01 trên Postgres thật: NV nộp có trạng thái cho-xem, thông báo TP, nằm hàng chờ TP và không nằm hàng chờ PGĐ. TP nộp bản tiếp của cùng nhiệm vụ NV thì cho-lanh-dao, hàng chờ PGĐ. Trên UAT, file 7 thuộc CV002-005 giao nv1 nhưng dòng thông báo 13 ghi TP nộp bản 1, dòng 23 ghi TP gửi bản mới nhất; đây là luồng lên PGĐ đúng theo vai người nộp. leader_ids={3}=TP; permission_overrides file trống. Giao diện admin thấy “đang đợi Phó Giám đốc/Giám đốc”, khớp CSDL. Chưa có bằng chứng để kết luận lỗi định tuyến NV gửi thẳng PGĐ trong dữ liệu này; không đổi luồng theo phỏng đoán. Test giữ riêng hai người nộp để bảo vệ V4/V7.


## V2 — tỷ lệ nhóm file và tiến độ gia quyền

Migration 024 thêm `task_files.ty_le` và `ty_le_tu_dong`; nhóm mới chia đều, phần dư theo id.
Tỷ lệ sửa tay không bị lần thêm/xóa kế tiếp ghi đè. Tổng khác 100% vẫn lưu sau cảnh báo ở giao diện.
Tiến độ nhiệm vụ = Σ(tỷ lệ nhóm × mốc nhóm) / Σ(tỷ lệ nhóm); nhóm chưa có bản và Lưu tạm mặc định 0%.
**Quyết định tương thích:** `tong/xong` ở repo vẫn đếm nhị phân số nhóm; chỉ thêm tổng trọng số
để tính tiến độ cây/Gantt/thống kê. Không đổi nghĩa trường RPC cũ và không đếm số phiên bản.

Migration 027 lưu mốc trong `system_settings`; đọc có mặc định cứng, không cache theo phiên.
Chỉ admin ghi, kiểm số 0–100 và thứ tự không giảm trong từng nhánh; áp dụng ở request kế tiếp.
`TC-V2-01..06` và `file-progress.test.js` kiểm mốc, tỷ lệ tay, cạnh tranh cập nhật, thiếu bản và số giả.
Các số kiểm thử cũ thay đổi có chủ ý được giải thích riêng ở phần hồi quy bên dưới.

| Mốc mặc định | % |
|---|---:|
| Chưa có bản / Lưu tạm | 0 |
| Cần sửa | 20 |
| Cán bộ gửi TP/PP, có tích Gửi BLĐ | 40 |
| Cán bộ gửi TP/PP, không tích Gửi BLĐ | 50 |
| TP/PP tự làm hoặc nộp hộ, đang chờ PGĐ | 50 |
| TP/PP đã kiểm và trình PGĐ/GĐ | 80 |
| Đã duyệt / Hoàn thành | 100 |

## V3 — kiểm định dạng ở mọi cửa ghi mới

Hàm chung `kiemDinhDangNhom` dùng ở tải file/tạo nhóm, báo cáo, save và callback editor.
Đuôi lạ không được đoán thành Word. OnlyOffice chỉ sửa Word/Excel/PPT; PDF chỉ xem.

| Nhóm | Bản mới được nhận |
|---|---|
| Word | .doc, .docx |
| Excel | .xls, .xlsx |
| PPT | .ppt, .pptx |
| PDF | .pdf; chỉ xem, không forcesave |
| Ảnh | .jpg, .jpeg, .png, .gif, .webp; không SVG |
| Báo cáo | Chữ nhập trực tiếp, không nhận file vật lý |

**Giả định:** chọn phạm vi hẹp cho Ảnh/Báo cáo như bảng trên. Không hồi tố chặn bản cũ sai định dạng:
vẫn xem/tải lịch sử, chỉ từ chối bản ghi mới không khớp. `TC-V3-01..04`, `TC-V3-UI-01`
kiểm ba cửa ghi và PDF. V3 không cần migration.

## V4 — Lưu tạm và Gửi đi duyệt là hai thao tác

Migration 025 nới CHECK trạng thái/hành động và mặc định nhóm `luu-tam`.
Quyền `file:submit` nằm ngoài bốn ACTIONS gốc, có trong ma trận và giao diện phân quyền.
Không đổi lịch sử đã nộp. Tải file/báo cáo lưu tạm không thông báo; ở hàng chờ chỉ người tạo nhóm
và admin thấy nháp. Khi gửi, khóa giao dịch và `versionId` chống gửi bản cũ; hai request cạnh tranh
chỉ một request thành công. Luồng căn cứ người lưu bản cuối, không tự nâng quyền vì admin gửi hộ.
⏳ buộc duyệt dù NV có `file:create=✓`; TP/PP vẫn luôn lên PGĐ, không tự chốt.

Q5 được giữ: bản để đáp ứng lệnh sửa đi thẳng theo lệnh, không qua Lưu tạm. Lưu trong editor
không tự thay nghĩa lệnh. **Lỗi thật `TC-V4-09`:** chỉ đọc sự kiện nộp/trình cũ khiến bản mới của TP
bị tính 80% thay 50%; repo nay xét cả `luu-tam/gui-duyet` để nhận diện lượt hiện tại.

Test cũ `task-files-api` tách helper lưu với helper lưu-rồi-gửi bằng HTTP thật, không giả response.
`TC-LS-07` giữ đối chứng dữ liệu lịch sử chưa có bản. `TC-LS-10` tái tạo CHECK trước 020 trong
transaction DB `_test`, bỏ hành động mới khỏi fixture rồi rollback; không sửa migration 020,
không chạy down 025. Các luật TC-LDTT vẫn được giữ trong full suite.

## V5 — nguyên nhân ở cả giao diện và cửa ghi máy chủ

- `cauTinhTrangFile` ghi cứng “Cán bộ”; `cauTinhTrangHangCho` bỏ lịch sử nên số lần trả lại bằng 0.
- **Không chỉ lỗi giao diện:** `laChuLenhSua` nhận đúng assignee là TP/PP, nhưng
  `duocSuaTrucTiep`/`chanTpPpKhongPhuTrach` chỉ chấp nhận `leader_ids`. `TC-V5-03` cho hai vai
  TP/PP khác lãnh đạo phụ trách đều đỏ trước sửa: có lệnh thật nhưng `duocSua=false/duocGui=false`.
- Cửa ghi dùng `duocGhiTheoPhanCong`: người thực hiện hoặc lãnh đạo phụ trách được sửa/gửi theo
  quyền; cửa verdict/góp ý vẫn kiểm lãnh đạo phụ trách, không nới tự Hoàn thành.
- Chỉ thêm `nguoiNhan`, `nguoiNhanChiTiet`, `soTraLai`; tên dùng `nhanKemVai` và escape khi dựng HTML.
  Modal và hàng chờ hiển thị cùng số lần trả lại, đúng tên và vai người đang phải sửa.
- `TC-V5-01..03` (5 ca), `TC-V5-UI-01/02` (3 ca) xanh sau sửa.

## V6 — bố cục editor, nhập ý kiến, lưu đúng bản trước duyệt

**Tái hiện trước sửa:** 4 ca integration và 6 ca jsdom đỏ. Khối ý kiến dùng absolute đè toolbar;
textarea chỉ mở cho người gửi lệnh, người duyệt không gõ được; thiếu nút duyệt bản mới.
Kiểm thêm phát hiện verdict chưa ràng buộc `versionId`, callback còn ghi sau khi thu hồi quyền
và có thể thông báo về bản nháp.

HTML máy chủ nay bố trí flex dọc: thanh hành động → khối ý kiến → vùng editor co giãn.
Ý kiến không overlay; lớp chắn đang lưu/khối lỗi chỉ phủ vùng editor. Nút **Phê duyệt bản mới
vừa chỉnh sửa** chạy theo thứ tự:

1. POST save, yêu cầu Document Server forcesave (không gọi phương thức `DocsAPI.save` không có).
2. Callback tải bản đã lưu, kiểm người dùng/phân công/quyền hiện hành và commit phiên bản mới.
3. Nhận receipt `{banId, versionNo}`; chưa có receipt hoặc DS báo không có thay đổi thì không duyệt bản cũ.
4. POST verdict với đúng `versionId` và ý kiến; bản khác chen vào trả 409, quyền thu hồi trả 403.

**Luật đợt 2 không đổi:** TP/PP sửa thành bản của mình chỉ được trình PGĐ, không tự Hoàn thành.
Giao diện nói rõ, yêu cầu ý kiến ít nhất 10 ký tự khi trình. Callback không nhận actor không xác định
hoặc đã vô hiệu hóa; nạp lại vai/phòng/ghi đè/ủy quyền, không thông báo khi lưu nháp.
`TC-V6-01..05` và `TC-V6-UI-01..04` xanh; mạng DS được mock trong integration, CSDL và các route
save/callback/verdict là thật.

**Kiểm trình duyệt thật sau sửa:** Chrome headless, gd@ và tp@ trong hai context riêng, mở bản 14
của CV002-005. Tài liệu thật và toolbar OnlyOffice tải được; đáy khối ý kiến ở y=94, vùng editor
bắt đầu y=94, không chồng lấp. Admin nhập được ý kiến, có nút duyệt bản mới; TP mở editor có ô ý kiến
không khóa và nút lưu. Không sửa nội dung tài liệu và không bấm lưu/duyệt bản người dùng.
**Chưa kiểm trọn chuỗi forcesave → callback → duyệt với DS thật**, không gọi đây là nghiệm thu V6.

## V7 — tích Gửi BLĐ và đề nghị hoãn hiệu lực

Migration 026 thêm `work_items.gui_bld_phe_duyet` boolean mặc định false (CHECK chỉ cấp 3),
`approval_changes.change_kind` (`reviewer/gui-bld`), `decision` (`approved/rejected`),
nới CHECK quyền `task:gui-bld`. Rebuild cả hai view `v_countable_works/v_countable_items`,
giữ nguyên điều kiện loại Nháp/Chờ duyệt. Không thêm người nhận hoặc ô chọn người mới.
Cấp 3 dưới cấp 2 đọc `supervisor_id` của cấp 2; nhiệm vụ trực tiếp dùng supervisor đã chọn/kế thừa
khi tạo. Bật mà thiếu/người không hợp lệ thì chặn trước ghi, kể cả lúc bỏ BLĐ ở cha.

- NV chọn tích lúc tạo; không đổi sau tạo, kể cả mở quyền gui-bld. TP/PP/admin/PGĐ vẫn đi qua `can()`.
- TP/PP mặc định chỉ đề nghị vào **approval_changes**, giá trị hiện hành chưa đổi; nhiệm vụ không
  bị đẩy khỏi thống kê. Dùng chung `/approvals/pending` và pending-count, không thêm hàng chờ riêng.
- Admin bỏ cấu hình Q2: ✓ áp ngay từ request kế tiếp; ⏳ vẫn chờ; ✕ chặn. Đề nghị đã lập không được
  tự áp vì vừa tắt Q2. Người đề nghị không tự duyệt; nếu PGĐ phụ trách tự đề nghị với ⏳ thì admin xử lý.
- Duyệt tại `/approvals/changes/:id/approve|reject`. Từ chối có lý do, **không xóa nhiệm vụ**.
  Kiểm lại actor còn hoạt động/quyền còn hiệu lực và snapshot tích/phân công trước khi chấp thuận.
  Trả lại/gửi lại/duyệt cây không xóa hoặc tự áp đề nghị đổi tích.
- Bật: NV đi TP ở 40%, TP không Hoàn thành mà trình đúng supervisor ở 80%, chốt 100%.
  Tắt: giữ NV → TP ở 50% và TP có thể Hoàn thành 100%; TP nộp hộ vẫn lên PGĐ theo V8/đợt 2.
- **Giả định an toàn:** TP/PP trực tiếp không dùng tích; UI khóa, gửi `true` qua API trả 400.
  Nếu đang bật rồi đổi người thực hiện sang TP/PP, phải tắt (và duyệt tắt nếu cần) trước;
  không âm thầm tắt tích trong cùng lần đổi người.
- `TC-V7-01..15` (16 ca), `TC-V7-UI-01..05` và `TC-V7-RBAC` kiểm tạo/lưu, payload giả,
  ba giá trị quyền, Q2, đúng người/cấp 2, ngoài phòng, cạnh tranh, stale, actor vô hiệu hóa,
  vòng đời duyệt cây và hình dạng RPC.

**Lỗi phát hiện thêm `TC-V2V7-UI-01`:** form cấu hình gửi cả Q2 không đổi, có thể ghi đè lựa chọn
vừa lưu của admin khác. Đã ghi nhớ giá trị gốc, chỉ PUT trường đổi; không có thay đổi thì không PUT.
Test đỏ trước sửa rồi xanh, buster tăng từ `20260910-6` lên `20260910-7`; XSS không tăng.

## Hồi quy cuối — phân loại rồi sửa, không nới luật sản phẩm

Lượt full trước sửa fixture: **1926/1936 test, 101/108 file, exit 1** (10 ca đỏ ở 7 file).
Focused lại 7 file: **314/323**, 9 ca đỏ; ca timer xanh riêng. Cách xử lý:

| File / ca | Nguyên nhân và sửa có giải thích |
|---|---|
| bootstrap | Chỉ thêm `guiBldChanges:0`; giữ các trường bộ đếm cũ. |
| countable-views (2 ca) | Fixture replay 019 phải loại cột thêm sau đó, gồm `gui_bld_phe_duyet` của 026. Giữ snapshot dữ liệu, kiểm đủ cột và rollback DDL; không đổi migration 019. |
| gantt-api | Fixture trước chỉ có nhóm, không có bản nên theo V2 phải 0%. Thêm bản thật trong CSDL, tỷ lệ file 50/50; 100% và 50% → nhiệm vụ 75%. Đầu mục 60/40 với nhiệm vụ trực tiếp 100% → công việc **85%**, thay 70% nhị phân cũ. |
| rpc-bridge TC-RPC-26 | Thêm bản của NV, mỗi nhóm 20%, sự kiện TP trình cho nhóm chờ BLĐ. Mốc 100+100+50+20+80 → **70%**, thay 40% nhị phân. TC-RPC-24 vẫn kiểm ghi `completion=40` cũ; số đọc không lấy completion. |
| rbac-matrix | Thêm `submit` vào ma trận file đúng V4; NV vẫn không approve. Bổ sung kiểm gui-bld/submit nằm ngoài bốn ACTIONS. |
| tai-khoan-ui (3 ca) | V4 và V7 thêm 2 hàng: 19→21, 84 ô quyền, 57 ô phạm vi. “Nộp” tách thành “Lưu kết quả”/“Gửi đi duyệt”; giữ kiểm ⏳ và đối chứng PGĐ. |
| task-form-candidate | Timer thật của ca chỉ parse HTML có thể tác động DOM ca sau khi full chạy chậm. Toàn file dùng fake timers và dọn sau mỗi ca; giữ expectation NV bị khóa. Không thay luật sản phẩm. |

Lint được sửa đúng file đã đụng: khai globals cho test jsdom mới, bỏ escape thừa, const thay let,
hàm trả promise không cần async, mock dùng `Promise.resolve`. Không tắt rule rộng hoặc thêm thư viện.

| Lượt kiểm | Kết quả thực tế |
|---|---|
| Focused 12 file sau sửa fixture/lint | **450/450**, 12/12 file, exit 0 |
| Focused V6/V7 mở rộng và đối chứng | **106/106**, 6/6 file, exit 0 |
| Full `npm test` cuối | **1946/1946**, **108/108 file**, **exit 0**, 211,90 giây |
| `npm run lint` | **exit 0** |
| `npm run format:check` | **exit 1**, chỉ hai nợ cũ `src/modules/workItems/tyLe.js`, `tests/integration/stats-parity.test.js`; không sửa |
| `node tools/dem-xss.mjs` | **107 sink / 920 nội suy** |
| `node tools/local-assets-check.mjs --live` | **exit 0**, nginx 8099 phát đúng index/JS/CSS và health/ready xanh |

Test chạy tuần tự từ `server/`, Postgres `_test`; không focused song song với full.
Báo cáo máy đọc trong `server/node_modules/.vite/vitest/v1-v8-full-final.json` và các file
`v1-v8-focused-fixed.json`, `v1-v8-edges-fixed.json` (artifact cục bộ, không commit).
**Phần A là snapshot trước sửa, không sửa ngược số đỏ thành xanh.** Một lần full xanh sau cô lập
chứng minh lượt kiểm này đạt; không coi đó là bằng chứng mọi tình huống timer đều đã được bao phủ.

## Migration và UAT cục bộ

| Migration | Phạm vi | View |
|---|---|---|
| 024 | `task_files.ty_le`, `ty_le_tu_dong`; chia tỷ lệ các nhóm hiện hữu | Không đổi work_items, không cần rebuild |
| 025 | CHECK/default task_files, hành động task_file_flow, CHECK permission_overrides | Không thêm cột work_items, không cần rebuild |
| 026 | Tích ở work_items, kind/decision ở approval_changes, CHECK quyền gui-bld | **Rebuild cả v_countable_works và v_countable_items** vì SELECT */i.* đóng băng cột |
| 027 | `system_settings` chứa JSON cấu hình, người/thời điểm cập nhật | Không cần rebuild |

Trước lượt phục hồi: nginx còn chạy nhưng `/healthz` trả 502 vì **không có Node lắng nghe cổng 3000**.
Đã kiểm đúng `quanlycongviec_uat` trên localhost:5432, baseline pgmigrations 001–023; chỉ UP đúng
024→025→026→027, không launcher reset/seed hoặc down. Sau UP kiểm đủ cột hai view và so số dòng
cùng dấu vân tay các cột có từ trước. **Dữ liệu cũ không đổi**; chỉ thêm cột/mặc định/tỷ lệ theo migration.

| Bảng | Số dòng trước = sau UP = sau kiểm trình duyệt |
|---|---:|
| users / departments / department_managers | 7 / 2 / 4 |
| works / work_items | 2 / 12 |
| task_files / task_file_versions | 7 / 14 |
| task_file_flow / task_file_comments | 25 / 4 |
| approval_changes / permission_overrides | 1 / 0 |

Node mới phục vụ UAT từ **12:22 ngày 10/09/2026 (UTC+7)**, PID lúc mở **6932**, port 3000.
Không restart container nào, không đụng VPS; tắt cron và nhận Zalo. `/readyz` qua 8099 trả
`{"ok":true,"db":"up"}`. Dấu vân tay các bảng nghiệp vụ kiểm sau trình duyệt vẫn không đổi;
đăng nhập kiểm thử có tạo phiên/audit bình thường, không reset tài khoản hoặc cấu hình.

Chrome headless dùng profile riêng, hai context riêng (gd@/tp@); đã đóng đúng browser kiểm thử,
giữ Node UAT để người dùng bấm. Cấu hình hiển thị đủ 8 mốc và Q2; modal nhiệm vụ có tích và tỷ lệ,
modal cấp 2 không gọi UI file; editor thật tải được. Ảnh/báo cáo cục bộ:
`server/node_modules/.vite/vitest/uat-editor-loaded.png`, `uat-editor-tp-loaded.png`,
`uat-browser-smoke.json`, `uat-after-browser.json`. Không lưu/in JWT, cookie hoặc dữ liệu .env.

## Cache, XSS và giả định còn phải biết

- Buster/banner: **20260909-5 → 20260910-6 → 20260910-7**. Mốc cuối sửa payload cấu hình Q2;
  index và nginx đã xác minh cùng bản. Các mốc trung gian là lịch sử, không yêu cầu người dùng nạp bản cũ.
- XSS: **107/904 → 107/918 → 107/920**. V2/V4 thêm 14 nội suy cho builder tỷ lệ/cấu hình/menu;
  V7 thêm 2 lời gọi builder checkbox/cấu hình vào sink có sẵn. V5 tái dùng escape, V6 HTML máy chủ
  nằm ngoài phép đếm. Sửa payload Q2 cuối không thêm nội suy/sink.
- Ảnh/Báo cáo dùng bảng đuôi hẹp ở V3; không suy định dạng lạ thành Word.
- Tiến độ nhóm dùng trọng số/mốc; bộ đếm `tong/xong` cũ vẫn nhị phân để tương thích.
- TP/PP trực tiếp khóa tích; nếu đang bật, phải duyệt tắt trước khi đổi người thực hiện sang TP/PP.
- Quyền/cấu hình có hiệu lực request kế tiếp; giao diện người khác hỏi lại khoảng 15 giây khi
  đang hiển thị hoặc khi trở về tab. Server luôn kiểm quyền lúc ghi, không tin nút đang mở.

## Chưa hoàn tất / chưa được nghiệm thu

1. Các bước **KHÔNG KIỂM ĐƯỢC** của 9b.1–9b.16 ở Phần A chưa được biến thành ĐẠT.
   Bố cục editor sau sửa đã có đối chứng thật, nhưng không thay cho toàn bộ chuỗi từng bước.
2. Chưa chạy trọn checklist **9b.17** và chưa kiểm forcesave/callback/verdict end-to-end trên DS thật.
   Test tự động dùng mạng DS giả lập; cần người dùng bấm trên file kiểm thử riêng, không file nghiệp vụ.
3. Chưa kiểm tay toàn bộ việc đổi quyền với hai người đang thao tác; chỉ đã mở hai phiên độc lập.
   Seed không có phòng thiếu PGĐ hoặc hai PGĐ để đối chứng sai người: những ca này đã có integration,
   chưa coi là kiểm tay bằng seed.
4. V8 chưa tái hiện được lỗi NV gửi thẳng PGĐ. Bằng chứng đang có cho thấy TP nộp hộ đúng luồng;
   nếu người dùng còn thấy sai cần mã nhiệm vụ/nhóm/bản và đúng người bấm gửi để đối chiếu 4 lớp.
5. Hai nợ format cũ cố ý để nguyên. Không commit, không push, không deploy.

**Dừng ở mốc chờ test PC và “OK RIÊNG ĐỢT NÀY”. 9b.15/9b.16 cũng chưa được nghiệm thu;
OK ngày 08/09/2026 không áp dụng cho các đợt này.**
