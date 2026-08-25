-- 002_work_items_department.sql — gắn PHÒNG cho cả ba cấp của cây công việc (§4.1).
--
-- Trước bản này chỉ Công việc cấp 1 (`works`) có `department_id`; Công việc con (cấp 2) và
-- Nhiệm vụ (cấp 3) phải suy phòng qua công việc cha bằng JOIN. Nay `work_items` có cột riêng.
--
-- Quy tắc đã chốt: phòng của cấp 2 và cấp 3 LUÔN KHỚP phòng của công việc cha — cột này là bản
-- sao đọc-nhanh, KHÔNG phải chỗ để làm việc liên phòng:
--   • Chèn/sửa mà để trống ⇒ trigger tự lấy phòng của công việc cha (không ai phải nhớ truyền).
--   • Chèn/sửa với phòng KHÁC công việc cha ⇒ lỗi 23514, service dịch thành DEPT_MISMATCH_WORK.
--   • Đổi phòng của công việc cấp 1 ⇒ trigger lan xuống toàn bộ cấp 2 + cấp 3 của nó, nên không
--     bao giờ có dòng con còn giữ phòng cũ.
--   • Chuyển dòng sang công việc khác ⇒ phòng đi theo công việc đích.
-- Vì cột không thể lệch, `can()` (§6) xét phạm vi phòng đọc thẳng `work_items.department_id`,
-- không cần JOIN `works` nữa.

-- Up Migration

ALTER TABLE work_items
  ADD COLUMN department_id bigint REFERENCES departments(id) ON DELETE SET NULL;

-- Dữ liệu đang có: lấy đúng phòng của công việc cha (kể cả NULL — công việc chưa gán phòng).
UPDATE work_items i
   SET department_id = w.department_id
  FROM works w
 WHERE w.id = i.work_id
   AND i.department_id IS DISTINCT FROM w.department_id;

CREATE FUNCTION work_items_sync_department() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE work_dept bigint;
BEGIN
  SELECT department_id INTO work_dept FROM works WHERE id = NEW.work_id;

  -- Chuyển dòng sang công việc khác (§7 việc 3.4) mà không nói gì về phòng ⇒ phòng đi theo công
  -- việc đích. Không có nhánh này thì mọi lần chuyển đều nổ DEPT_MISMATCH_WORK, vì phòng cũ còn
  -- nguyên trên dòng.
  IF TG_OP = 'UPDATE' AND NEW.work_id <> OLD.work_id
     AND NEW.department_id IS NOT DISTINCT FROM OLD.department_id THEN
    NEW.department_id := work_dept;
  END IF;

  IF NEW.department_id IS NULL THEN
    NEW.department_id := work_dept;      -- để trống ⇒ thừa hưởng phòng của công việc cha
  ELSIF NEW.department_id IS DISTINCT FROM work_dept THEN
    RAISE EXCEPTION
      'Công việc con/nhiệm vụ phải cùng phòng với công việc cha (phòng của công việc là %)',
      coalesce(work_dept::text, 'chưa gán')
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- Cùng danh sách cột với trg_work_items_check_parent (`work_id`), thêm `department_id`: chỉ hai
-- cột đó làm phòng lệch đi được.
CREATE TRIGGER trg_work_items_sync_department
  BEFORE INSERT OR UPDATE OF department_id, work_id ON work_items
  FOR EACH ROW EXECUTE FUNCTION work_items_sync_department();

-- Đổi phòng công việc cấp 1 thì cả cây đi theo. Làm bằng trigger chứ không bằng service: chuyển
-- phòng còn có đường khác (nhập dữ liệu Phase 9, sửa tay lúc bảo trì), mà đường nào cũng phải
-- giữ được bất biến "con cùng phòng với cha".
CREATE FUNCTION works_cascade_department() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE work_items
     SET department_id = NEW.department_id
   WHERE work_id = NEW.id
     AND department_id IS DISTINCT FROM NEW.department_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_works_cascade_department
  AFTER UPDATE OF department_id ON works
  FOR EACH ROW
  WHEN (OLD.department_id IS DISTINCT FROM NEW.department_id)
  EXECUTE FUNCTION works_cascade_department();

-- Lọc "việc của phòng tôi" (§6 Trưởng phòng/Phó phòng) luôn kèm cấp: cấp 2 để dựng cây, cấp 3
-- để đếm nhiệm vụ.
CREATE INDEX idx_work_items_dept_level ON work_items (department_id, level);

-- Down Migration

DROP TRIGGER IF EXISTS trg_works_cascade_department ON works;
DROP FUNCTION IF EXISTS works_cascade_department();
DROP TRIGGER IF EXISTS trg_work_items_sync_department ON work_items;
DROP FUNCTION IF EXISTS work_items_sync_department();
DROP INDEX IF EXISTS idx_work_items_dept_level;
ALTER TABLE work_items DROP COLUMN IF EXISTS department_id;
