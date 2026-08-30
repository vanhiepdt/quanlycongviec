-- 009_permission_overrides.sql — GHI ĐÈ «Bảng phân quyền hệ thống» (Vòng 9, 2026-08-29).
--
-- Giám đốc (admin) sửa bảng phân quyền bằng dropdown ở trang «Quản lý tài khoản»; mỗi ô chọn
-- một trong bốn giá trị, lưu ở đây và `can()` đọc qua `user.ghiDe` (session gắn từng request —
-- `can()` vẫn là hàm thuần, không đọc CSDL):
--
--   'cho-phep'  ✓  được làm NGAY (kể cả khi ma trận gốc từ chối) — phạm vi `inScope()` vẫn xét
--   'cho-duyet' ⏳  được làm nhưng dòng mới rơi vào «Chờ duyệt» — chỉ nghĩa cho action = create
--   'tu-choi'   ✕  tắt hẳn quyền đó của vai (đè cả trường hợp ma trận gốc cho phép)
--   (không dòng)   «Mặc định» — dùng đúng ma trận gốc trong rbac.js
--
-- Giới hạn, mỗi giới hạn một rào CHECK:
--   chỉ 3 thực thể nghiệp vụ (work/subwork/task) — user/department KHÔNG (L4 như ủy quyền);
--   không ghi đè vai `admin` (chính người sửa bảng);
--   «chờ duyệt» chỉ áp dụng cho action = create.

-- Up Migration

CREATE TABLE permission_overrides (
  vai         text NOT NULL,
  entity_type text NOT NULL,
  action      text NOT NULL,
  gia_tri     text NOT NULL,
  updated_by  bigint REFERENCES users(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vai, entity_type, action),
  CONSTRAINT po_vai_ok     CHECK (vai IN ('Phó Giám đốc', 'Trưởng phòng', 'Phó phòng', 'Quản lý công việc', 'Nhân viên')),
  CONSTRAINT po_entity_ok  CHECK (entity_type IN ('work', 'subwork', 'task')),
  CONSTRAINT po_action_ok  CHECK (action IN ('read', 'create', 'update', 'delete', 'approve')),
  CONSTRAINT po_gia_tri_ok CHECK (gia_tri IN ('cho-phep', 'tu-choi', 'cho-duyet')),
  CONSTRAINT po_cho_duyet  CHECK (action = 'create' OR gia_tri <> 'cho-duyet')
);

CREATE INDEX idx_permission_overrides_vai ON permission_overrides (vai);

-- Down Migration

DROP TABLE IF EXISTS permission_overrides;
