-- 019: sửa view UAT cũ dù pgmigrations đã ghi nhận 018.
-- SELECT * được PostgreSQL đóng băng lúc tạo view. OR REPLACE bổ sung cột cuối
-- mà không xoá view/phụ thuộc/quyền, không ghi lại dữ liệu hoặc chia lại ty_le.
-- Giữ nguyên điều kiện duyệt của 018 (kể cả mục đang xin xoá vẫn được đếm).

-- Up Migration

CREATE OR REPLACE VIEW v_countable_works AS
  SELECT * FROM works
   WHERE approval_status NOT IN ('Chờ duyệt','Nháp');

CREATE OR REPLACE VIEW v_countable_items AS
  SELECT i.*
    FROM work_items i
    JOIN works w ON w.id = i.work_id
    LEFT JOIN work_items p ON p.id = i.parent_id
   WHERE i.approval_status NOT IN ('Chờ duyệt','Nháp')
     AND w.approval_status NOT IN ('Chờ duyệt','Nháp')
     AND (p.id IS NULL OR p.approval_status NOT IN ('Chờ duyệt','Nháp'));

-- Down Migration

-- 018 đã yêu cầu đủ cột ty_le: lùi 019 vẫn giữ view hợp lệ, không tái tạo lỗi.
SELECT 1;
