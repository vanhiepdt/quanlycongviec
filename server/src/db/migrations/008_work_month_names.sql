-- 008_work_month_names.sql — TÊN THEO THÁNG cho công việc / công việc con / nhiệm vụ
-- (yêu cầu 2026-08-28: «việc kéo dài hơn 1 tháng thì sửa được tên ở các tháng tiếp theo; xem theo
-- tháng nào thì hiện tên của tháng đó, kể cả trên sơ đồ Gantt; chưa sửa thì vẫn tên gốc»).
--
-- BẢNG RIÊNG, KHÔNG PHẢI CỘT jsonb TRÊN `works`/`work_items` — ba lý do, mỗi lý do đủ để tự quyết:
--
--   1. Sơ đồ Gantt đọc số liệu qua `v_countable_works`/`v_countable_items` bằng hai hằng truy vấn
--      của `stats/repo.js`, và `countable-views.test.js` soi chính hai hằng đó bằng EXPLAIN. Thêm
--      cột là phải sửa hằng (hoặc sửa view) — đổi đúng thứ đang bị ghim để lấy một cột hiển thị.
--   2. Cấp 1 nằm ở `works`, cấp 2/cấp 3 nằm ở `work_items`. Hai cột FK **nullable** + CHECK «đúng
--      một cột có giá trị» cho ra CASCADE THẬT: xoá đầu việc là tên-theo-tháng đi theo, không để
--      dòng rác. (Khác `activity_logs` — nhật ký CỐ Ý không có FK để dòng đã xoá còn dấu vết.)
--   3. Sửa tên của MỘT tháng là một câu UPDATE một dòng. Với jsonb thì phải đọc–sửa–ghi lại cả
--      khối: hai người sửa hai tháng khác nhau cùng lúc là một người mất bản ghi, im lặng.
--
-- `month` là **text 'YYYY-MM'**, không phải `date`: mọi tầng đang nói đúng dạng này — bộ lọc tháng
-- của `works.list`, `workMatchesMonth` và `thangLocCongViec` phía giao diện, hai ô `<select>`
-- Tháng/Năm. Dùng `date` là thêm một phép đổi kiểu ở mọi chỗ và một lớp múi giờ, đổi lại không được
-- gì: không có phép tính ngày nào chạy trên cột này.
--
-- KHÔNG có cột `level`: cấp suy ra từ `work_items.level` của dòng được trỏ tới. Lưu thêm là tạo
-- nguồn sự thật thứ hai cho cùng một câu hỏi.

-- Up Migration

CREATE TABLE work_month_names (
  id         bigserial PRIMARY KEY,
  work_id    bigint REFERENCES works(id)      ON DELETE CASCADE,
  item_id    bigint REFERENCES work_items(id) ON DELETE CASCADE,
  month      text NOT NULL,
  name       text NOT NULL,
  created_by bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- `<>` trên hai vị từ NULL: đúng MỘT trong hai cột có giá trị. Viết
  -- `(work_id IS NOT NULL AND item_id IS NULL) OR (...)` cũng đúng nhưng dài gấp ba.
  CONSTRAINT wmn_mot_dich CHECK ((work_id IS NULL) <> (item_id IS NULL)),
  CONSTRAINT wmn_thang_dang CHECK (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  -- Tên rỗng KHÔNG phải là "đặt tên rỗng" mà là "bỏ tên riêng của tháng này" — đường đó là DELETE.
  CONSTRAINT wmn_ten_khong_rong CHECK (btrim(name) <> '')
);

-- Hai chỉ mục MỘT PHẦN thay cho một UNIQUE(work_id, item_id, month): trong Postgres, UNIQUE coi hai
-- dòng có NULL là khác nhau, nên khoá ba cột KHÔNG chặn được hai dòng `(NULL, 7, '2026-09')`.
CREATE UNIQUE INDEX ux_wmn_work ON work_month_names (work_id, month) WHERE work_id IS NOT NULL;
CREATE UNIQUE INDEX ux_wmn_item ON work_month_names (item_id, month) WHERE item_id IS NOT NULL;

CREATE TRIGGER trg_work_month_names_updated BEFORE UPDATE ON work_month_names
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE work_month_names IS
  'Tên hiển thị riêng theo từng tháng của một đầu việc kéo dài nhiều tháng (yêu cầu 2026-08-28). Thiếu dòng ⇒ dùng tên gốc.';
COMMENT ON COLUMN work_month_names.month IS 'Tháng dạng YYYY-MM — cùng dạng chuỗi với bộ lọc tháng của giao diện.';

-- Down Migration

DROP TABLE IF EXISTS work_month_names;
