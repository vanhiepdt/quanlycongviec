-- 012_approval_draft.sql — trạng thái duyệt thứ tư: «Nháp» (Vòng 13, yêu cầu người dùng 2026-08-31).
--
-- Vì sao cần: công việc cấp 1 do Trưởng/Phó phòng lập rơi THẲNG vào «Chờ duyệt», nên người lập
-- không có lúc nào để thêm công việc con + nhiệm vụ vào trước khi cấp trên nhìn thấy. Người dùng
-- yêu cầu một bước «lưu thôi, chưa gửi đi duyệt, chưa được tính là công việc», sửa lại được, rồi
-- mới bấm gửi duyệt cho CẢ CÂY một lần.
--
-- Ý nghĩa của 'Nháp' — khác 'Chờ duyệt' ở chỗ ai thấy nó:
--   'Nháp'      chỉ NGƯỜI LẬP và admin thấy; không vào thống kê, không vào Gantt, KHÔNG vào hộp
--               chờ duyệt (chưa ai được yêu cầu ký cái gì cả).
--   'Chờ duyệt' cả phòng thấy kèm nhãn vàng, người duyệt thấy trong hộp chờ duyệt.
-- Phần "ai thấy" do `approvals/rules.js` (`thayDuocNhap`) lo — CSDL chỉ giữ giá trị hợp lệ.
--
-- Chỗ duy nhất phải sửa để nháp không lọt vào thống kê là HAI VIEW dưới đây, đúng như thiết kế
-- của 004: điều kiện lọc viết một lần, mọi truy vấn thống kê đọc qua view (test §8.4 nhóm E chạy
-- EXPLAIN để chứng minh). Nếu thay vào đó đi thêm `AND approval_status <> 'Nháp'` ở từng chỗ đếm
-- thì lại về đúng cách làm của bản Apps Script — ~20 chỗ và không kiểm được là đã đủ.
--
-- Tên ràng buộc là tên Postgres TỰ ĐẶT khi 001 khai CHECK inline (`works_approval_status_check`,
-- `work_items_approval_status_check`) — đã soi `pg_constraint` để lấy đúng tên, không đoán.

-- Up Migration

ALTER TABLE works
  DROP CONSTRAINT IF EXISTS works_approval_status_check;
ALTER TABLE works
  ADD CONSTRAINT works_approval_status_check
  CHECK (approval_status IN ('Nháp','Chờ duyệt','Đã duyệt','Từ chối'));

ALTER TABLE work_items
  DROP CONSTRAINT IF EXISTS work_items_approval_status_check;
ALTER TABLE work_items
  ADD CONSTRAINT work_items_approval_status_check
  CHECK (approval_status IN ('Nháp','Chờ duyệt','Đã duyệt','Từ chối'));

-- Hai view: 'Nháp' bị loại y như 'Chờ duyệt', ở CẢ dòng của chính nó và cả nhánh trên nó. Một
-- nhiệm vụ cấp 3 nằm trong công việc còn ở bản nháp thì cũng chưa được đếm — cùng lý do đã ghi
-- dài trong 004 cho 'Chờ duyệt'.
CREATE OR REPLACE VIEW v_countable_works AS
  SELECT * FROM works
   WHERE approval_status NOT IN ('Chờ duyệt','Nháp');

CREATE OR REPLACE VIEW v_countable_items AS
  SELECT i.*
    FROM work_items i
    JOIN works w  ON w.id = i.work_id
    LEFT JOIN work_items p ON p.id = i.parent_id
   WHERE i.approval_status NOT IN ('Chờ duyệt','Nháp')
     AND w.approval_status NOT IN ('Chờ duyệt','Nháp')
     AND (p.id IS NULL OR p.approval_status NOT IN ('Chờ duyệt','Nháp'));

COMMENT ON VIEW v_countable_works IS
  'Công việc cấp 1 được phép vào thống kê: bỏ mục Chờ duyệt và bản Nháp (§7 việc 5.4, 012).';
COMMENT ON VIEW v_countable_items IS
  'Công việc con / nhiệm vụ được phép vào thống kê: bỏ mục Chờ duyệt/Nháp và mọi dòng nằm dưới một mục Chờ duyệt/Nháp.';

-- Chỉ mục một phần của 004 chỉ bắt 'Chờ duyệt'; nới sang cả 'Nháp' vì bộ lọc của view chạm cột
-- này trên MỌI truy vấn thống kê, và số dòng chưa qua cửa duyệt luôn ít hơn hẳn số dòng đã duyệt.
DROP INDEX IF EXISTS idx_work_items_pending;
CREATE INDEX idx_work_items_pending ON work_items (work_id)
  WHERE approval_status IN ('Chờ duyệt','Nháp');

-- Down Migration

-- Hạ dữ liệu TRƯỚC khi siết CHECK: còn một dòng 'Nháp' mà đã thêm ràng buộc cũ thì câu ALTER nổ
-- và cả lượt down đứt giữa. 'Nháp' về 'Chờ duyệt' (không về 'Đã duyệt' — bản nháp chưa ai ký).
UPDATE works      SET approval_status = 'Chờ duyệt' WHERE approval_status = 'Nháp';
UPDATE work_items SET approval_status = 'Chờ duyệt' WHERE approval_status = 'Nháp';

DROP INDEX IF EXISTS idx_work_items_pending;
CREATE INDEX idx_work_items_pending ON work_items (work_id)
  WHERE approval_status = 'Chờ duyệt';

CREATE OR REPLACE VIEW v_countable_works AS
  SELECT * FROM works
   WHERE approval_status <> 'Chờ duyệt';

CREATE OR REPLACE VIEW v_countable_items AS
  SELECT i.*
    FROM work_items i
    JOIN works w  ON w.id = i.work_id
    LEFT JOIN work_items p ON p.id = i.parent_id
   WHERE i.approval_status <> 'Chờ duyệt'
     AND w.approval_status <> 'Chờ duyệt'
     AND (p.id IS NULL OR p.approval_status <> 'Chờ duyệt');

ALTER TABLE work_items
  DROP CONSTRAINT IF EXISTS work_items_approval_status_check;
ALTER TABLE work_items
  ADD CONSTRAINT work_items_approval_status_check
  CHECK (approval_status IN ('Chờ duyệt','Đã duyệt','Từ chối'));

ALTER TABLE works
  DROP CONSTRAINT IF EXISTS works_approval_status_check;
ALTER TABLE works
  ADD CONSTRAINT works_approval_status_check
  CHECK (approval_status IN ('Chờ duyệt','Đã duyệt','Từ chối'));
