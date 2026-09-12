-- ĐỢT A (11/09/2026) — «Ban lãnh đạo kiểm soát» thành MẢNG ở CẢ BA CẤP.
--
-- Vì sao: người dùng chốt D2 + D3 (bảng quyết định, docs/BAT-DAU-SESSION.md).
--   • Cấp 1 (works)      : chọn NHIỀU Ban lãnh đạo kiểm soát.
--   • Cấp 2 (work_items) : chọn NHIỀU, nhưng CHỈ trong tập đã chọn ở cấp 1.
--   • Cấp 3 (work_items) : chọn ĐÚNG MỘT, và chỉ trong tập đã chọn ở cấp 2.
-- Luật «cấp dưới ⊆ cấp trên, cấp 3 đúng một» KHÔNG mới: `leader_ids` đã làm y khuôn từ 005
-- (CHECK `task_leader_single` + `validTaskLeaders`/`assertTaskLeader`). Cột này nhân bản khuôn đó,
-- không phát minh cơ chế mới.
--
-- Hệ quả lớn nhất là R1(a): người duyệt CÂY nay là thành viên `supervisor_ids` của chính dòng,
-- KHÔNG còn là «mọi Phó Giám đốc của phòng», và admin KHÔNG được duyệt thay. Đường gỡ khi cả
-- danh sách nghỉ việc: admin vẫn SỬA được `supervisor_ids` (quyền `update`, không phải `approve`).
--
-- Up Migration

-- Cột mới để TRỐNG được (chưa NOT NULL) thì sáu bước tự điền bên dưới mới chạy tuần tự được.
ALTER TABLE works      ADD COLUMN supervisor_ids bigint[];
ALTER TABLE work_items ADD COLUMN supervisor_ids bigint[];

-- BƯỚC 1 — chép nguyên giá trị đơn cũ vào mảng một phần tử. NULL ⇒ mảng rỗng, KHÔNG phải {NULL}:
-- một phần tử NULL trong mảng là «có một người duyệt không tồn tại», và R1(a) sẽ khoá cây vĩnh viễn.
UPDATE works      SET supervisor_ids = CASE WHEN supervisor_id IS NULL THEN '{}' ELSE ARRAY[supervisor_id] END;
UPDATE work_items SET supervisor_ids = CASE WHEN supervisor_id IS NULL THEN '{}' ELSE ARRAY[supervisor_id] END;

-- BƯỚC 2 — cấp 2 chưa có ⇒ lấy NGUYÊN tập của công việc cha (cấp 2 được nhiều người, và ⊆ cấp 1).
UPDATE work_items i
   SET supervisor_ids = w.supervisor_ids
  FROM works w
 WHERE w.id = i.work_id
   AND i.level = 2
   AND cardinality(i.supervisor_ids) = 0
   AND cardinality(w.supervisor_ids) > 0;

-- BƯỚC 3 — cấp 3 ⇒ phần tử ĐẦU của tập cấp 2 chứa nó (Q12: «lấy 1 người đầu tiên của cấp 2»).
-- Lấy ĐẦU chứ không lấy cả tập: CHECK `task_supervisor_single` ở bước 7 giới hạn cấp 3 đúng một.
UPDATE work_items i
   SET supervisor_ids = ARRAY[p.supervisor_ids[1]]
  FROM work_items p
 WHERE p.id = i.parent_id
   AND i.level = 3
   AND cardinality(i.supervisor_ids) = 0
   AND cardinality(p.supervisor_ids) > 0;

-- Cấp 3 treo THẲNG công việc cha (không qua cấp 2) ⇒ lấy phần tử đầu của cấp 1.
UPDATE work_items i
   SET supervisor_ids = ARRAY[w.supervisor_ids[1]]
  FROM works w
 WHERE w.id = i.work_id
   AND i.level = 3
   AND i.parent_id IS NULL
   AND cardinality(i.supervisor_ids) = 0
   AND cardinality(w.supervisor_ids) > 0;

-- BƯỚC 4 — vẫn rỗng ⇒ một Phó Giám đốc (deputy_director) ĐANG HOẠT ĐỘNG của phòng.
-- `DISTINCT ON` + `ORDER BY user_id` để kết quả ỔN ĐỊNH giữa các lần chạy: hai PGĐ cùng phụ trách
-- một phòng mà không chốt thứ tự thì migration chạy lại ra người khác, không tái lập được.
WITH pgd AS (
  SELECT DISTINCT ON (dm.department_id) dm.department_id, dm.user_id
    FROM department_managers dm
    JOIN users u ON u.id = dm.user_id
   WHERE dm.role = 'deputy_director' AND u.is_active
   ORDER BY dm.department_id, dm.user_id
)
UPDATE works w
   SET supervisor_ids = ARRAY[p.user_id]
  FROM pgd p
 WHERE p.department_id = w.department_id AND cardinality(w.supervisor_ids) = 0;

WITH pgd AS (
  SELECT DISTINCT ON (dm.department_id) dm.department_id, dm.user_id
    FROM department_managers dm
    JOIN users u ON u.id = dm.user_id
   WHERE dm.role = 'deputy_director' AND u.is_active
   ORDER BY dm.department_id, dm.user_id
)
UPDATE work_items i
   SET supervisor_ids = ARRAY[p.user_id]
  FROM pgd p
 WHERE p.department_id = i.department_id AND cardinality(i.supervisor_ids) = 0;

-- BƯỚC 5 — phòng không có PGĐ (hoặc «Công việc chung» không có phòng) ⇒ một tài khoản admin
-- đang hoạt động. admin hợp lệ với MỌI phòng (luật cũ của `assertSupervisor`), nên đây là lưới cuối.
WITH mot_admin AS (
  SELECT id FROM users WHERE role = 'admin' AND is_active ORDER BY id LIMIT 1
)
UPDATE works w SET supervisor_ids = ARRAY[m.id]
  FROM mot_admin m WHERE cardinality(w.supervisor_ids) = 0;

WITH mot_admin AS (
  SELECT id FROM users WHERE role = 'admin' AND is_active ORDER BY id LIMIT 1
)
UPDATE work_items i SET supervisor_ids = ARRAY[m.id]
  FROM mot_admin m WHERE cardinality(i.supervisor_ids) = 0;

-- BƯỚC 6 — CSDL không có ai thật (bản test rỗng, hoặc mọi tài khoản đều bị khoá) ⇒ để MẢNG RỖNG
-- và IN RA danh sách, đúng cam kết ở bảng quyết định. Không phải lỗi chặn migration: R1(a) sẽ tự
-- chặn «Gửi duyệt» của những cây đó cho tới khi có người vào chọn, còn cây đã `Đã duyệt` thì
-- không ảnh hưởng gì — duyệt lại chỉ xảy ra khi có người chủ động gửi.
DO $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN SELECT code, name FROM works WHERE cardinality(supervisor_ids) = 0 ORDER BY code LOOP
    n := n + 1;
    RAISE NOTICE '028: công việc % — % CHƯA có Ban lãnh đạo kiểm soát, phải chọn trước khi gửi duyệt',
      r.code, coalesce(r.name, '');
  END LOOP;
  FOR r IN SELECT code, name FROM work_items WHERE cardinality(supervisor_ids) = 0 ORDER BY code LOOP
    n := n + 1;
    RAISE NOTICE '028: mục % — % CHƯA có Ban lãnh đạo kiểm soát, phải chọn trước khi gửi duyệt',
      r.code, coalesce(r.name, '');
  END LOOP;
  RAISE NOTICE '028: tổng số dòng KHÔNG tự điền được Ban lãnh đạo kiểm soát: %', n;
END $$;

-- BƯỚC 7 — chốt khuôn. `NOT NULL DEFAULT '{}'` giống hệt `leader_ids` (005): rỗng là HỢP LỆ về
-- mặt CSDL (dữ liệu cũ chưa phân công không bị chặn sửa), còn «bắt buộc có người mới gửi duyệt
-- được» là luật NGHIỆP VỤ ở approvals/service.js, không phải của cột.
ALTER TABLE works      ALTER COLUMN supervisor_ids SET DEFAULT '{}',
                       ALTER COLUMN supervisor_ids SET NOT NULL;
ALTER TABLE work_items ALTER COLUMN supervisor_ids SET DEFAULT '{}',
                       ALTER COLUMN supervisor_ids SET NOT NULL;

ALTER TABLE work_items
  ADD CONSTRAINT task_supervisor_single CHECK (level <> 3 OR cardinality(supervisor_ids) <= 1);

-- BƯỚC 8 — bỏ cột đơn. `workItems/repo.js` và `taskFiles/repo.js` tính `supervisor_hieu_luc` từ
-- cột này; cả bốn chỗ tính đã đổi sang dùng `sqlSupervisorHieuLuc` (một nơi) trong cùng đợt.
--
-- PHẢI gỡ hai view TRƯỚC khi xoá cột: chúng được tạo bằng `SELECT *` / `SELECT i.*` nên danh sách
-- cột đã ĐÓNG BĂNG từ 026, trong đó có `supervisor_id`. Xoá cột trước là Postgres chặn ngay bằng
-- «cannot drop column supervisor_id of table works because other objects depend on it · view
-- v_countable_works depends on column supervisor_id». Đây chính là cái bẫy đã ghi ở 005 và ở phần
-- Down bên dưới — lần này nó nằm ở đường UP nên dễ quên hơn: theo phản xạ ai cũng nghĩ «thêm cột
-- mới, chép dữ liệu, rồi xoá cột cũ» là xong.
DROP VIEW IF EXISTS v_countable_items;
DROP VIEW IF EXISTS v_countable_works;

DROP INDEX IF EXISTS idx_works_supervisor;
DROP INDEX IF EXISTS idx_work_items_supervisor;
ALTER TABLE works      DROP COLUMN supervisor_id;
ALTER TABLE work_items DROP COLUMN supervisor_id;

-- BƯỚC 9 — GIN cho truy vấn «mọi dòng do tôi kiểm soát» (`= ANY(...)` trong repo, `$1::bigint = ANY(supervisor_ids)`).
CREATE INDEX idx_works_supervisor_gin      ON works      USING gin (supervisor_ids);
CREATE INDEX idx_work_items_supervisor_gin ON work_items USING gin (supervisor_ids);

-- BƯỚC 10 — tạo lại hai view theo danh sách cột MỚI (không còn `supervisor_id`, đã có
-- `supervisor_ids`). Điều kiện loại nháp/chờ giữ NGUYÊN văn như 026 — đổi nó ở đây là đổi luôn
-- số liệu thống kê, không thuộc phạm vi đợt này.
CREATE OR REPLACE VIEW v_countable_works AS
  SELECT * FROM works WHERE approval_status NOT IN ('Chờ duyệt','Nháp');
CREATE OR REPLACE VIEW v_countable_items AS
  SELECT i.* FROM work_items i JOIN works w ON w.id=i.work_id
    LEFT JOIN work_items p ON p.id=i.parent_id
   WHERE i.approval_status NOT IN ('Chờ duyệt','Nháp')
     AND w.approval_status NOT IN ('Chờ duyệt','Nháp')
     AND (p.id IS NULL OR p.approval_status NOT IN ('Chờ duyệt','Nháp'));

-- Down Migration
-- Thứ tự BẮT BUỘC như dưới. Bẫy: `CREATE OR REPLACE VIEW ... SELECT *` đóng băng danh sách cột,
-- nên phải DROP hai view TRƯỚC khi xoá `supervisor_ids`, rồi mới tạo lại view — tạo lại trước khi
-- xoá cột là view ngậm luôn cột sắp mất và `DROP COLUMN` báo «other objects depend on it».

-- 1) Cột đơn quay lại, lấy phần tử đầu của mảng (mất thông tin «nhiều người» — down là lùi bước).
ALTER TABLE works      ADD COLUMN supervisor_id bigint REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE work_items ADD COLUMN supervisor_id bigint REFERENCES users(id) ON DELETE SET NULL;
UPDATE works      SET supervisor_id = supervisor_ids[1];
UPDATE work_items SET supervisor_id = supervisor_ids[1];

-- 2) Gỡ view để giải phóng phụ thuộc vào cột mảng.
DROP VIEW IF EXISTS v_countable_items;
DROP VIEW IF EXISTS v_countable_works;

-- 3) Xoá cột mảng + ràng buộc + chỉ số GIN.
DROP INDEX IF EXISTS idx_work_items_supervisor_gin;
DROP INDEX IF EXISTS idx_works_supervisor_gin;
ALTER TABLE work_items DROP CONSTRAINT IF EXISTS task_supervisor_single;
ALTER TABLE works      DROP COLUMN supervisor_ids;
ALTER TABLE work_items DROP COLUMN supervisor_ids;

-- 4) Tạo lại view theo danh sách cột CŨ (nay không còn `supervisor_ids` để ngậm).
CREATE OR REPLACE VIEW v_countable_works AS
  SELECT * FROM works WHERE approval_status NOT IN ('Chờ duyệt','Nháp');
CREATE OR REPLACE VIEW v_countable_items AS
  SELECT i.* FROM work_items i JOIN works w ON w.id=i.work_id
    LEFT JOIN work_items p ON p.id=i.parent_id
   WHERE i.approval_status NOT IN ('Chờ duyệt','Nháp')
     AND w.approval_status NOT IN ('Chờ duyệt','Nháp')
     AND (p.id IS NULL OR p.approval_status NOT IN ('Chờ duyệt','Nháp'));

-- 5) Chỉ số scalar của 005.
CREATE INDEX idx_works_supervisor      ON works (supervisor_id);
CREATE INDEX idx_work_items_supervisor ON work_items (supervisor_id);
