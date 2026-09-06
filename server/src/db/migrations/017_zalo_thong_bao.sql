-- 017_zalo_thong_bao.sql — ĐẨY THÔNG BÁO SANG ZALO BOT (2026-09-06, việc B của
-- `docs/KE-HOACH-THONG-BAO.md`; §13.4 mục 25 người dùng đã chốt: «tôi cầm bot», 20 người tự nhắn).
--
-- Vì sao cần lược đồ mới thay vì gọi Zalo ngay tại chỗ ghi `notifications`:
--
--  1. **Không có cách nào tra `chat_id` của một người từ email/số điện thoại.** Zalo Bot chỉ tiết
--     lộ `chat.id` TRONG sự kiện người đó nhắn cho bot (tài liệu `docs/webhook` của
--     bot.zaloplatforms.com). Nên phải có chỗ GIỮ `chat_id` (users.zalo_chat_id) và một thủ tục
--     liên kết một lần (zalo_link_codes).
--  2. **Không được gọi mạng bên trong transaction.** `approvals/service.js` ghi thông báo bên
--     trong `withTransaction` đang giữ khoá dòng công việc; một lời gọi HTTP ra Internet ở đó là
--     giữ khoá theo độ trễ của Zalo. Nên phần đẩy là HÀNG ĐỢI đọc sau khi commit — ba cột
--     `zalo_*` trên `notifications` chính là hàng đợi đó.
--  3. **Container tắt giữa chừng không được mất tin, cũng không được dội tin.** Trạng thái nằm ở
--     CSDL (`zalo_sent_at`, `zalo_attempts`) chứ không ở biến nhớ — cùng lý lẽ đã ghi ở đầu
--     `src/services/cron.js` cho lượt quét quá hạn.
--
-- Ba thay đổi, không hơn:
--   1. `users.zalo_chat_id` + `ux_users_zalo_chat_id` (unique BỘ PHẬN, chỉ trên dòng đã liên kết).
--   2. `zalo_link_codes` — mã 6 số dùng MỘT LẦN, hạn 15 phút, gắn với đúng người đang đăng nhập.
--   3. `notifications.zalo_sent_at` / `zalo_attempts` / `zalo_error` + `idx_notifications_zalo_pending`.
--
-- `ux_users_zalo_chat_id` là UNIQUE BỘ PHẬN (`WHERE zalo_chat_id IS NOT NULL`) theo đúng khuôn
-- `ux_wmn_work`/`ux_wmn_item` của 008: nếu để UNIQUE thường thì mọi dòng chưa liên kết đều NULL và
-- Postgres coi các NULL là khác nhau nên vẫn chèn được — nhưng cột sẽ mất chỉ mục có ích, còn viết
-- bộ phận thì nói rõ ý: **một tài khoản Zalo chỉ gắn được cho MỘT người dùng**. Thiếu ràng buộc này
-- thì hai người đổi mã cho nhau là nhận thông báo của nhau.
--
-- `zalo_attempts` có CHECK 0..10 chứ không để tự do: nó là bộ đếm của lịch chạy, giá trị âm hay
-- khổng lồ chỉ có thể là lỗi mã. Ngưỡng dừng thật (3 lần) nằm ở vị từ chỉ mục và ở service —
-- CHECK ở đây chỉ chặn giá trị vô nghĩa, không phải chỗ khai luật nghiệp vụ.
--
-- `idx_notifications_zalo_pending` là chỉ mục BỘ PHẬN đúng bằng câu hỏi của lịch chạy: «dòng nào
-- chưa gửi và chưa thử quá 3 lần». Bảng `notifications` lớn dần theo thời gian còn hàng đợi luôn
-- ngắn, nên chỉ mục bộ phận giữ nhỏ mãi. Cùng khuôn `idx_work_items_pending` (012) và
-- `idx_works_xoa_cho_duyet` (013).
--
-- `zalo_link_codes.code` UNIQUE toàn bảng (không bộ phận): mã phải tra được bằng chính nó khi
-- webhook/polling nhận tin, và không được có hai người cùng mang một mã cùng lúc. Dòng đã dùng vẫn
-- giữ lại (`used_at`) để đối chiếu về sau; lịch dọn không cần thiết vì mỗi người tối đa vài dòng.
--
-- Down: `zalo_link_codes` xoá cả bảng nên không cần hạ dữ liệu. Ba cột trên `notifications` và cột
-- trên `users` chỉ DROP — không có ràng buộc NOT NULL nào phải siết lại, nên không mắc bẫy «hạ dữ
-- liệu trước khi siết ràng buộc» của 012/014/015/016. Chỉ mục viết DROP tường minh dù Postgres tự
-- xoá theo cột, giữ đúng thói quen của 013:98-99 và 014:140-142.

-- Up Migration

ALTER TABLE users ADD COLUMN zalo_chat_id text;

CREATE UNIQUE INDEX ux_users_zalo_chat_id
  ON users (zalo_chat_id) WHERE zalo_chat_id IS NOT NULL;

COMMENT ON COLUMN users.zalo_chat_id IS
  'chat.id của Zalo Bot (017) — CHỈ có sau khi người dùng tự nhắn mã liên kết cho bot. KHÔNG nằm trong PUBLIC_COLUMNS và KHÔNG nằm trong WRITABLE: API chỉ trả cờ đã-liên-kết, không trả định danh này.';

CREATE TABLE zalo_link_codes (
  id         bigserial PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       text   NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  chat_id    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT zlc_code_6_so CHECK (code ~ '^[0-9]{6}$')
);

CREATE INDEX idx_zalo_link_codes_user ON zalo_link_codes (user_id, created_at DESC);

COMMENT ON TABLE zalo_link_codes IS
  'Mã liên kết Zalo dùng MỘT LẦN (017). Người đang đăng nhập bấm «Lấy mã» → nhắn «LIENKET <mã>» cho bot → webhook/polling đối chiếu rồi ghi users.zalo_chat_id. Mã 6 số + hạn 15 phút + một lần dùng: nếu bot nhận email thì ai biết email người khác cũng chiếm được kênh thông báo của họ.';
COMMENT ON COLUMN zalo_link_codes.chat_id IS
  'chat.id đã dùng mã này — giữ để đối chiếu về sau (ai liên kết bằng mã nào), không dùng để gửi tin.';

ALTER TABLE notifications ADD COLUMN zalo_sent_at  timestamptz;
ALTER TABLE notifications ADD COLUMN zalo_attempts int  NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN zalo_error    text NOT NULL DEFAULT '';

ALTER TABLE notifications
  ADD CONSTRAINT noti_zalo_attempts_ok CHECK (zalo_attempts >= 0 AND zalo_attempts <= 10);

CREATE INDEX idx_notifications_zalo_pending
  ON notifications (id) WHERE zalo_sent_at IS NULL AND zalo_attempts < 3;

COMMENT ON COLUMN notifications.zalo_sent_at IS
  'Đã xử lý xong việc đẩy Zalo cho dòng này (017). NULL = còn trong hàng đợi. Cũng được đặt cho người CHƯA liên kết Zalo, kèm zalo_error = ''chưa liên kết Zalo'' — để lịch chạy không quét lại mãi.';
COMMENT ON COLUMN notifications.zalo_attempts IS
  'Số lần đã thử gửi Zalo (017). Đủ 3 lần thì thôi — vị từ của idx_notifications_zalo_pending lọc sẵn.';
COMMENT ON COLUMN notifications.zalo_error IS
  'Lý do lần gửi Zalo gần nhất thất bại (017), tiếng Việt. Rỗng = chưa từng lỗi. KHÔNG chứa token.';

-- Down Migration

DROP INDEX IF EXISTS idx_notifications_zalo_pending;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS noti_zalo_attempts_ok;

ALTER TABLE notifications DROP COLUMN IF EXISTS zalo_error;
ALTER TABLE notifications DROP COLUMN IF EXISTS zalo_attempts;
ALTER TABLE notifications DROP COLUMN IF EXISTS zalo_sent_at;

DROP INDEX IF EXISTS idx_zalo_link_codes_user;
DROP TABLE IF EXISTS zalo_link_codes;

DROP INDEX IF EXISTS ux_users_zalo_chat_id;
ALTER TABLE users DROP COLUMN IF EXISTS zalo_chat_id;
