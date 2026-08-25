-- 004_countable_views.sql — hai view "được phép đếm" (§7 việc 5.4, TC-APR-06).
--
-- RỦI RO LỚN NHẤT CỦA PHASE 5 KHÔNG PHẢI VIẾT NÚT DUYỆT MÀ LÀ SÓT MỘT CHỖ ĐẾM.
-- Bản Apps Script đếm thẳng trên dải ô, nên mỗi thẻ số và mỗi biểu đồ tự viết lại điều kiện lọc
-- của riêng nó. Thêm một trạng thái mới («Chờ duyệt») vào cách làm đó nghĩa là phải sửa đúng
-- ~20 chỗ và không sót chỗ nào — không có cách nào kiểm được là đã đủ.
--
-- Ở đây làm ngược lại: điều kiện viết MỘT lần, trong hai view dưới đây. Mọi truy vấn thống kê
-- đọc `v_countable_works` / `v_countable_items` thay vì `works` / `work_items`; test §8.4 nhóm E
-- chạy EXPLAIN trên từng truy vấn thống kê để chứng minh nó thật sự đi qua view. Sót một chỗ
-- không còn là "quên một điều kiện" (im lặng) mà là "đọc thẳng bảng gốc" (test bắt được).
--
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- Vì sao `v_countable_items` KHÔNG chỉ lọc `approval_status` của chính dòng đó
--
-- Nhiệm vụ cấp 3 LUÔN `Đã duyệt` (§7 việc 5.1) — không có bước duyệt cho cấp 3. Nếu view chỉ
-- soi cột của chính dòng thì mọi nhiệm vụ đều lọt, kể cả nhiệm vụ nằm trong một Công việc đang
-- `Chờ duyệt`. Nghĩa là: Trưởng phòng lập một công việc chờ duyệt, thêm 5 nhiệm vụ vào đó, và
-- 5 nhiệm vụ ấy cộng ngay vào thẻ "Tổng nhiệm vụ" dù cả công việc chưa ai duyệt. Đó chính là
-- kiểu sót mà TC-APR-06 canh, chỉ khác là nó núp một tầng.
--
-- Nên điều kiện đúng là: dòng được đếm khi **cả nhánh trên nó** đã qua cửa duyệt — bản thân nó,
-- Công việc cấp 1 chứa nó, và (với cấp 3) Công việc con cha của nó. Cây chỉ có 3 tầng nên viết
-- thẳng hai phép JOIN, không cần đệ quy.
--
-- Chiều ngược lại (`Từ chối`) thì VẪN đếm: mục bị từ chối là dữ liệu có thật, đã có quyết định,
-- và bản cũ vẫn hiện nó. Chỉ `Chờ duyệt` — thứ chưa ai xác nhận — mới bị loại.

-- Up Migration

CREATE VIEW v_countable_works AS
  SELECT * FROM works
   WHERE approval_status <> 'Chờ duyệt';

CREATE VIEW v_countable_items AS
  SELECT i.*
    FROM work_items i
    JOIN works w  ON w.id = i.work_id
    LEFT JOIN work_items p ON p.id = i.parent_id
   WHERE i.approval_status <> 'Chờ duyệt'
     AND w.approval_status <> 'Chờ duyệt'
     AND (p.id IS NULL OR p.approval_status <> 'Chờ duyệt');

COMMENT ON VIEW v_countable_works IS
  'Công việc cấp 1 được phép vào thống kê: bỏ các mục Chờ duyệt (§7 việc 5.4).';
COMMENT ON VIEW v_countable_items IS
  'Công việc con / nhiệm vụ được phép vào thống kê: bỏ mục Chờ duyệt và mọi dòng nằm dưới một mục Chờ duyệt.';

-- `works` đã có idx_works_dept_approval; `work_items` thì chưa có đường nào đi theo khoá duyệt.
-- Bộ lọc của view chạm cột này trên MỌI truy vấn thống kê, nên đánh chỉ mục một phần cho đúng
-- phần nhỏ bị loại (số dòng `Chờ duyệt` luôn ít hơn hẳn số dòng đã duyệt).
CREATE INDEX idx_work_items_pending ON work_items (work_id)
  WHERE approval_status = 'Chờ duyệt';

-- Down Migration

DROP INDEX IF EXISTS idx_work_items_pending;
DROP VIEW IF EXISTS v_countable_items;
DROP VIEW IF EXISTS v_countable_works;
