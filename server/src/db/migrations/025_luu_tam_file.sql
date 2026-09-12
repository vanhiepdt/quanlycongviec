-- V4: tải lên chỉ lưu tạm; gửi đi là hành động riêng, không đổi dữ liệu lịch sử.
-- Chỉ đổi task_files/task_file_flow/permission_overrides, không cần rebuild view.
-- Up Migration
ALTER TABLE task_files DROP CONSTRAINT task_files_trang_thai_check;
ALTER TABLE task_files ADD CONSTRAINT task_files_trang_thai_check CHECK (
  trang_thai IN ('luu-tam','cho-xem','can-sua','cho-lanh-dao','hoan-thanh','da-duyet')
);
ALTER TABLE task_files ALTER COLUMN trang_thai SET DEFAULT 'luu-tam';
ALTER TABLE task_file_flow DROP CONSTRAINT task_file_flow_hanh_dong_check;
ALTER TABLE task_file_flow ADD CONSTRAINT task_file_flow_hanh_dong_check CHECK (
  hanh_dong IN ('nop','gom-y','yeu-cau-sua','trinh-lanh-dao','tra-ve-tp','tra-ve-cbo',
    'duyet-tu-dong','duyet','hoan-thanh','sua-truc-tuyen','huy-lenh-sua','luu-tam','gui-duyet')
);
ALTER TABLE permission_overrides DROP CONSTRAINT po_action_ok;
ALTER TABLE permission_overrides ADD CONSTRAINT po_action_ok CHECK (
  action IN ('read','create','update','delete','approve','ty-le')
  OR (entity_type='file' AND action='submit')
);
ALTER TABLE permission_overrides DROP CONSTRAINT po_cho_duyet;
ALTER TABLE permission_overrides ADD CONSTRAINT po_cho_duyet CHECK (
  action IN ('create','update','delete') OR gia_tri <> 'cho-duyet'
  OR (entity_type='file' AND action='approve' AND vai IN ('Trưởng phòng','Phó phòng'))
  OR (entity_type='file' AND action='submit' AND vai IN ('Trưởng phòng','Phó phòng','Nhân viên'))
);

-- Down Migration
-- Không tự biến bản nháp thành bản đã gửi và không xoá lịch sử khi rollback.
DO $$ BEGIN RAISE EXCEPTION '025 không hỗ trợ down tự động: cần giữ bản nháp và lịch sử gửi duyệt'; END $$;
