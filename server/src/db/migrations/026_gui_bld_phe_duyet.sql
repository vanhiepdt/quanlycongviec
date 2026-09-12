-- V7/Q1/Q2: chỉ thêm tích, người nhận vẫn là supervisor_id hiện hữu.
-- Up Migration
ALTER TABLE work_items ADD COLUMN gui_bld_phe_duyet boolean NOT NULL DEFAULT false;
ALTER TABLE work_items ADD CONSTRAINT wi_gui_bld_level CHECK (NOT gui_bld_phe_duyet OR level=3);
ALTER TABLE approval_changes ADD COLUMN change_kind text NOT NULL DEFAULT 'reviewer'
  CHECK (change_kind IN ('reviewer','gui-bld'));
ALTER TABLE approval_changes ADD COLUMN decision text CHECK (decision IN ('approved','rejected'));
ALTER TABLE permission_overrides DROP CONSTRAINT po_action_ok;
ALTER TABLE permission_overrides ADD CONSTRAINT po_action_ok CHECK (
  action IN ('read','create','update','delete','approve','ty-le')
  OR (entity_type='file' AND action='submit') OR (entity_type='task' AND action='gui-bld')
);
ALTER TABLE permission_overrides DROP CONSTRAINT po_cho_duyet;
ALTER TABLE permission_overrides ADD CONSTRAINT po_cho_duyet CHECK (
  action IN ('create','update','delete') OR gia_tri <> 'cho-duyet'
  OR (entity_type='file' AND action='approve' AND vai IN ('Trưởng phòng','Phó phòng'))
  OR (entity_type='file' AND action='submit' AND vai IN ('Trưởng phòng','Phó phòng','Nhân viên'))
  OR (entity_type='task' AND action='gui-bld')
);
-- SELECT */i.* đã đóng băng cột: rebuild cả hai view, giữ nguyên điều kiện loại nháp/chờ.
CREATE OR REPLACE VIEW v_countable_works AS
  SELECT * FROM works WHERE approval_status NOT IN ('Chờ duyệt','Nháp');
CREATE OR REPLACE VIEW v_countable_items AS
  SELECT i.* FROM work_items i JOIN works w ON w.id=i.work_id
    LEFT JOIN work_items p ON p.id=i.parent_id
   WHERE i.approval_status NOT IN ('Chờ duyệt','Nháp')
     AND w.approval_status NOT IN ('Chờ duyệt','Nháp')
     AND (p.id IS NULL OR p.approval_status NOT IN ('Chờ duyệt','Nháp'));
-- Down Migration
DO $$ BEGIN RAISE EXCEPTION '026 không hỗ trợ down tự động: cần giữ luồng và đề nghị đổi tích'; END $$;
