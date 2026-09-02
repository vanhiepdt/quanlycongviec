-- 015_file_sua_truc_tuyen.sql — thêm hành động 'sua-truc-tuyen' vào BẢNG LUỒNG của nhóm file
-- (2026-09-02, Vòng 14 cuối 5).
--
-- Vì sao cần: ONLYOFFICE lưu xong thì `luuTuCallback` ghi một dòng luồng cho bản mới. Trước đây
-- dòng đó mang `hanh_dong = 'nop'` — đúng CHECK của 014 nhưng SAI NGHĨA: người xem «Lịch sử»
-- không phân biệt được «cán bộ nộp bản mới từ máy mình» với «ai đó sửa trực tuyến rồi lưu».
-- Hai việc này khác nhau về người làm (người sửa có thể là Trưởng phòng, không phải người nộp)
-- và khác nhau về ý nghĩa trong luồng duyệt, nên phải là hai hành động khác nhau.
--
-- CHECK trong 014 là ràng buộc trên CỘT (khai inline) nên Postgres tự đặt tên
-- `task_file_flow_hanh_dong_check`. Không viết ALTER ... RENAME: dùng đúng tên đó, và DROP có
-- IF EXISTS để chạy lại được trên CSDL đã nới tay.
--
-- Down: XOÁ các dòng 'sua-truc-tuyen' TRƯỚC khi siết lại CHECK — còn dòng là ADD CONSTRAINT nổ
-- «violates check constraint» (bẫy đã gặp ở 012 và 014, ghi lại ở KE-HOACH-VPS.md §13.5).

-- Up Migration

ALTER TABLE task_file_flow DROP CONSTRAINT IF EXISTS task_file_flow_hanh_dong_check;
ALTER TABLE task_file_flow
  ADD CONSTRAINT task_file_flow_hanh_dong_check CHECK (hanh_dong IN (
    'nop', 'gom-y', 'yeu-cau-sua', 'trinh-lanh-dao', 'tra-ve-tp',
    'tra-ve-cbo', 'duyet-tu-dong', 'duyet', 'hoan-thanh', 'sua-truc-tuyen'
  ));

COMMENT ON TABLE task_file_flow IS
  'BẢNG LUỒNG của nhóm file (014, nới 015): thời điểm · người (vai) · hành động · bản · nội dung. Dòng «Tự động — phân quyền không yêu cầu duyệt» là duyet-tu-dong; dòng lưu từ ONLYOFFICE là sua-truc-tuyen.';

-- Down Migration

-- XOÁ dòng 'sua-truc-tuyen' TRƯỚC khi siết lại CHECK. Mất các dòng luồng đó là ĐÚNG: chúng là
-- vết ghi của một hành động mà lược đồ cũ không biết đến — giữ lại thì ADD CONSTRAINT nổ.
DELETE FROM task_file_flow WHERE hanh_dong = 'sua-truc-tuyen';

ALTER TABLE task_file_flow DROP CONSTRAINT IF EXISTS task_file_flow_hanh_dong_check;
ALTER TABLE task_file_flow
  ADD CONSTRAINT task_file_flow_hanh_dong_check CHECK (hanh_dong IN (
    'nop', 'gom-y', 'yeu-cau-sua', 'trinh-lanh-dao', 'tra-ve-tp',
    'tra-ve-cbo', 'duyet-tu-dong', 'duyet', 'hoan-thanh'
  ));

COMMENT ON TABLE task_file_flow IS
  'BẢNG LUỒNG của nhóm file (014): thời điểm · người (vai) · hành động · bản · nội dung. Dòng «Tự động — phân quyền không yêu cầu duyệt» là duyet-tu-dong.';

