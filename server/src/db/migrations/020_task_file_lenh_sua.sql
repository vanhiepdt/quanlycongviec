-- Up Migration

ALTER TABLE task_files
  ADD COLUMN lenh_sua_cho text CHECK (lenh_sua_cho IN ('can-bo', 'lanh-dao')),
  ADD COLUMN lenh_sua_ly_do text NOT NULL DEFAULT '',
  ADD COLUMN lenh_sua_ghi_chu text NOT NULL DEFAULT '';

UPDATE task_files f
   SET lenh_sua_cho = COALESCE((
         SELECT CASE WHEN g.hanh_dong = 'tra-ve-tp' THEN 'lanh-dao' ELSE 'can-bo' END
           FROM task_file_flow g WHERE g.file_id = f.id
            AND g.hanh_dong IN ('yeu-cau-sua', 'tra-ve-cbo', 'tra-ve-tp')
          ORDER BY g.id DESC LIMIT 1), 'can-bo'),
       lenh_sua_ly_do = COALESCE((
         SELECT g.noi_dung FROM task_file_flow g WHERE g.file_id = f.id
            AND g.hanh_dong IN ('yeu-cau-sua', 'tra-ve-cbo', 'tra-ve-tp')
          ORDER BY g.id DESC LIMIT 1), '')
 WHERE f.trang_thai = 'can-sua';

ALTER TABLE task_file_flow DROP CONSTRAINT task_file_flow_hanh_dong_check;
ALTER TABLE task_file_flow
  ADD CONSTRAINT task_file_flow_hanh_dong_check CHECK (hanh_dong IN (
    'nop', 'gom-y', 'yeu-cau-sua', 'trinh-lanh-dao', 'tra-ve-tp',
    'tra-ve-cbo', 'duyet-tu-dong', 'duyet', 'hoan-thanh', 'sua-truc-tuyen', 'huy-lenh-sua'
  ));

-- Down Migration

DELETE FROM task_file_flow WHERE hanh_dong = 'huy-lenh-sua';
UPDATE task_files SET trang_thai = 'cho-xem'
 WHERE trang_thai = 'can-sua' AND lenh_sua_cho = 'lanh-dao';
ALTER TABLE task_file_flow DROP CONSTRAINT task_file_flow_hanh_dong_check;
ALTER TABLE task_file_flow
  ADD CONSTRAINT task_file_flow_hanh_dong_check CHECK (hanh_dong IN (
    'nop', 'gom-y', 'yeu-cau-sua', 'trinh-lanh-dao', 'tra-ve-tp',
    'tra-ve-cbo', 'duyet-tu-dong', 'duyet', 'hoan-thanh', 'sua-truc-tuyen'
  ));
ALTER TABLE task_files
  DROP COLUMN lenh_sua_ghi_chu,
  DROP COLUMN lenh_sua_ly_do,
  DROP COLUMN lenh_sua_cho;
