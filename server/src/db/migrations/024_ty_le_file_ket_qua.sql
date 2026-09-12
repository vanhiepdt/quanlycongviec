-- Tỷ lệ cho nhóm file. Không đổi work_items nên không cần rebuild view.
-- Up Migration
ALTER TABLE task_files ADD COLUMN ty_le integer NOT NULL DEFAULT 0 CHECK (ty_le BETWEEN 0 AND 100),
  ADD COLUMN ty_le_tu_dong boolean NOT NULL DEFAULT true;
WITH chia AS (
 SELECT id, 100/count(*) OVER(PARTITION BY item_id) +
 CASE WHEN row_number() OVER(PARTITION BY item_id ORDER BY id) <= 100%count(*) OVER(PARTITION BY item_id) THEN 1 ELSE 0 END AS moi
 FROM task_files
) UPDATE task_files f SET ty_le=chia.moi FROM chia WHERE chia.id=f.id;
-- Down Migration
ALTER TABLE task_files DROP COLUMN ty_le_tu_dong, DROP COLUMN ty_le;
