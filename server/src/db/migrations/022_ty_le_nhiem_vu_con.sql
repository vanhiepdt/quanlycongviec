-- Tỷ lệ nhiệm vụ trong công việc con; giữ nguyên tỷ lệ của các đầu mục cấp1.
-- Up Migration
ALTER TABLE work_items DROP CONSTRAINT work_items_ty_le_doi_tuong;
ALTER TABLE work_items ADD COLUMN ty_le_tu_dong boolean NOT NULL DEFAULT true;
WITH chia AS (
  SELECT id, 100 / count(*) OVER (PARTITION BY parent_id) +
    CASE WHEN row_number() OVER (PARTITION BY parent_id ORDER BY sort_order,id) <=
      100 % count(*) OVER (PARTITION BY parent_id) THEN 1 ELSE 0 END AS ty_le_moi
  FROM work_items WHERE level = 3 AND parent_id IS NOT NULL
)
UPDATE work_items i SET ty_le = chia.ty_le_moi FROM chia WHERE chia.id = i.id;

CREATE OR REPLACE VIEW v_countable_items AS
  SELECT i.* FROM work_items i JOIN works w ON w.id = i.work_id
  LEFT JOIN work_items p ON p.id = i.parent_id
  WHERE i.approval_status NOT IN ('Chờ duyệt','Nháp')
    AND w.approval_status NOT IN ('Chờ duyệt','Nháp')
    AND (p.id IS NULL OR p.approval_status NOT IN ('Chờ duyệt','Nháp'));

-- Down Migration
DROP VIEW v_countable_items;
UPDATE work_items SET ty_le = 0 WHERE level = 3 AND parent_id IS NOT NULL;
ALTER TABLE work_items DROP COLUMN ty_le_tu_dong;
ALTER TABLE work_items ADD CONSTRAINT work_items_ty_le_doi_tuong
  CHECK (ty_le = 0 OR level = 2 OR (level = 3 AND parent_id IS NULL));

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
