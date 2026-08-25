-- 003_work_origin_and_history.sql — "việc này từ đâu ra?" và "ai đã sửa gì?" (§4.1, §2.2/§2.3).
--
-- Hai câu hỏi người dùng luôn hỏi khi mở một đầu việc, mà bản Sheets không trả lời được:
--   1. Ai lập ra việc này — người đó TỰ ĐĂNG KÝ, hay được ai GIAO? Nếu được giao thì ai giao
--      LẦN ĐẦU (không phải người giao lại sau này)?
--   2. Từ lúc lập tới giờ, ai đã sửa những gì?
--
-- Câu 1 giải bằng 5 cột dưới đây, đặt trên CẢ `works` và `work_items` (cả ba cấp đều phải trả
-- lời được). Câu 2 giải bằng `activity_logs` đã có: mỗi request ghi thành công là một dòng, kèm
-- `details.changes = { cột: { from, to } }`; index mới ở cuối file làm cho việc đọc nhật ký của
-- MỘT đầu việc không phải quét cả bảng.
--
-- Vì sao `assigned_by_id` và `created_by_name` KHÔNG có khoá ngoại / vẫn giữ tên:
-- xoá một người khỏi hệ thống không được xoá dấu vết ai giao việc — cùng lý do `activity_logs`
-- không có FK sang `users` (001_init.sql). Tên lưu kèm để hiển thị được cả khi tài khoản đã mất.

-- Up Migration

ALTER TABLE works
  ADD COLUMN created_by_name  text NOT NULL DEFAULT '',
  ADD COLUMN origin           text NOT NULL DEFAULT 'Tự đăng ký'
                              CHECK (origin IN ('Tự đăng ký', 'Được giao')),
  ADD COLUMN assigned_by_id   bigint,
  ADD COLUMN assigned_by_name text NOT NULL DEFAULT '',
  ADD COLUMN assigned_at      timestamptz;

ALTER TABLE work_items
  ADD COLUMN created_by_name  text NOT NULL DEFAULT '',
  ADD COLUMN origin           text NOT NULL DEFAULT 'Tự đăng ký'
                              CHECK (origin IN ('Tự đăng ký', 'Được giao')),
  ADD COLUMN assigned_by_id   bigint,
  ADD COLUMN assigned_by_name text NOT NULL DEFAULT '',
  ADD COLUMN assigned_at      timestamptz;

-- Dữ liệu đang có: điền tên người tạo từ bảng users. Những dòng không dò ra người tạo thì để
-- trống — không đoán.
UPDATE works w SET created_by_name = u.full_name FROM users u WHERE u.id = w.created_by;
UPDATE work_items i SET created_by_name = u.full_name FROM users u WHERE u.id = i.created_by;

-- Người đăng ký và NGƯỜI GIAO ĐẦU TIÊN là dữ liệu chỉ ghi một lần. Giữ bất biến đó ở CSDL, vì
-- "ai giao việc này" là thứ dễ bị ghi đè nhất: mỗi lần sửa việc, frontend gửi cả object lên.
CREATE FUNCTION keep_first_origin() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Người tạo: điền được đúng một lần (dòng nhập tay từ hệ cũ có thể còn trống).
  IF OLD.created_by IS NOT NULL THEN
    NEW.created_by := OLD.created_by;
  END IF;
  IF OLD.created_by_name <> '' THEN
    NEW.created_by_name := OLD.created_by_name;
  END IF;

  -- Người giao: đã có thì không đổi được nữa, kể cả khi việc được giao lại cho người khác.
  -- Lần giao lại về sau nằm trong activity_logs, không ghi lên đây.
  IF OLD.assigned_by_id IS NOT NULL THEN
    NEW.assigned_by_id   := OLD.assigned_by_id;
    NEW.assigned_by_name := OLD.assigned_by_name;
    NEW.assigned_at      := OLD.assigned_at;
    NEW.origin           := OLD.origin;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_works_keep_first_origin
  BEFORE UPDATE ON works
  FOR EACH ROW EXECUTE FUNCTION keep_first_origin();

CREATE TRIGGER trg_work_items_keep_first_origin
  BEFORE UPDATE ON work_items
  FOR EACH ROW EXECUTE FUNCTION keep_first_origin();

-- Nhật ký của MỘT đầu việc, mới nhất trước: 'work' + id, hoặc 'subwork'/'task' + id.
CREATE INDEX idx_activity_logs_entity ON activity_logs (entity_type, entity_id, id DESC);

-- Down Migration

DROP INDEX IF EXISTS idx_activity_logs_entity;
DROP TRIGGER IF EXISTS trg_work_items_keep_first_origin ON work_items;
DROP TRIGGER IF EXISTS trg_works_keep_first_origin ON works;
DROP FUNCTION IF EXISTS keep_first_origin();

ALTER TABLE work_items
  DROP COLUMN IF EXISTS assigned_at,
  DROP COLUMN IF EXISTS assigned_by_name,
  DROP COLUMN IF EXISTS assigned_by_id,
  DROP COLUMN IF EXISTS origin,
  DROP COLUMN IF EXISTS created_by_name;

ALTER TABLE works
  DROP COLUMN IF EXISTS assigned_at,
  DROP COLUMN IF EXISTS assigned_by_name,
  DROP COLUMN IF EXISTS assigned_by_id,
  DROP COLUMN IF EXISTS origin,
  DROP COLUMN IF EXISTS created_by_name;
