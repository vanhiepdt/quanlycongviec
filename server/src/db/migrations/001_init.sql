-- 001_init.sql — lược đồ khởi tạo, theo §4.1 và §4.2 của KE-HOACH-VPS.md.
--
-- Ba nguyên tắc:
--   1. Bỏ hẳn cách lưu chuỗi JSON trong ô như bản Sheets. Chỉ còn `jsonb` ở đúng 2 chỗ dữ
--      liệu thật sự tự do: work_items.result_links và activity_logs.details.
--   2. Cấp 2 và cấp 3 nằm cùng bảng work_items, phân biệt bằng `level`, không phải cùng
--      một mảng JSON như cột "Nhiệm vụ JSON" cũ.
--   3. Mã sinh bằng sequence + UNIQUE, không bằng millisecond (bẫy §13.5).

-- Up Migration

CREATE EXTENSION IF NOT EXISTS citext;

-- Mọi bảng có updated_at đều gắn trigger này; không tin vào việc tầng ứng dụng nhớ set.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Sinh mã: PH01, NV001, DA001, DN001, APP001.
-- Sequence là nguồn duy nhất, nên hai người bấm cùng lúc không thể ra cùng một mã.
-- Sau khi nhập dữ liệu cũ (Phase 2) phải `setval` các sequence này vượt qua mã lớn nhất.
CREATE SEQUENCE seq_department_code AS bigint START 1;
CREATE SEQUENCE seq_user_code       AS bigint START 1;
CREATE SEQUENCE seq_work_code       AS bigint START 1;
CREATE SEQUENCE seq_work_item_code  AS bigint START 1;
CREATE SEQUENCE seq_proposal_code   AS bigint START 1;
CREATE SEQUENCE seq_app_code        AS bigint START 1;

CREATE FUNCTION next_code(p_prefix text, p_seq regclass, p_width int DEFAULT 3)
RETURNS text LANGUAGE sql AS $$
  SELECT p_prefix || lpad(nextval(p_seq)::text, p_width, '0');
$$;

-- ============================ Phòng và người dùng ============================

CREATE TABLE departments (
  id          bigserial PRIMARY KEY,
  code        text NOT NULL UNIQUE,            -- PH01
  name        text NOT NULL UNIQUE,
  sort_order  int  NOT NULL DEFAULT 99,        -- quyết định thứ tự trên Gantt (D9)
  notes       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            bigserial PRIMARY KEY,
  code          text NOT NULL UNIQUE,          -- NV001
  full_name     text NOT NULL,
  -- citext: hết hẳn bệnh email chữ hoa không khớp của bản cũ (bẫy §13.5).
  email         citext NOT NULL UNIQUE,
  password_hash text NOT NULL,                 -- bcrypt cost 12, không bao giờ là văn bản thuần
  must_change_password boolean NOT NULL DEFAULT false,
  position      text NOT NULL DEFAULT '',      -- Chức vụ, chữ tự do
  role          text NOT NULL DEFAULT 'Nhân viên',
  object_type   text NOT NULL DEFAULT '',      -- Đối tượng
  department_id bigint REFERENCES departments(id) ON DELETE SET NULL,
  dept_role     text CHECK (dept_role IS NULL OR
                  dept_role IN ('Trưởng phòng','Phó phòng','Nhân viên')),
  notes         text NOT NULL DEFAULT '',
  is_active     boolean NOT NULL DEFAULT true,
  failed_logins int NOT NULL DEFAULT 0,
  -- Thời điểm sai mật khẩu gần nhất. Cần để hiểu đúng "sai 5 lần TRONG 15 PHÚT": lần sai từ
  -- hôm qua không được cộng dồn vào hôm nay, nếu không thì tài khoản ít dùng bị khoá oan.
  last_failed_login_at timestamptz,
  locked_until  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- 6 vai trò của A5. So khớp CHÍNH XÁC, không `includes('admin')` như bản cũ — nếu không
  -- thì "Trợ lý admin" cũng thành admin (bẫy §13.5, TC-RBAC-07/08).
  -- Từ vựng: "Quản lý công việc", KHÔNG phải "Quản lý dự án" (§0 Từ vựng chốt 2026-08-24).
  CONSTRAINT users_role_valid CHECK (role IN
    ('admin','Phó Giám đốc','Trưởng phòng','Phó phòng','Quản lý công việc','Nhân viên'))
);

-- Ai phụ trách phòng nào — thay 3 cột email cách nhau dấu ';' của sheet "Phòng".
CREATE TABLE department_managers (
  department_id bigint NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id       bigint NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  role          text   NOT NULL CHECK (role IN ('deputy_director','head','vice')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (department_id, user_id, role)
);

-- ======================= Công việc cấp 1 (sheet "Dự án/Nhiệm vụ") =======================
-- Tên sheet giữ nguyên văn vì đó là tên THẬT trong Google Sheets, không đổi được. Từ vựng của
-- hệ mới là "công việc"; tiền tố mã vẫn là `DA` để đối chiếu được với dữ liệu đang chạy (§0).

CREATE TABLE works (
  id              bigserial PRIMARY KEY,
  code            text NOT NULL UNIQUE,        -- DA001
  name            text NOT NULL,
  description     text NOT NULL DEFAULT '',
  manager_id      bigint REFERENCES users(id) ON DELETE SET NULL,
  -- Giữ tên tự do: dữ liệu cũ có tên không dò ra người nào, không được mất chữ đã nhập.
  manager_name    text NOT NULL DEFAULT '',
  department_id   bigint REFERENCES departments(id) ON DELETE SET NULL,
  start_date      date,
  end_date        date,
  status          text NOT NULL DEFAULT 'Chưa bắt đầu',
  approval_status text NOT NULL DEFAULT 'Đã duyệt'
                  CHECK (approval_status IN ('Chờ duyệt','Đã duyệt','Từ chối')),
  approver_id     bigint REFERENCES users(id) ON DELETE SET NULL,
  approved_at     timestamptz,
  reject_reason   text NOT NULL DEFAULT '',
  sort_order      int NOT NULL DEFAULT 0,
  created_by      bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ================= Công việc con (cấp 2) + Nhiệm vụ (cấp 3) =================
-- Thay cột "Nhiệm vụ JSON": một dòng một phần tử. Một ô JSON hỏng không còn xoá sạch
-- nhiệm vụ của cả công việc như bản Sheets.

CREATE TABLE work_items (
  id            bigserial PRIMARY KEY,
  -- Dữ liệu cũ có 2 dạng mã: 'DA001-01' (nhân bản công việc) và 'ID250824093012345'
  -- (generateTaskIdForProject, sinh theo millisecond). Cả hai đều nhập nguyên văn ở Phase 2;
  -- mã MỚI sinh bằng seq_work_item_code nên không thể trùng.
  code          text NOT NULL UNIQUE,
  work_id       bigint NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  parent_id     bigint REFERENCES work_items(id) ON DELETE CASCADE,
  level         smallint NOT NULL CHECK (level IN (2,3)),
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  assignee_id   bigint REFERENCES users(id) ON DELETE SET NULL,
  assignee_name text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'Chưa bắt đầu',
  priority      text NOT NULL DEFAULT 'Trung bình',
  start_date    date,
  due_date      date,
  report_date   date,
  completion    smallint NOT NULL DEFAULT 0 CHECK (completion BETWEEN 0 AND 100),
  target        text NOT NULL DEFAULT '',
  output        text NOT NULL DEFAULT '',
  notes         text NOT NULL DEFAULT '',
  result_links  jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_status text NOT NULL DEFAULT 'Đã duyệt'
                  CHECK (approval_status IN ('Chờ duyệt','Đã duyệt','Từ chối')),
  approver_id   bigint REFERENCES users(id) ON DELETE SET NULL,
  approved_at   timestamptz,
  reject_reason text NOT NULL DEFAULT '',
  sort_order    int NOT NULL DEFAULT 0,
  created_by    bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Hai ràng buộc thay cho các nhánh kiểm tay của updateTask:
  CONSTRAINT lvl2_no_parent  CHECK (level <> 2 OR parent_id IS NULL),
  CONSTRAINT no_self_parent  CHECK (parent_id IS NULL OR parent_id <> id),
  -- result_links phải là MẢNG json, không phải object hay chuỗi.
  CONSTRAINT links_is_array  CHECK (jsonb_typeof(result_links) = 'array')
);

-- Ba quy tắc còn lại không đặt được bằng CHECK (phải đọc dòng khác) nên làm bằng trigger.
-- Trigger là LƯỚI AN TOÀN CUỐI: service vẫn phải kiểm trước và trả lỗi tiếng Việt rõ ràng.
CREATE FUNCTION work_items_check_parent() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  parent_level   smallint;
  parent_work_id bigint;
  child_count    int;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT level, work_id INTO parent_level, parent_work_id
      FROM work_items WHERE id = NEW.parent_id;

    IF parent_level IS NULL THEN
      RAISE EXCEPTION 'Công việc con cha (id=%) không tồn tại', NEW.parent_id
        USING ERRCODE = '23503';
    END IF;
    IF parent_level <> 2 THEN
      RAISE EXCEPTION 'Cha phải là công việc con (cấp 2), không được lấy nhiệm vụ cấp 3 làm cha'
        USING ERRCODE = '23514';
    END IF;
    IF parent_work_id <> NEW.work_id THEN
      RAISE EXCEPTION 'Cha và con phải thuộc cùng một công việc'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Cấp 2 đang có con thì không được chuyển sang công việc khác, cũng không được hạ xuống
  -- cấp 3 — nếu không, con cháu sẽ mồ côi hoặc lệch work_id (C5).
  IF TG_OP = 'UPDATE' AND OLD.level = 2
     AND (NEW.work_id <> OLD.work_id OR NEW.level <> OLD.level) THEN
    SELECT count(*) INTO child_count FROM work_items WHERE parent_id = OLD.id;
    IF child_count > 0 THEN
      RAISE EXCEPTION 'Công việc con đang có % nhiệm vụ bên dưới, không thể chuyển hoặc đổi cấp',
        child_count USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_work_items_check_parent
  BEFORE INSERT OR UPDATE OF parent_id, work_id, level ON work_items
  FOR EACH ROW EXECUTE FUNCTION work_items_check_parent();

-- ============================ Nhắc việc ============================
-- C10: nhắc việc CHỈ cho cấp 3. Bản cũ còn nợ chỗ này nên gọi trên cấp 2 vẫn lọt.

CREATE TABLE reminders (
  id           bigserial PRIMARY KEY,
  work_item_id bigint NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  remind_date  date NOT NULL,
  content      text NOT NULL DEFAULT '',
  created_by   bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION reminders_only_level3() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE item_level smallint;
BEGIN
  SELECT level INTO item_level FROM work_items WHERE id = NEW.work_item_id;
  IF item_level <> 3 THEN
    RAISE EXCEPTION 'Chỉ nhiệm vụ (cấp 3) mới đặt được nhắc việc'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reminders_only_level3
  BEFORE INSERT OR UPDATE OF work_item_id ON reminders
  FOR EACH ROW EXECUTE FUNCTION reminders_only_level3();

-- ============================ Đề nghị, App, Chat ============================

CREATE TABLE proposals (
  id            bigserial PRIMARY KEY,
  code          text NOT NULL UNIQUE,          -- DN001
  type          text NOT NULL DEFAULT 'Trong kế hoạch'
                CHECK (type IN ('Trong kế hoạch','Ngoài kế hoạch')),
  work_id       bigint REFERENCES works(id) ON DELETE SET NULL,
  work_item_id  bigint REFERENCES work_items(id) ON DELETE SET NULL,
  content       text NOT NULL DEFAULT '',
  url           text NOT NULL DEFAULT '',
  supplier      text NOT NULL DEFAULT '',
  creator_id    bigint REFERENCES users(id) ON DELETE SET NULL,
  creator_name  text NOT NULL DEFAULT '',
  proposal_date date,
  status        text NOT NULL DEFAULT 'Đề xuất mới'
                CHECK (status IN ('Đề xuất mới','Chờ duyệt','Đã duyệt','Từ chối')),
  review_note   text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE apps (
  id            bigserial PRIMARY KEY,
  code          text NOT NULL UNIQUE,          -- APP001
  name          text NOT NULL,
  url           text NOT NULL DEFAULT '',
  icon_url      text NOT NULL DEFAULT '',
  description   text NOT NULL DEFAULT '',
  category      text NOT NULL DEFAULT '',
  allowed_roles text[] NOT NULL DEFAULT '{}',  -- rỗng = mọi vai trò đều thấy
  created_by    bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE chat_messages (
  id         bigserial PRIMARY KEY,
  user_id    bigint REFERENCES users(id) ON DELETE SET NULL,
  user_name  text NOT NULL DEFAULT '',        -- giữ tên lúc gửi, xoá người không mất lịch sử
  message    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================ Thông báo & nhật ký ============================

CREATE TABLE notifications (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    text NOT NULL DEFAULT '',
  type       text NOT NULL DEFAULT 'info',
  is_read    boolean NOT NULL DEFAULT false,
  ref_type   text NOT NULL DEFAULT '',        -- 'work' | 'work_item' | 'proposal' | ''
  ref_id     bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Nhật ký: KHÔNG có FK sang users để xoá người vẫn giữ được dấu vết (đúng mục đích của nhật ký).
CREATE TABLE activity_logs (
  id          bigserial PRIMARY KEY,
  actor_id    bigint,
  actor_name  text NOT NULL DEFAULT '',
  action      text NOT NULL,
  entity_type text NOT NULL DEFAULT '',
  entity_id   bigint,
  work_id     bigint,                          -- để dựng lại "Nhật ký JSON" riêng của công việc (B6)
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id           uuid PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  ip           inet,
  user_agent   text NOT NULL DEFAULT ''
);

-- ============================ Trigger updated_at ============================

CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_works_updated BEFORE UPDATE ON works
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_work_items_updated BEFORE UPDATE ON work_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_proposals_updated BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_apps_updated BEFORE UPDATE ON apps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================ Index (§4.2) ============================

CREATE INDEX idx_work_items_work_level   ON work_items (work_id, level);
CREATE INDEX idx_work_items_parent       ON work_items (parent_id);
CREATE INDEX idx_work_items_assignee_l3  ON work_items (assignee_id) WHERE level = 3;
CREATE INDEX idx_work_items_due_open     ON work_items (due_date)
  WHERE level = 3 AND status <> 'Hoàn thành';
CREATE INDEX idx_works_dept_approval     ON works (department_id, approval_status);
CREATE INDEX idx_works_dates             ON works (start_date, end_date);  -- lọc theo tháng (L1)
CREATE INDEX idx_activity_logs_created   ON activity_logs (created_at DESC);
CREATE INDEX idx_notifications_user_read ON notifications (user_id, is_read);
CREATE INDEX idx_chat_messages_created   ON chat_messages (created_at DESC);
CREATE INDEX idx_sessions_expires        ON sessions (expires_at);

-- Ngoài §4.2: Postgres KHÔNG tự tạo index cho khoá ngoại. Bốn khoá dưới đây bị tra ngược
-- thường xuyên (xoá phòng phải đếm người, mở nhiệm vụ phải lấy nhắc việc).
CREATE INDEX idx_users_department        ON users (department_id);
CREATE INDEX idx_dept_managers_user     ON department_managers (user_id);
CREATE INDEX idx_reminders_item         ON reminders (work_item_id);
CREATE INDEX idx_activity_logs_work     ON activity_logs (work_id);

-- Down Migration

DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS apps;
DROP TABLE IF EXISTS proposals;
DROP TABLE IF EXISTS reminders;
DROP TABLE IF EXISTS work_items;
DROP TABLE IF EXISTS works;
DROP TABLE IF EXISTS department_managers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS departments;

DROP FUNCTION IF EXISTS reminders_only_level3();
DROP FUNCTION IF EXISTS work_items_check_parent();
DROP FUNCTION IF EXISTS next_code(text, regclass, int);
DROP FUNCTION IF EXISTS set_updated_at();

DROP SEQUENCE IF EXISTS seq_app_code;
DROP SEQUENCE IF EXISTS seq_proposal_code;
DROP SEQUENCE IF EXISTS seq_work_item_code;
DROP SEQUENCE IF EXISTS seq_work_code;
DROP SEQUENCE IF EXISTS seq_user_code;
DROP SEQUENCE IF EXISTS seq_department_code;

DROP EXTENSION IF EXISTS citext;

