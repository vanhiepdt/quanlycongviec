-- 014_nhiem_vu_file_ket_qua.sql — KẾT QUẢ NHIỆM VỤ LÀ FILE: nộp → góp ý → duyệt (2026-09-01).
--
-- Luồng người dùng mô tả bằng lời (code phải khớp nguyên văn):
--   1. Cán bộ (người được giao nhiệm vụ) upload file Word/PDF → bản 1.
--   2. Trưởng phòng/Phó phòng (phòng của công việc) xem, góp ý, rồi chọn: (a) Yêu cầu sửa lại
--      (kèm góp ý) → cán bộ nộp bản mới, lặp tới khi ưng; (b) Trình Phó giám đốc phụ trách hoặc
--      Giám đốc; (c) Hoàn thành luôn.
--   3. Giám đốc/Phó giám đốc nhận thông báo, cho ý kiến thì ĐẨY VỀ TP/PP (TP/PP lúc đó tự nộp
--      bản mới của mình HOẶC đẩy về nhân viên, lặp lại); đồng ý thì Duyệt — kết quả chốt, khóa
--      upload.
--
-- Mỗi NHÓM file có MỘT BẢNG LUỒNG (`task_file_flow`): thời điểm · người (vai) · hành động · bản ·
-- nội dung — nhìn phát hiểu file đã đi qua đâu. Trạng thái nhóm (5 giá trị):
--   'cho-xem'      chờ TP/PP xem (mặc định sau nộp của Cán bộ)
--   'can-sua'      người phải sửa cần nộp bản mới
--   'cho-lanh-dao' chờ Phó GĐ phụ trách / GĐ xử
--   'hoan-thanh'   TP/PP chốt «Hoàn thành / Duyệt» (người dùng chốt 2026-09-01)
--   'da-duyet'     PGD/GĐ bấm «Duyệt» hoặc TỰ ĐỘNG theo phân quyền (file:create = ✓ ⇒ chốt luôn)
-- 'hoan-thanh' và 'da-duyet' là TRẠNG THÁI KẾT: không nộp thêm (409), không verdict (409).
--
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- Vì sao KHÔNG đụng `approval_status` — chiều ĐỘC LẬP với luồng duyệt cây (tiền lệ 3 cột
-- `xoa_*` của 013): nhiệm vụ (cấp 3) từ việc 5.1 luôn 'Đã duyệt', nên file kết quả không cần và
-- không được phép nhét trạng thái của mình vào trục duyệt đó. Nhồi vào là XOÁ MẤT trạng thái cũ
-- và phải dựng lại hai view `v_countable_*` lần nữa; 4 bảng riêng ở đây giữ hai chiều tách bạch:
-- sửa luồng file KHÔNG đụng thống kê, sửa thống kê không đụng luồng file.
--
-- ────────────────────────────────────────────────────────────────────────────────────────────
-- NỚI RÀNG BUỘC PHÂN QUYỀN CHO 'file' — Bảng phân quyền ĐỘNG (009/010/011) thêm 2 hàng
-- «Nộp kết quả (file nhiệm vụ)» = file:create và «Duyệt kết quả (file nhiệm vụ)» = file:approve.
-- Hai CHECK của `permission_overrides` phải nới:
--   po_entity_ok — thêm 'file' vào danh sách entity_type;
--   po_cho_duyet — LUẬT HIỆN HÀNH (011) đã cho 'cho-duyet' ở create/update/delete; giữ nguyên
--                  và nới THÊM đúng một nhánh: entity_type='file' AND action='approve' AND
--                  vai IN ('Trưởng phòng','Phó phòng') (TP/PP đặt ⏳ ở hàng «Duyệt kết quả» =
--                  mất nút chốt, bắt buộc trình lên cấp trên). Down trả về đúng luật 011.
-- Giá trị '⏳' cho Phó GĐ ở 2 hàng file bị `permissions/service.js` chặn 400 — PGD/GĐ là cấp chốt
-- cuối, không có ai để «chờ»; CHECK này chỉ là lưới an toàn cuối cùng ở CSDL.
-- Down: XOÁ dòng entity_type='file' TRƯỚC khi siết lại CHECK — còn dòng là ALTER nổ (bẫy 012:
-- hạ dữ liệu trước khi siết).


-- Up Migration

CREATE TABLE task_files (
  id          bigserial PRIMARY KEY,
  item_id     bigint NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  ten_goc     text   NOT NULL,
  trang_thai  text   NOT NULL DEFAULT 'cho-xem'
              CHECK (trang_thai IN ('cho-xem', 'can-sua', 'cho-lanh-dao', 'hoan-thanh', 'da-duyet')),
  created_by  bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE task_file_versions (
  id           bigserial PRIMARY KEY,
  file_id      bigint   NOT NULL REFERENCES task_files(id) ON DELETE CASCADE,
  version_no   int      NOT NULL,
  ten_luu      text     NOT NULL,
  ten_goc      text     NOT NULL,
  loai_mime    text     NOT NULL,
  kich_thuoc   bigint   NOT NULL,
  uploaded_by  bigint REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (file_id, version_no)
);

CREATE TABLE task_file_comments (
  id          bigserial PRIMARY KEY,
  version_id  bigint NOT NULL REFERENCES task_file_versions(id) ON DELETE CASCADE,
  nguoi_id    bigint REFERENCES users(id) ON DELETE SET NULL,
  vai         text   NOT NULL,
  noi_dung    text   NOT NULL,
  trang       int,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE task_file_flow (
  id          bigserial PRIMARY KEY,
  file_id     bigint NOT NULL REFERENCES task_files(id) ON DELETE CASCADE,
  version_id  bigint REFERENCES task_file_versions(id) ON DELETE SET NULL,
  nguoi_id    bigint REFERENCES users(id) ON DELETE SET NULL,
  vai         text   NOT NULL,
  hanh_dong   text   NOT NULL
              CHECK (hanh_dong IN (
                'nop', 'gom-y', 'yeu-cau-sua', 'trinh-lanh-dao', 'tra-ve-tp',
                'tra-ve-cbo', 'duyet-tu-dong', 'duyet', 'hoan-thanh'
              )),
  noi_dung    text   NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE task_files IS
  'NHÓM file kết quả của một nhiệm vụ (014). Một nhiệm vụ có thể có nhiều nhóm file; mỗi nhóm đi riêng một luồng nộp → góp ý → duyệt.';
COMMENT ON TABLE task_file_versions IS
  'BẢN của nhóm file (v1, v2, …). ten_luu là tên vật lý SINH SẴN (v{n}-{uuid}.{ext}) — CẤM dùng tên gốc làm đường dẫn (path traversal).';
COMMENT ON TABLE task_file_comments IS
  'Góp ý theo BẢN (014): TP/PP + Phó GĐ phụ trách + GĐ/admin; thread gắn đúng bản đang góp ý.';
COMMENT ON TABLE task_file_flow IS
  'BẢNG LUỒNG của nhóm file (014): thời điểm · người (vai) · hành động · bản · nội dung. Dòng «Tự động — phân quyền không yêu cầu duyệt» là duyet-tu-dong.';

CREATE INDEX idx_task_files_item ON task_files (item_id);
CREATE INDEX idx_task_file_comments_version ON task_file_comments (version_id);
CREATE INDEX idx_task_file_flow_file ON task_file_flow (file_id, created_at);

-- Nới ràng buộc phân quyền cho 'file' (đọc đúng CHECK của 009/010/011, không đoán):
ALTER TABLE permission_overrides
  DROP CONSTRAINT IF EXISTS po_entity_ok;
ALTER TABLE permission_overrides
  ADD CONSTRAINT po_entity_ok CHECK (entity_type IN ('work', 'subwork', 'task', 'file'));

ALTER TABLE permission_overrides
  DROP CONSTRAINT IF EXISTS po_cho_duyet;
ALTER TABLE permission_overrides
  ADD CONSTRAINT po_cho_duyet CHECK (
    action IN ('create', 'update', 'delete')
    OR gia_tri <> 'cho-duyet'
    OR (entity_type = 'file' AND action = 'approve'
        AND vai IN ('Trưởng phòng', 'Phó phòng'))
  );

-- Down Migration

-- XOÁ dòng 'file' TRƯỚC khi siết lại CHECK — còn dòng là ADD CONSTRAINT nổ «violates check
-- constraint» (bẫy 012: hạ dữ liệu trước khi siết ràng buộc).
DELETE FROM permission_overrides WHERE entity_type = 'file';

ALTER TABLE permission_overrides
  DROP CONSTRAINT IF EXISTS po_cho_duyet;
ALTER TABLE permission_overrides
  ADD CONSTRAINT po_cho_duyet
  CHECK (action IN ('create', 'update', 'delete') OR gia_tri <> 'cho-duyet');


ALTER TABLE permission_overrides
  DROP CONSTRAINT IF EXISTS po_entity_ok;
ALTER TABLE permission_overrides
  ADD CONSTRAINT po_entity_ok CHECK (entity_type IN ('work', 'subwork', 'task'));

DROP INDEX IF EXISTS idx_task_file_flow_file;
DROP INDEX IF EXISTS idx_task_file_comments_version;
DROP INDEX IF EXISTS idx_task_files_item;

DROP TABLE IF EXISTS task_file_flow;
DROP TABLE IF EXISTS task_file_comments;
DROP TABLE IF EXISTS task_file_versions;
DROP TABLE IF EXISTS task_files;

