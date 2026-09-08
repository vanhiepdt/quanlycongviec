-- 021_remove_legacy_manager_role.sql — chuẩn hóa vai «Quản lý công việc» cũ.
-- Vai quản lý công việc không còn là một vai phân quyền hệ thống; chức năng hiện dùng
-- `dept_role` để phân biệt Trưởng phòng/Phó phòng/Cán bộ.

-- Up Migration

UPDATE users
   SET role = CASE dept_role
                WHEN 'Trưởng phòng' THEN 'Trưởng phòng'
                WHEN 'Phó phòng' THEN 'Phó phòng'
                ELSE 'Nhân viên'
              END
 WHERE role = 'Quản lý công việc'
    OR (role = 'Nhân viên' AND dept_role IN ('Trưởng phòng', 'Phó phòng'));

DELETE FROM permission_overrides WHERE vai = 'Quản lý công việc';

UPDATE apps
   SET allowed_roles = CASE
     WHEN cardinality(array_remove(allowed_roles, 'Quản lý công việc')) = 0 THEN ARRAY['admin']::text[]
     ELSE array_remove(allowed_roles, 'Quản lý công việc')
   END
 WHERE 'Quản lý công việc' = ANY(allowed_roles);

ALTER TABLE users DROP CONSTRAINT users_role_valid;
ALTER TABLE users ADD CONSTRAINT users_role_valid CHECK (role IN
  ('admin', 'Phó Giám đốc', 'Trưởng phòng', 'Phó phòng', 'Nhân viên'));
ALTER TABLE permission_overrides DROP CONSTRAINT po_vai_ok;
ALTER TABLE permission_overrides ADD CONSTRAINT po_vai_ok CHECK (vai IN
  ('Phó Giám đốc', 'Trưởng phòng', 'Phó phòng', 'Nhân viên'));

-- Down Migration

ALTER TABLE users DROP CONSTRAINT users_role_valid;
ALTER TABLE users ADD CONSTRAINT users_role_valid CHECK (role IN
  ('admin', 'Phó Giám đốc', 'Trưởng phòng', 'Phó phòng', 'Quản lý công việc', 'Nhân viên'));
ALTER TABLE permission_overrides DROP CONSTRAINT po_vai_ok;
ALTER TABLE permission_overrides ADD CONSTRAINT po_vai_ok CHECK (vai IN
  ('Phó Giám đốc', 'Trưởng phòng', 'Phó phòng', 'Quản lý công việc', 'Nhân viên'));

-- Không khôi phục được vai cũ một cách an toàn vì một tài khoản có thể đã được
-- chuẩn hóa từ nhiều nguồn; để down migration không làm sai dữ liệu hiện tại.
