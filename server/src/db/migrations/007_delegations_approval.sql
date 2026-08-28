-- 007_delegations_approval.sql — Ủy quyền phải có PHÊ DUYỆT của người được ủy quyền
-- (§13.4 mục 20, chốt 2026-08-28: «Cần thông báo và phê duyệt của người được ủy quyền»).
--
-- Trước bản này, tạo bản ủy quyền là có hiệu lực NGAY: người nhận có thể đang mang quyền của người
-- khác mà không biết, và không có đường nào để họ nói "tôi không nhận". Sau bản này bản ghi đi qua
-- hai bước — người ủy quyền ĐỀ NGHỊ (`pending`, chưa cho mượn gì), người nhận ĐỒNG Ý (`active`)
-- hoặc TỪ CHỐI (`declined`).
--
-- Bốn thay đổi, mỗi thay đổi bịt một lỗ nếu thiếu:
--
--   1. `status` thêm 'pending' | 'declined' và DEFAULT đổi sang 'pending'. Đổi cả DEFAULT chứ không
--      chỉ sửa service: một câu INSERT viết tay (seed, sửa tay trong CSDL) không được lặng lẽ sinh
--      ra quyền cho người chưa đồng ý.
--   2. `accepted_at` / `declined_at` — biết người nhận trả lời LÚC NÀO. Không suy được từ
--      `updated_at`: sửa `note` cũng đẩy mốc đó.
--   3. EXCLUDE `delegation_no_overlap` nới sang cả 'pending'. Nếu chỉ chặn 'active' thì cùng một
--      cặp người tạo được hai đề nghị chồng ngày; đồng ý cả hai thì ràng buộc mới vỡ, tức là lỗi
--      hiện ra ở tay NGƯỜI NHẬN chứ không ở tay người tạo sai.
--   4. Chỉ mục nóng nới theo: hộp «chờ tôi phê duyệt» hỏi theo `to_user_id` đúng như đường mượn
--      quyền của `attachSession`.
--
-- Vẫn KHÔNG có 'expired' (như 006): hết hạn suy ra từ ngày, thêm trạng thái là thêm nguồn sự thật
-- thứ hai cho cùng một câu hỏi.

-- Up Migration

ALTER TABLE delegations
  ADD COLUMN accepted_at timestamptz,
  ADD COLUMN declined_at timestamptz;

ALTER TABLE delegations DROP CONSTRAINT delegation_status_ok;
ALTER TABLE delegations
  ADD CONSTRAINT delegation_status_ok
  CHECK (status IN ('pending', 'active', 'declined', 'cancelled'));

ALTER TABLE delegations ALTER COLUMN status SET DEFAULT 'pending';

-- Các dòng ĐANG CÓ giữ nguyên 'active': chúng được tạo theo luật cũ (tạo là có hiệu lực). Bắt phê
-- duyệt lại một bản ủy quyền đang chạy là cắt quyền của người ta giữa kỳ đi công tác.
ALTER TABLE delegations DROP CONSTRAINT delegation_no_overlap;
ALTER TABLE delegations
  ADD CONSTRAINT delegation_no_overlap
  EXCLUDE USING gist (
    from_user_id WITH =,
    to_user_id   WITH =,
    daterange(from_date, to_date, '[]') WITH &&
  ) WHERE (status IN ('pending', 'active'));

DROP INDEX IF EXISTS idx_delegations_to_active;
CREATE INDEX idx_delegations_to_active ON delegations (to_user_id)
  WHERE status IN ('active', 'pending');

-- Down Migration

-- 'pending' và 'declined' không có trong CHECK của 006 nên phải dọn trước khi thu hẹp lại. Đưa về
-- 'cancelled' (không cho mượn gì) chứ KHÔNG về 'active': hạ cấp lược đồ không được biến một đề
-- nghị chưa ai đồng ý thành quyền thật.
UPDATE delegations SET status = 'cancelled' WHERE status IN ('pending', 'declined');

DROP INDEX IF EXISTS idx_delegations_to_active;
CREATE INDEX idx_delegations_to_active ON delegations (to_user_id) WHERE status = 'active';

ALTER TABLE delegations DROP CONSTRAINT IF EXISTS delegation_no_overlap;
ALTER TABLE delegations
  ADD CONSTRAINT delegation_no_overlap
  EXCLUDE USING gist (
    from_user_id WITH =,
    to_user_id   WITH =,
    daterange(from_date, to_date, '[]') WITH &&
  ) WHERE (status = 'active');

ALTER TABLE delegations ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE delegations DROP CONSTRAINT IF EXISTS delegation_status_ok;
ALTER TABLE delegations
  ADD CONSTRAINT delegation_status_ok CHECK (status IN ('active', 'cancelled'));

ALTER TABLE delegations
  DROP COLUMN IF EXISTS declined_at,
  DROP COLUMN IF EXISTS accepted_at;
