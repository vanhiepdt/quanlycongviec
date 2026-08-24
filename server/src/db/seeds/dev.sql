-- Dữ liệu mẫu cho máy dev và cho UAT (§13.7). BỊA HẾT — không có một dòng nào là nhân sự thật.
--
-- Chạy bằng: npm run seed:dev   (bộ chạy TỪ CHỐI khi NODE_ENV=production, xem run.js)
-- Chạy lại được nhiều lần: mọi INSERT đều có ON CONFLICT, không sinh bản trùng.
--
-- Mật khẩu của cả 10 người: Test@12345   (bcrypt cost 12, xem hằng bên dưới)
-- Cả 10 đều must_change_password = true để chính đường "bắt đổi mật khẩu lần đầu" luôn được đi
-- thử tay ở UAT, chứ không chỉ có test tự động đi qua.
--
-- Sinh lại hằng băm khi đổi mật khẩu mẫu:
--   node --input-type=module -e "import {hashSync} from '@node-rs/bcrypt';console.log(hashSync('MậtKhẩuMới',12))"

BEGIN;

-- 4 phòng lấy đúng tên và thứ tự của file thật (§13.8) để dev thấy cùng thứ tự Gantt như UAT.
INSERT INTO departments (code, name, sort_order) VALUES
  ('PH01', 'Quản lý Đào tạo',        1),
  ('PH02', 'Nghiên cứu Khoa học',    2),
  ('PH03', 'Kế toán',                3),
  ('PH04', 'Hành chính Nhân sự',     4)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- 10 người dùng. `department_id` dò theo MÃ phòng bằng truy vấn con: không viết số id cứng vào
-- đây, vì `bigserial` không đảm bảo PH01 = 1 sau khi bảng đã bị xoá/nhập lại vài lần.
INSERT INTO users (code, full_name, email, password_hash, must_change_password,
                   position, role, object_type, department_id, dept_role)
VALUES
  ('TEST001', 'Quản trị Hệ thống',       'admin@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Quản trị hệ thống', 'admin',              'Nội bộ', NULL, NULL),

  ('TEST002', 'Phó GĐ Một',              'pgd1@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Phó Giám đốc',      'Phó Giám đốc',        'Nội bộ', NULL, NULL),

  ('TEST003', 'Phó GĐ Hai',              'pgd2@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Phó Giám đốc',      'Phó Giám đốc',        'Nội bộ', NULL, NULL),

  ('TEST004', 'Trưởng phòng Đào tạo',    'tp01@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Trưởng phòng',      'Trưởng phòng',        'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH01'), 'Trưởng phòng'),

  ('TEST005', 'Phó phòng Đào tạo',       'pp01@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Phó phòng',         'Phó phòng',           'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH01'), 'Phó phòng'),

  ('TEST006', 'Trưởng phòng Kế toán',    'tp03@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Trưởng phòng',      'Trưởng phòng',        'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH03'), 'Trưởng phòng'),

  -- Vai trò ĐÚNG là 'Quản lý công việc' (§0 Từ vựng). Viết 'Quản lý dự án' là vi phạm
  -- CHECK users_role_valid và câu seed sẽ đổ ngay tại đây.
  ('TEST007', 'Quản lý Công việc',       'qlcv@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Chuyên viên',       'Quản lý công việc',   'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH01'), 'Nhân viên'),

  ('TEST008', 'Nhân viên Đào tạo',       'nv01@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Chuyên viên',       'Nhân viên',           'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH01'), 'Nhân viên'),

  ('TEST009', 'Nhân viên Kế toán',       'nv03@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Chuyên viên',       'Nhân viên',           'Nội bộ',
   (SELECT id FROM departments WHERE code = 'PH03'), 'Nhân viên'),

  -- Cố ý KHÔNG có phòng: TC-RBAC-09 kiểm rằng người không thuộc phòng nào không làm sập API.
  ('TEST010', 'Nhân viên Không phòng',   'nv00@test.local',
   '$2y$12$MeTdJlT/v3hUz4i0LdHBj.5Htma4Oh2iABUBBq7QDMr8Cw/WGXOIK', true,
   'Chuyên viên',       'Nhân viên',           'Nội bộ', NULL, NULL)
ON CONFLICT (code) DO UPDATE SET
  full_name            = EXCLUDED.full_name,
  email                = EXCLUDED.email,
  password_hash        = EXCLUDED.password_hash,
  must_change_password = EXCLUDED.must_change_password,
  position             = EXCLUDED.position,
  role                 = EXCLUDED.role,
  object_type          = EXCLUDED.object_type,
  department_id        = EXCLUDED.department_id,
  dept_role            = EXCLUDED.dept_role,
  -- Seed lại là để có tài khoản dùng được: mở khoá và xoá bộ đếm sai mật khẩu luôn.
  is_active            = true,
  failed_logins        = 0,
  last_failed_login_at = NULL,
  locked_until         = NULL,
  updated_at           = now();

-- Phân công quản lý. Hai Phó GĐ phụ trách HAI NHÓM PHÒNG KHÁC NHAU — đó là điều kiện để
-- TC-RBAC-05 có nghĩa (Phó GĐ Một không được duyệt mục của PH03/PH04).
INSERT INTO department_managers (department_id, user_id, role)
SELECT d.id, u.id, m.role
FROM (VALUES
  ('PH01', 'TEST002', 'deputy_director'),
  ('PH02', 'TEST002', 'deputy_director'),
  ('PH03', 'TEST003', 'deputy_director'),
  ('PH04', 'TEST003', 'deputy_director'),
  ('PH01', 'TEST004', 'head'),
  ('PH01', 'TEST005', 'vice'),
  ('PH03', 'TEST006', 'head')
) AS m(dept_code, user_code, role)
JOIN departments d ON d.code = m.dept_code
JOIN users       u ON u.code = m.user_code
ON CONFLICT (department_id, user_id, role) DO NOTHING;

COMMIT;
