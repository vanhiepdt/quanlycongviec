-- 005_phan_cong.sql — Phân công ba lớp trên cây công việc (yêu cầu người dùng ngày 2026-08-26).
--
-- Ba khái niệm mới, đi cùng ba luật nguồn đã chốt với người dùng:
--
--   • Ban lãnh đạo kiểm soát (`supervisor_id`) — MỘT người. Ứng viên: admin hoặc Phó Giám đốc
--     PHỤ TRÁCH phòng của công việc (department_managers role 'deputy_director'). Công việc
--     "Công việc chung" (không phòng) thì ứng viên là mọi Phó GĐ + admin.
--   • Lãnh đạo phòng phụ trách (`leader_ids`) — NHIỀU người. Ứng viên: Trưởng phòng / Phó phòng
--     của phòng đã chọn (department_managers role 'head'/'vice'). Công việc chung ⇒ rỗng.
--   • Nhiệm vụ (cấp 3) chỉ được chọn TỐI ĐA MỘT lãnh đạo phòng phụ trách — CHECK dưới đây là
--     hàng rào cuối; NGUỒN hợp lệ kiểm ở service (assignments/service.js): nhiệm vụ nằm trong
--     công việc con ⇒ phải thuộc `leader_ids` của công việc con đó; nhiệm vụ thuộc công việc
--     cha trực tiếp ⇒ phải thuộc các Phó GĐ phụ trách phòng của công việc.
--
-- Cấp 2 kế thừa Ban kiểm soát + Lãnh đạo phòng của công việc cha lúc TẠO (form điền sẵn, vẫn sửa
-- được — "lãnh đạo phòng không bắt buộc trùng công việc cha" chỉ là KHÔNG bị ép, không phải bị cấm).
--
-- Dữ liệu đang có tự điền theo luật mặc định đã chốt với người dùng cùng ngày:
--   Ban kiểm soát = Phó GĐ phụ trách phòng (hoặc admin nếu công việc chung);
--   Lãnh đạo phòng = TẤT CẢ Trưởng/Phó phòng đang hoạt động của phòng;
--   cấp 2 kế thừa công việc cha; cấp 3 để trống (ô này chọn đúng một người).

-- Up Migration

ALTER TABLE works
  ADD COLUMN supervisor_id bigint REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN leader_ids bigint[] NOT NULL DEFAULT '{}';

ALTER TABLE work_items
  ADD COLUMN supervisor_id bigint REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN leader_ids bigint[] NOT NULL DEFAULT '{}';

-- Dữ liệu đang có: điền theo luật mặc định. Một câu cho `works` vì cả hai cột đều suy từ phòng.
UPDATE works w
   SET supervisor_id = coalesce(
         -- Ưu tiên Phó Giám đốc phụ trách phòng (người đang hoạt động, id nhỏ nhất nếu nhiều).
         (SELECT dm.user_id
            FROM department_managers dm
            JOIN users u ON u.id = dm.user_id
           WHERE dm.department_id = w.department_id
             AND dm.role = 'deputy_director'
             AND u.is_active
           ORDER BY dm.user_id
           LIMIT 1),
         -- Công việc chung (không phòng) hoặc phòng chưa gán Phó GĐ ⇒ admin đang hoạt động.
         (SELECT u.id
            FROM users u
           WHERE u.role = 'admin' AND u.is_active
           ORDER BY u.id
           LIMIT 1)),
       leader_ids = coalesce(
         (SELECT array_agg(dm.user_id ORDER BY dm.user_id)
            FROM department_managers dm
            JOIN users u ON u.id = dm.user_id
           WHERE dm.department_id = w.department_id
             AND dm.role IN ('head', 'vice')
             AND u.is_active),
         '{}');

-- Cấp 2 thừa hưởng công việc cha. Cấp 3 CỐ Ý không điền: ô "Lãnh đạo phòng phụ trách" của nhiệm
-- vụ là CHỌN MỘT người từ nguồn hợp lệ, dữ liệu cũ không đủ căn cứ đoán thay người dùng.
UPDATE work_items i
   SET supervisor_id = w.supervisor_id,
       leader_ids    = w.leader_ids
  FROM works w
 WHERE w.id = i.work_id
   AND i.level = 2;

-- Nhiệm vụ tối đa một lãnh đạo phòng phụ trách. Thêm SAU khi backfill vì backfill cấp 2 copy cả
-- danh sách nhiều người từ công việc cha — thêm trước là UPDATE nổ constraint ngay.
ALTER TABLE work_items
  ADD CONSTRAINT task_leader_single CHECK (level <> 3 OR cardinality(leader_ids) <= 1);

-- Hai view thống kê (004_countable_views.sql) tạo bằng `SELECT *`, tức Postgres "đóng băng"
-- danh sách cột tại thời điểm tạo — cột thêm SAU đó KHÔNG tự xuất hiện trong view. CREATE OR
-- REPLACE để view nhìn thấy hai cột mới; điều kiện lọc GIỮ NGUYÊN từng chữ so với 004 (bẫy:
-- sửa điều kiện ở đây là tạo nguồn sự thật thứ hai cho luật đếm).
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

CREATE INDEX idx_works_supervisor        ON works (supervisor_id);
CREATE INDEX idx_work_items_supervisor   ON work_items (supervisor_id);
CREATE INDEX idx_work_items_leader_gin   ON work_items USING gin (leader_ids);

-- Down Migration

DROP INDEX IF EXISTS idx_work_items_leader_gin;
DROP INDEX IF EXISTS idx_work_items_supervisor;
DROP INDEX IF EXISTS idx_works_supervisor;

-- Trả hai view về đúng hình đóng băng của 004 trước khi bỏ hai cột, nếu không view đang tham
-- chiếu cột vừa bị DROP sẽ khiến câu DROP COLUMN nổ "cannot drop because other objects depend".
CREATE OR REPLACE VIEW v_countable_works AS
  SELECT id, code, name, description, manager_id, manager_name, department_id,
         start_date, end_date, status, approval_status, approver_id, approved_at,
         reject_reason, sort_order, created_by, created_by_name,
         origin, assigned_by_id, assigned_by_name, assigned_at,
         created_at, updated_at
    FROM works
   WHERE approval_status <> 'Chờ duyệt';

CREATE OR REPLACE VIEW v_countable_items AS
  SELECT i.*
    FROM work_items i
    JOIN works w  ON w.id = i.work_id
    LEFT JOIN work_items p ON p.id = i.parent_id
   WHERE i.approval_status <> 'Chờ duyệt'
     AND w.approval_status <> 'Chờ duyệt'
     AND (p.id IS NULL OR p.approval_status <> 'Chờ duyệt');

ALTER TABLE work_items DROP CONSTRAINT IF EXISTS task_leader_single;

ALTER TABLE work_items
  DROP COLUMN IF EXISTS supervisor_id,
  DROP COLUMN IF EXISTS leader_ids;

ALTER TABLE works
  DROP COLUMN IF EXISTS supervisor_id,
  DROP COLUMN IF EXISTS leader_ids;
