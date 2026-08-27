-- 006_delegations.sql — Ủy quyền có thời hạn (kế hoạch: `docs/KE-HOACH-UY-QUYEN.md`).
--
-- Vấn đề: Phó Giám đốc / Trưởng phòng đi công tác thì việc của phòng vẫn phải chạy — có việc cần
-- duyệt, có nhiệm vụ cần sửa hạn. Trước đây chỉ có hai đường, cả hai đều xấu: đổi `users.role`
-- của người thay thế (quyền không hết hạn, mất dấu vết) hoặc chờ người kia về.
--
-- Ủy quyền = **cho người khác MƯỢN quyền của mình trong một khoảng ngày, có dấu vết, tự hết hiệu
-- lực**. Bốn luật gốc, mỗi luật có một hàng rào ở đây hoặc ở service:
--
--   L1 không tự ủy quyền cho mình  → CHECK `delegation_not_self` (dưới) + service
--   L2 không ủy quyền vai `admin`  → service (`DELEGATION_ADMIN_FORBIDDEN`) + lớp kiểm `can()`
--   L3 không rộng hơn quyền mình   → service (`DELEGATION_SCOPE_TOO_WIDE`)
--   L4 không ủy quyền dây chuyền   → `can()` chỉ mượn quyền cho work/subwork/task
--
-- Vì sao `date` chứ không `timestamptz`: người dùng nghĩ theo NGÀY ("từ 01/09 đến 07/09") và hai
-- đầu ĐỀU TÍNH. Pool giữ `date` ở dạng chuỗi `YYYY-MM-DD` (§13.5 bẫy múi giờ) nên không có chỗ
-- nào `new Date('2026-09-01')` lệch 7 giờ; so ngày dùng `current_date` của Postgres.
--
-- Vì sao `status` chỉ có 'active' | 'cancelled', KHÔNG có 'expired': hết hạn suy ra từ ngày. Một
-- cron cập nhật trạng thái hết hạn là tạo nguồn sự thật thứ hai cho cùng một câu hỏi.

-- Up Migration

-- EXCLUDE dưới đây so `bigint` bằng `=` trong chỉ mục gist; gist lõi không có lớp toán tử cho
-- kiểu này nên phải có btree_gist. IF NOT EXISTS: CSDL thật có thể đã bật sẵn.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE delegations (
  id             bigserial PRIMARY KEY,
  from_user_id   bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Phạm vi phòng của bản ghi. RỖNG KHÔNG phải "toàn quyền": lúc kiểm quyền, rỗng được đọc là
  -- "đúng các phòng người ủy quyền đang phụ trách Ở THỜI ĐIỂM KIỂM". Cách này đúng hơn chép cứng
  -- danh sách lúc tạo — người ủy quyền được giao thêm/bớt phòng thì bản ghi không bị lệch.
  department_ids bigint[] NOT NULL DEFAULT '{}',
  from_date      date NOT NULL,
  to_date        date NOT NULL,
  status         text NOT NULL DEFAULT 'active',
  note           text NOT NULL DEFAULT '',
  created_by     bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delegation_not_self  CHECK (from_user_id <> to_user_id),
  CONSTRAINT delegation_dates_ok  CHECK (to_date >= from_date),
  CONSTRAINT delegation_status_ok CHECK (status IN ('active', 'cancelled'))
);

-- Cùng một CẶP (người ủy quyền, người được ủy quyền) không được có hai bản ghi `active` mà khoảng
-- ngày giao nhau. `'[]'` = bao gồm cả hai đầu, khớp đúng luật hiệu lực. Hai bản liền kề nhưng
-- không chồng (01–07 và 08–14) vẫn được. Bản `cancelled` không tính (mệnh đề WHERE) nên huỷ rồi
-- tạo lại đúng khoảng đó là việc bình thường.
ALTER TABLE delegations
  ADD CONSTRAINT delegation_no_overlap
  EXCLUDE USING gist (
    from_user_id WITH =,
    to_user_id   WITH =,
    daterange(from_date, to_date, '[]') WITH &&
  ) WHERE (status = 'active');

-- Đường NÓNG của mỗi request: "người đang gọi có bản ghi nào đang hiệu lực cho mình không".
-- Chỉ mục phần (partial) vì chỉ dòng `active` được hỏi tới.
CREATE INDEX idx_delegations_to_active ON delegations (to_user_id) WHERE status = 'active';
-- Trang "ủy quyền của tôi" hỏi theo người ủy quyền.
CREATE INDEX idx_delegations_from ON delegations (from_user_id);

CREATE TRIGGER trg_delegations_updated BEFORE UPDATE ON delegations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TRIGGER IF EXISTS trg_delegations_updated ON delegations;
DROP INDEX IF EXISTS idx_delegations_from;
DROP INDEX IF EXISTS idx_delegations_to_active;
ALTER TABLE IF EXISTS delegations DROP CONSTRAINT IF EXISTS delegation_no_overlap;
DROP TABLE IF EXISTS delegations;

-- btree_gist CỐ Ý không gỡ: extension là tài sản chung của CSDL, thứ khác có thể đang dùng.
