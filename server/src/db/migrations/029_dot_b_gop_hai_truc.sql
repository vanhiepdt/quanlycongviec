-- ĐỢT B (11/09/2026) — «gộp hai trục»: verdict gọn lại, có mốc «TP/PP phê duyệt», tỷ lệ qua duyệt.
--
-- Bốn việc của migration này, đều là quyết định đã chốt trong docs/BAT-DAU-SESSION.md:
--
--   (1) ĐIỂM 9 — `yeu-cau-sua` và `tra-ve-cbo` là HAI NÚT CHO MỘT VIỆC: cùng `den:'can-sua'`, cùng
--       `datLenhSua(...,'can-bo',...)`, khác đúng `tu` và `canNoiDung`. Gộp về MỘT mã `tra-ve-cbo`.
--   (2) ĐIỂM 7 — TP/PP không có hành động «Phê duyệt»: `trinh-lanh-dao` chỉ đổi trạng thái, không lưu
--       mốc ai đã duyệt và duyệt lúc nào. Đổi tên thành `tp-phe-duyet` («TP/PP phê duyệt») và thêm hai
--       cột mốc trên `task_files`. Trạng thái đích GIỮ NGUYÊN `cho-lanh-dao` — Q5/Q6 không đổi luồng.
--   (3) R4'' — tỷ lệ đi qua `approval_changes` bằng một `change_kind` MỚI (`ty-le`), giá trị cũ giữ
--       nguyên tới khi được duyệt, đúng khuôn `proposeGuiBld` của 026.
--   (4) R6 — bỏ tự duyệt file. KHÔNG xoá mã `duyet-tu-dong` khỏi CHECK: dòng lịch sử cũ phải đọc được,
--       và nó nói thật rằng lúc đó hệ thống tự duyệt chứ không ai ký. Chỉ là không còn được ghi thêm.
--
-- Không có view nào dựng trên `task_files` (chỉ 024 chạm bảng này và không tạo view) nên thêm cột ở
-- đây KHÔNG phải rebuild `v_countable_*` — khác hẳn 026/028.
--
-- Up Migration

-- ── (1)+(2) ĐỔI TÊN HAI MÃ VERDICT ────────────────────────────────────────────────────────────────
-- PHẢI xoá CHECK CŨ TRƯỚC rồi mới UPDATE dữ liệu. CHECK cũ (014 → 025) liệt kê `yeu-cau-sua` và
-- `trinh-lanh-dao`, KHÔNG có `tp-phe-duyet` — nên đổi dữ liệu trước là Postgres chặn ngay câu UPDATE
-- bằng chính cái CHECK chưa bị xoá. Đã nổ thật trên UAT ngày 11/09/2026
-- (`23514 task_file_flow_hanh_dong_check`, dòng id 6 `trinh-lanh-dao`); trên CSDL test bảng này RỖNG
-- lúc 029 chạy nên hai câu UPDATE trúng 0 dòng và lỗi không lộ. 015/020/025/026 cũng DROP trước
-- ADD; điểm khác là chúng chỉ NỚI danh sách chứ không đổi tên giá trị nào.
-- DROP → UPDATE → ADD chạy trong MỘT transaction của node-pg-migrate nên không có lúc nào bảng
-- thiếu ràng buộc mà lộ ra ngoài.
ALTER TABLE task_file_flow DROP CONSTRAINT task_file_flow_hanh_dong_check;

-- ĐIỂM 9: gộp `yeu-cau-sua` vào `tra-ve-cbo`.
UPDATE task_file_flow SET hanh_dong = 'tra-ve-cbo' WHERE hanh_dong = 'yeu-cau-sua';
-- ĐIỂM 7: `trinh-lanh-dao` thành `tp-phe-duyet`.
UPDATE task_file_flow SET hanh_dong = 'tp-phe-duyet' WHERE hanh_dong = 'trinh-lanh-dao';

-- Chốt an toàn trước khi ADD: ADD CONSTRAINT soi lại MỌI dòng, nên chỉ cần một mã lạ còn sót là
-- nổ `23514` mà không nói mã nào. Nêu đích danh ở đây để người vận hành VPS (đang ở 021, dữ liệu
-- khác UAT) biết phải xử lý gì thay vì đoán.
DO $$
DECLARE
  ma_la text;
BEGIN
  SELECT string_agg(DISTINCT hanh_dong, ', ' ORDER BY hanh_dong) INTO ma_la
    FROM task_file_flow
   WHERE hanh_dong NOT IN ('nop','gom-y','tp-phe-duyet','tra-ve-tp','tra-ve-cbo',
     'duyet-tu-dong','duyet','hoan-thanh','sua-truc-tuyen','huy-lenh-sua','luu-tam','gui-duyet');
  IF ma_la IS NOT NULL THEN
    RAISE EXCEPTION
      '029: task_file_flow con ma verdict ngoai danh sach moi: %. Khong tu doi du lieu - xu ly tay roi migrate lai.',
      ma_la;
  END IF;
END $$;

ALTER TABLE task_file_flow ADD CONSTRAINT task_file_flow_hanh_dong_check CHECK (
  hanh_dong IN ('nop','gom-y','tp-phe-duyet','tra-ve-tp','tra-ve-cbo',
    'duyet-tu-dong','duyet','hoan-thanh','sua-truc-tuyen','huy-lenh-sua','luu-tam','gui-duyet')
);

-- Mốc «TP/PP phê duyệt»: AI và LÚC NÀO. `ON DELETE SET NULL` giống `task_file_flow.nguoi_id` — tài
-- khoản bị xoá thì mất tên người ký nhưng không kéo nhóm file đi theo.
ALTER TABLE task_files
  ADD COLUMN tp_duyet_boi bigint REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN tp_duyet_luc timestamptz;

-- Điền ngược cho dữ liệu cũ: mốc là lần `tp-phe-duyet` MUỐN NHẤT của nhóm (đã đổi tên ở trên nên
-- câu này bắt được cả lịch sử `trinh-lanh-dao` từ trước 029). `hoan-thanh` cũng là một lần TP/PP ký
-- (Q11) nên tính chung; `duyet-tu-dong` thì KHÔNG — đó là máy tự chốt, không có người.
WITH moc AS (
  SELECT DISTINCT ON (file_id) file_id, nguoi_id, created_at
    FROM task_file_flow
   WHERE hanh_dong IN ('tp-phe-duyet','hoan-thanh')
   ORDER BY file_id, id DESC
)
UPDATE task_files f
   SET tp_duyet_boi = moc.nguoi_id, tp_duyet_luc = moc.created_at
  FROM moc WHERE moc.file_id = f.id;

-- ── (3) `approval_changes` NHẬN THÊM LOẠI `ty-le` ─────────────────────────────────────────────────
ALTER TABLE approval_changes DROP CONSTRAINT approval_changes_change_kind_check;
ALTER TABLE approval_changes ADD CONSTRAINT approval_changes_change_kind_check
  CHECK (change_kind IN ('reviewer','gui-bld','ty-le'));

-- Đề nghị tỷ lệ của MỘT NHÓM FILE (R4': gửi đúng 1 BLĐKS của nhiệm vụ cấp 3 chứa nó). Một nhiệm vụ
-- có nhiều nhóm file, mỗi nhóm một tỷ lệ riêng ⇒ phải phân biệt được đề nghị của nhóm nào, nếu không
-- index unique bên dưới bắt hai nhóm của cùng nhiệm vụ xếp hàng chờ nhau.
-- `ON DELETE CASCADE`: xoá nhóm file thì đề nghị tỷ lệ của nó cũng hết nghĩa vụ tồn tại.
ALTER TABLE approval_changes
  ADD COLUMN file_id bigint REFERENCES task_files(id) ON DELETE CASCADE;

-- Hai index «mỗi dòng chỉ MỘT đề nghị đang chờ» của 023 nay phải theo `change_kind`: không có nó thì
-- một đề nghị đổi tích đang treo chặn luôn đề nghị đổi tỷ lệ của cùng nhiệm vụ và ngược lại — hai việc
-- không liên quan gì nhau. `COALESCE(file_id,0)` để đề nghị tỷ lệ của TỪNG NHÓM FILE không đè nhau.
DROP INDEX approval_changes_pending_work;
DROP INDEX approval_changes_pending_item;
CREATE UNIQUE INDEX approval_changes_pending_work ON approval_changes(work_id, change_kind)
  WHERE item_id IS NULL AND approved_at IS NULL;
CREATE UNIQUE INDEX approval_changes_pending_item
  ON approval_changes(item_id, change_kind, COALESCE(file_id, 0))
  WHERE item_id IS NOT NULL AND approved_at IS NULL;

-- Down Migration
-- KHÔNG tự lùi được, giống 025 và 026:
--   • `yeu-cau-sua` đã bị GỘP vào `tra-ve-cbo` — sau câu UPDATE ở trên không còn cách nào biết dòng
--     lịch sử nào từng là nút nào (hai nút cũ chỉ khác `tu` và `canNoiDung`, đều không lưu lại).
--   • xoá các đề nghị `ty-le` đang treo là xoá việc người dùng đang chờ ký.
-- Lùi thật sự = khôi phục bản sao lưu trước khi chạy migration.
DO $$ BEGIN
  RAISE EXCEPTION '029 không hỗ trợ down tự động: lịch sử verdict đã gộp và đề nghị tỷ lệ phải giữ';
END $$;
