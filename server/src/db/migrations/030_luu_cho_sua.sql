-- «LƯU CHỜ» (12/09/2026) — sửa một mục ĐÃ DUYỆT thì cất vào GIỎ, cột thật giữ giá trị cũ.
--
-- Chỉ đạo người dùng: «khi sửa thông tin gì cũng có chế độ lưu chờ (tức là cho sửa tiếp), rồi nút ấn
-- gửi duyệt thay vì gửi duyệt luôn khi ấn cập nhật như bây giờ, và trước khi ấn nút gửi duyệt thì phải
-- hiển thị popup những cái thay đổi, chắc chắn rồi ấn ok để gửi đi duyệt». Bốn câu đã chốt:
--   S1 — «Lưu chờ» = GIỎ CHỜ, cột thật GIỮ giá trị cũ; lưới vẫn hiện «Đã duyệt» kèm badge «có sửa chờ».
--   S2 — phạm vi CHỈ mục đang «Đã duyệt»; «Nháp»/«Chờ duyệt»/«Từ chối» giữ nguyên hành vi cũ.
--   S3 — ở màn hình công việc con, «Gửi duyệt» gửi CẢ CÂY một lần.
--   S4 — popup liệt kê thay đổi CÓ Ô TICK: bỏ tick thì thay đổi đó ở lại giỏ, chưa gửi.
--
-- Vì sao dùng lại `approval_changes` chứ không lập bảng mới: S1 đúng nguyên văn cơ chế R4'' mà trục tỷ
-- lệ (`change_kind = 'ty-le'`) đang chạy — một dòng giữ đề nghị, `valueFrom`/`valueTo` nằm TRONG mảng
-- `changes` nên không cần cột nào mới, giá trị cũ giữ nguyên tới khi được gửi, và cây không bị hạ nên
-- `v_countable_items` không mất số. Thêm một `change_kind` là mở đúng chỗ đã mở hai lần (026, 029).
--
-- Hai unique index của 029 đã cho đúng MỘT giỏ `luu-cho` đang chờ trên mỗi dòng, nên «cho sửa tiếp
-- nhiều lượt» là MERGE vào giỏ cũ (cùng thuật toán `recordReviewerChanges` đang dùng), không phải thêm
-- dòng. Không đụng index nào.

-- Up Migration

-- Nới CHECK thêm `'luu-cho'`. Không cần chốt an toàn trước khi ADD như 029: `change_kind` chỉ nhận bốn
-- giá trị này và ba giá trị cũ đang nằm trong CHECK hiện hành, nên không thể có mã lạ còn sót.
ALTER TABLE approval_changes DROP CONSTRAINT approval_changes_change_kind_check;
ALTER TABLE approval_changes ADD CONSTRAINT approval_changes_change_kind_check
  CHECK (change_kind IN ('reviewer','gui-bld','ty-le','luu-cho'));

-- Down Migration
-- KHÁC 025/026/029: migration này lùi ĐƯỢC, vì nó chỉ nới một CHECK — không gộp lịch sử, không đổi
-- hình dạng dữ liệu. Nhưng lùi thì phải xoá các giỏ `luu-cho` (CHECK mới không nhận giá trị đó), mà
-- giỏ đang treo là việc người dùng đang chờ gửi. Nên down KIỂM rồi mới lùi, không âm thầm xoá.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM approval_changes WHERE change_kind = 'luu-cho' AND approved_at IS NULL
  ) THEN
    RAISE EXCEPTION
      '030 không lùi được tự động: còn giỏ «lưu chờ» đang treo — hãy gửi duyệt hoặc huỷ chúng trước';
  END IF;
  DELETE FROM approval_changes WHERE change_kind = 'luu-cho';
  ALTER TABLE approval_changes DROP CONSTRAINT approval_changes_change_kind_check;
  ALTER TABLE approval_changes ADD CONSTRAINT approval_changes_change_kind_check
    CHECK (change_kind IN ('reviewer','gui-bld','ty-le'));
END $$;
