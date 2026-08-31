-- 011_permission_cho_duyet_update_delete.sql — mở «Chờ duyệt» cho SỬA và XOÁ (Vòng 11).
--
-- Vòng 9 chỉ cho 'cho-duyet' ở action = 'create'. Người dùng yêu cầu: các chức năng sửa/xoá của
-- Trưởng phòng / Phó phòng cũng phải có lựa chọn «Chờ duyệt». Ý nghĩa:
--   create ⇒ dòng mới rơi «Chờ duyệt» (trangThaiDuyetKhiTao)
--   update ⇒ sau khi lưu, mục «Đã duyệt» quay về «Chờ duyệt» (mở rộng choDuyetLai)
--   delete ⇒ CHẶN xoá trực tiếp với câu nói rõ (luồng duyệt-yêu-cầu-xoá chưa có — §13.4)

-- Up Migration

ALTER TABLE permission_overrides
  DROP CONSTRAINT IF EXISTS po_cho_duyet;

ALTER TABLE permission_overrides
  ADD CONSTRAINT po_cho_duyet CHECK (
    action IN ('create', 'update', 'delete') OR gia_tri <> 'cho-duyet'
  );

-- Down Migration

ALTER TABLE permission_overrides
  DROP CONSTRAINT IF EXISTS po_cho_duyet;

ALTER TABLE permission_overrides
  ADD CONSTRAINT po_cho_duyet CHECK (action = 'create' OR gia_tri <> 'cho-duyet');
